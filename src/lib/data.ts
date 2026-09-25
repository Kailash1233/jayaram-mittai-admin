import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { configured, supabase } from './supabase';
import {
  isAdmin,
  type Account,
  type Attendance,
  type Balance,
  type Context,
  type Employee,
  type Holiday,
  type Location,
  type Movement,
  type OutletProductLog,
  type Product,
  type Roster,
  type Transfer,
  type TransferItem,
} from './model';
export const requireContext = cache(async (): Promise<Context> => {
  if (!configured()) redirect('/setup');
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await db
    .from('user_accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (error)
    throw new Error(
      'Unable to load your account. Check that all three schema migrations are installed.',
    );
  if (!data) redirect('/access-pending');
  const account = data as Account;
  const { data: locations, error: locationsError } = await db.rpc('get_transfer_locations');
  if (locationsError)
    throw new Error('The location directory could not be loaded. Check the Scope 3 functions.');
  const list = (locations ?? []) as Location[];
  if (
    !isAdmin(account.user_role) &&
    !list.some((l) => l.location_id === account.location_id && l.is_active)
  )
    redirect('/access-pending');
  return { account, locations: list };
});
export async function requireAdmin() {
  const c = await requireContext();
  if (!isAdmin(c.account.user_role)) redirect('/');
  return c;
}
export async function requireInventory() {
  const c = await requireContext();
  if (c.account.user_role === 'outlet_supervisor') redirect('/transfers');
  return c;
}
interface Rows {
  employees: Employee;
  employee_attendance: Attendance;
  location_holidays: Holiday;
  inventory_products: Product;
  inventory_movements: Movement;
  transfer_batches: Omit<Transfer, 'items'>;
  transfer_items: TransferItem;
  user_accounts: Account;
}
const keys: Record<keyof Rows, string> = {
  employees: 'employee_id',
  employee_attendance: 'attendance_id',
  location_holidays: 'location_holiday_id',
  inventory_products: 'product_id',
  inventory_movements: 'movement_id',
  transfer_batches: 'transfer_id',
  transfer_items: 'transfer_item_id',
  user_accounts: 'user_account_id',
};
export async function allRows<T extends keyof Rows>(
  table: T,
  filters: { column: string; value: string; operator?: 'eq' | 'gte' | 'lte' }[] = [],
): Promise<Rows[T][]> {
  const db = await supabase();
  const rows: Rows[T][] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    let query = db
      .from(table)
      .select('*')
      .order(keys[table])
      .range(offset, offset + 999);
    for (const f of filters)
      query =
        f.operator === 'gte'
          ? query.gte(f.column, f.value)
          : f.operator === 'lte'
            ? query.lte(f.column, f.value)
            : query.eq(f.column, f.value);
    const { data, error } = await query;
    if (error)
      throw new Error(
        `Unable to load ${table.replaceAll('_', ' ')}. Verify your connection and database permissions.`,
      );
    const normalized = (data ?? []).map((row) => {
      if ('employee_id' in row) {
        if (typeof row.employee_id === 'number' && !Number.isSafeInteger(row.employee_id))
          throw new Error('Employee identifier exceeds safe API precision.');
        return { ...row, employee_id: String(row.employee_id) };
      }
      return row;
    }) as Rows[T][];
    rows.push(...normalized);
    if (normalized.length < 1000) return rows;
  }
  throw new Error('This query is too large. Narrow the selected date range.');
}
export async function roster(date: string, location: string): Promise<Roster[]> {
  if (!location) return [];
  const db = await supabase();
  const { data, error } = await db.rpc('get_attendance_roster', {
    p_date: date,
    p_location_id: location,
  });
  if (error) throw new Error('Unable to load attendance for this location and date.');
  return (data ?? []) as Roster[];
}
export async function balances(location: string): Promise<Balance[]> {
  if (!location) return [];
  const db = await supabase();
  const { data, error } = await db.rpc('get_inventory_balances', { p_location_id: location });
  if (error) throw new Error('Unable to load stock balances. Check the inventory functions.');
  return (data ?? []) as Balance[];
}
export async function transferProducts(): Promise<Product[]> {
  const db = await supabase();
  const { data, error } = await db.rpc('get_transfer_products');
  if (error) throw new Error('Unable to load the transfer product catalog.');
  return (data ?? []) as Product[];
}
export async function transfers(): Promise<Transfer[]> {
  const [batches, items] = await Promise.all([
    allRows('transfer_batches'),
    allRows('transfer_items'),
  ]);
  return batches
    .map((b) => ({ ...b, items: items.filter((i) => i.transfer_id === b.transfer_id) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function outletProductLogs(outletId?: string): Promise<OutletProductLog[]> {
  const db = await supabase();
  let q = db.from('outlet_product_logs').select('*');
  if (outletId) q = q.eq('outlet_id', outletId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as OutletProductLog[];
}
