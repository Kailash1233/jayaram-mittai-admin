'use server';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { supabase } from './supabase';
import { requireAdmin, requireContext, requireInventory } from './data';
import {
  employeeSchema,
  productSchema,
  movementSchema,
  transferSchema,
  id,
  pastDate,
  date,
} from './validation';
import { isAdmin, type ActionResult, type Status } from './model';
import { todayIndia } from './business';
function databaseError(error: { code?: string; message: string }) {
  const approved =
    /negative|stock already matches|unit cannot|choose|quantity|opening stock|historical location|before joining|joining date|already|correct automatic|shipment|receipt|product|purpose|cost|reason/i;
  if (error.code === '42501')
    throw new Error('Your account cannot perform this action. Check the location and date.');
  if (error.code === '23505')
    throw new Error(
      'A record with these details already exists. Refresh and check before retrying.',
    );
  if (error.code === '23503')
    throw new Error('A related record has changed. Refresh the page and try again.');
  if (['23514', '22023'].includes(error.code ?? '') && approved.test(error.message))
    throw new Error(error.message);
  console.error('Database operation failed', error.code);
  throw new Error('The change could not be saved. Refresh and check the record before retrying.');
}
async function run(work: () => Promise<{ message: string; id?: string }>): Promise<ActionResult> {
  try {
    const result = await work();
    revalidatePath('/', 'layout');
    return { ok: true, ...result };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof z.ZodError)
      return { ok: false, message: error.issues[0]?.message ?? 'Please check the form.' };
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to save this change.',
    };
  }
}
export async function login(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Enter your email and password.' };
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: 'Unable to sign in. Check your email and password.' };
  redirect('/');
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect('/login');
}
export async function saveEmployee(input: unknown) {
  return run(async () => {
    await requireAdmin();
    const v = employeeSchema.parse(input);
    const db = await supabase();
    const { employee_id, ...fields } = v;
    const payload = {
      ...fields,
      phone: fields.phone || null,
      email: fields.email || null,
      address: fields.address || null,
    };
    const query = employee_id
      ? db.from('employees').update(payload).eq('employee_id', employee_id)
      : db.from('employees').insert(payload);
    const { error } = await query;
    if (error) databaseError(error);
    return { message: employee_id ? 'Employee details updated.' : 'Employee added.' };
  });
}
export async function setAttendance(
  employee: string,
  day: string,
  status: Status,
  historicalLocation?: string,
) {
  return run(async () => {
    const c = await requireContext();
    z.string().regex(/^\d+$/).parse(employee);
    pastDate.parse(day);
    z.enum(['present', 'absent', 'half_day', 'holiday']).parse(status);
    if (!isAdmin(c.account.user_role) && day !== todayIndia())
      throw new Error('Supervisors can edit today’s attendance only.');
    const db = await supabase();
    const { error } = await db.rpc('mark_attendance', {
      p_employee_id: employee,
      p_date: day,
      p_status: status,
      p_historical_location_id: historicalLocation || null,
    });
    if (error) databaseError(error);
    return { message: 'Attendance saved.' };
  });
}
export async function resetAttendance(employee: string, day: string) {
  return run(async () => {
    await requireAdmin();
    z.string().regex(/^\d+$/).parse(employee);
    pastDate.parse(day);
    const db = await supabase();
    const { error } = await db.rpc('reset_attendance', { p_employee_id: employee, p_date: day });
    if (error) databaseError(error);
    return { message: 'Individual mark reset to the calendar default.' };
  });
}
export async function bulkAttendance(
  location: string,
  status: 'present' | 'holiday',
  replace: boolean,
) {
  return run(async () => {
    await requireContext();
    id.parse(location);
    z.enum(['present', 'holiday']).parse(status);
    z.boolean().parse(replace);
    const db = await supabase();
    const { data, error } = await db.rpc('mark_location_attendance', {
      p_location_id: location,
      p_status: status,
      p_replace_existing: replace,
    });
    if (error) databaseError(error);
    return { message: `${data ?? 0} attendance records updated.` };
  });
}
export async function saveHolidays(input: unknown) {
  return run(async () => {
    await requireAdmin();
    const v = z
      .object({
        locations: z.array(id).min(1),
        dates: z.array(date).min(1).max(366),
        name: z.string().trim().max(250),
        remove: z.boolean(),
      })
      .parse(input);
    const db = await supabase();
    const args = { p_location_ids: v.locations, p_dates: v.dates };
    const { data, error } = v.remove
      ? await db.rpc('remove_location_holidays', args)
      : await db.rpc('declare_location_holidays', { ...args, p_holiday_name: v.name || null });
    if (error) databaseError(error);
    return { message: `${data ?? 0} holiday declarations ${v.remove ? 'removed' : 'added'}.` };
  });
}
export async function saveProduct(input: unknown) {
  return run(async () => {
    const c = await requireInventory();
    const v = productSchema.parse(input);
    if (v.product_id && !isAdmin(c.account.user_role))
      throw new Error('Only admins can edit products.');
    const db = await supabase();
    const { product_id, ...payload } = v;
    const query = product_id
      ? db.from('inventory_products').update(payload).eq('product_id', product_id)
      : db.from('inventory_products').insert(payload);
    const { error } = await query;
    if (error) databaseError(error);
    return { message: product_id ? 'Product updated.' : 'Product added.' };
  });
}
export async function saveMovement(input: unknown) {
  return run(async () => {
    const c = await requireInventory();
    const v = movementSchema.parse(input);
    if (
      (v.replaces_movement_id || ['opening_stock', 'adjustment'].includes(v.movement_type)) &&
      !isAdmin(c.account.user_role)
    )
      throw new Error('Administrator access required.');
    const db = await supabase();
    const { data, error } = await db.rpc('save_inventory_movement', {
      p_product_id: v.product_id,
      p_location_id: v.location_id,
      p_movement_type: v.movement_type,
      p_movement_date: v.movement_date,
      p_quantity: v.movement_type === 'adjustment' ? null : v.quantity,
      p_total_cost: ['purchase_received', 'opening_stock'].includes(v.movement_type)
        ? v.total_cost || null
        : null,
      p_usage_purpose: v.movement_type === 'used' ? v.usage_purpose : null,
      p_custom_purpose:
        v.movement_type === 'used' && v.usage_purpose === 'other' ? v.custom_purpose : null,
      p_reason: ['disposed', 'adjustment'].includes(v.movement_type) ? v.reason || null : null,
      p_counted_quantity: v.movement_type === 'adjustment' ? v.counted_quantity : null,
      p_replaces_movement_id: v.replaces_movement_id || null,
      p_correction_reason: v.replaces_movement_id ? v.correction_reason : null,
    });
    if (error) databaseError(error);
    return {
      message: v.replaces_movement_id
        ? 'Correction saved; the original is retained in history.'
        : 'Stock movement recorded.',
      id: String(data),
    };
  });
}
export async function voidMovement(movement: string, reason: string) {
  return run(async () => {
    await requireAdmin();
    id.parse(movement);
    z.string().trim().min(1, 'A reason is required.').parse(reason);
    const db = await supabase();
    const { error } = await db.rpc('void_inventory_movement', {
      p_movement_id: movement,
      p_reason: reason,
    });
    if (error) databaseError(error);
    return { message: 'Movement voided. Stock has been recalculated.' };
  });
}
export async function saveTransfer(input: unknown) {
  return run(async () => {
    const c = await requireContext();
    const v = transferSchema.parse(input);
    const admin = isAdmin(c.account.user_role);
    if (v.action === 'replace' && !admin) throw new Error('Only admins can correct shipments.');
    const receipt = v.action === 'receive' || (v.action === 'replace' && !!v.received_date);
    if (!admin && (receipt ? v.received_date !== todayIndia() : v.dispatch_date !== todayIndia()))
      throw new Error('Only admins can backdate transfers.');
    const items = v.items.map((i) => ({
      product_id: i.product_id,
      ...(v.action !== 'receive' ? { qty_sent: i.qty_sent } : {}),
      ...(receipt
        ? {
            received_in_full: i.received_in_full,
            ...(!i.received_in_full ? { actual_qty_received: i.actual_qty_received } : {}),
            receipt_notes: i.receipt_notes || null,
            ...(v.transfer_type === 'return'
              ? {
                  dispose_all: i.dispose_all,
                  ...(!i.dispose_all ? { usable_qty: i.usable_qty } : {}),
                  disposal_notes: i.disposal_notes || null,
                }
              : {}),
          }
        : {}),
    }));
    const db = await supabase();
    const { data, error } = await db.rpc('manage_transfer', {
      p_action: v.action,
      p_transfer_id: v.transfer_id || null,
      p_transfer_type: v.transfer_type,
      p_origin_location_id: v.origin_location_id,
      p_destination_location_id: v.destination_location_id,
      p_dispatch_date: v.dispatch_date,
      p_received_date: receipt ? v.received_date : null,
      p_items: items,
      p_reason: v.reason || null,
    });
    if (error) databaseError(error);
    return {
      message:
        v.action === 'receive'
          ? 'Receipt confirmed. Reloaded shipment data is authoritative.'
          : v.action === 'replace'
            ? 'Shipment correction saved.'
            : 'Shipment dispatched.',
      id: String(data),
    };
  });
}
export async function voidTransfer(transfer: string, reason: string) {
  return run(async () => {
    await requireAdmin();
    id.parse(transfer);
    z.string().trim().min(1, 'A reason is required.').parse(reason);
    const db = await supabase();
    const { error } = await db.rpc('manage_transfer', {
      p_action: 'void',
      p_transfer_id: transfer,
      p_reason: reason,
    });
    if (error) databaseError(error);
    return { message: 'Shipment and its stock postings have been voided.' };
  });
}
