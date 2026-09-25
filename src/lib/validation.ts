import { z } from 'zod';
import Decimal from 'decimal.js';
import { todayIndia } from './business';
const required = z.string().trim().min(1, 'This field is required.').max(250);
const optional = z.string().trim().max(2000).optional().default('');
export const id = z.string().uuid('Choose a valid option.');
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')
  .refine(
    (s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Choose a valid date.',
  );
export const pastDate = date.refine((s) => s <= todayIndia(), 'Future dates are not allowed.');
export const employeeSchema = z.object({
  employee_id: z.string().regex(/^\d+$/).optional(),
  employee_name: required,
  department: required,
  designation: required,
  location_id: id,
  joining_date: date,
  phone: z.string().trim().max(40).optional().default(''),
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .default(''),
  address: optional,
  is_active: z.boolean(),
});
export type EmployeeInput = z.input<typeof employeeSchema>;
export const productSchema = z.object({
  product_id: id.optional(),
  product_name: required,
  category: z.enum(['grocery', 'vegetables', 'sweets_savouries']),
  unit: z.enum(['kg', 'litre', 'gram', 'piece']),
  is_active: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;
export function decimalInput(value: string, places: number, zero: boolean) {
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value)) return false;
  const d = new Decimal(value);
  return (
    d.isFinite() &&
    (zero ? d.gte(0) : d.gt(0)) &&
    d.lt(places === 2 ? '1000000000000' : '100000000000')
  );
}
export const quantity = z
  .string()
  .refine((v) => decimalInput(v, 3, false), 'Enter a positive quantity, up to 3 decimals.');
export const count = z
  .string()
  .refine((v) => decimalInput(v, 3, true), 'Enter zero or a positive quantity, up to 3 decimals.');
const amount = z
  .string()
  .refine((v) => decimalInput(v, 2, true), 'Enter total cost, up to 2 decimals.');
export const movementSchema = z
  .object({
    product_id: id,
    location_id: id,
    movement_type: z.enum([
      'opening_stock',
      'purchase_received',
      'production_received',
      'used',
      'disposed',
      'adjustment',
    ]),
    movement_date: pastDate,
    quantity: z.string(),
    total_cost: z.string(),
    usage_purpose: z.enum(['sweet_savoury_production', 'restaurant_cooking', 'other']),
    custom_purpose: optional,
    reason: optional,
    counted_quantity: z.string(),
    replaces_movement_id: id.optional(),
    correction_reason: optional,
  })
  .superRefine((v, c) => {
    const error = (key: string, message: string) =>
      c.addIssue({ code: 'custom', path: [key], message });
    if (v.movement_type === 'adjustment') {
      if (!count.safeParse(v.counted_quantity).success)
        error('counted_quantity', 'Enter a valid physical count.');
      if (!v.reason) error('reason', 'Explain the stock difference.');
      if (v.movement_date !== todayIndia())
        error('movement_date', 'A physical count is recorded today.');
    } else if (!quantity.safeParse(v.quantity).success)
      error('quantity', 'Enter a positive quantity, up to 3 decimals.');
    if (v.movement_type === 'purchase_received') {
      if (!amount.safeParse(v.total_cost).success)
        error('total_cost', 'Kindly Enter the overll price for this product');
    } else if (v.movement_type === 'opening_stock' && v.total_cost) {
      if (!amount.safeParse(v.total_cost).success)
        error('total_cost', 'Enter a valid total cost, up to 2 decimals.');
    }
    if (v.movement_type === 'used' && v.usage_purpose === 'other' && !v.custom_purpose)
      error('custom_purpose', 'Describe the purpose.');
    if (v.replaces_movement_id && !v.correction_reason)
      error('correction_reason', 'Explain the correction.');
  });
export type MovementInput = z.input<typeof movementSchema>;
export const transferSchema = z
  .object({
    action: z.enum(['create', 'receive', 'replace']),
    transfer_id: id.optional(),
    transfer_type: z.enum(['dispatch', 'return']),
    origin_location_id: id,
    destination_location_id: id,
    dispatch_date: pastDate,
    received_date: z.union([pastDate, z.literal('')]),
    reason: optional,
    items: z
      .array(
        z.object({
          product_id: id,
          qty_sent: quantity,
          received_in_full: z.boolean(),
          actual_qty_received: z.string(),
          receipt_notes: optional,
          dispose_all: z.boolean(),
          usable_qty: z.string(),
          disposal_notes: optional,
        }),
      )
      .min(1, 'Add at least one product.'),
  })
  .superRefine((v, c) => {
    const fail = (path: (string | number)[], message: string) =>
      c.addIssue({ code: 'custom', path, message });
    if (v.origin_location_id === v.destination_location_id)
      fail(['destination_location_id'], 'Choose a different destination.');
    if (new Set(v.items.map((i) => i.product_id)).size !== v.items.length)
      fail(['items'], 'Each product can appear only once.');
    if (v.action !== 'create' && !v.transfer_id) fail(['transfer_id'], 'Choose a shipment.');
    if (v.action === 'replace' && !v.reason) fail(['reason'], 'Explain the correction.');
    const receipt = v.action === 'receive' || (v.action === 'replace' && !!v.received_date);
    if (receipt && (!v.received_date || v.received_date < v.dispatch_date))
      fail(['received_date'], 'Receipt must be on or after dispatch.');
    if (receipt)
      v.items.forEach((i, n) => {
        if (!quantity.safeParse(i.qty_sent).success) return;
        const actual = i.received_in_full ? i.qty_sent : i.actual_qty_received;
        if (!count.safeParse(actual).success || new Decimal(actual || 0).gt(i.qty_sent)) {
          fail(
            ['items', n, 'actual_qty_received'],
            'Actual quantity must be between zero and sent quantity.',
          );
          return;
        }
        if (
          v.transfer_type === 'return' &&
          !i.dispose_all &&
          (!count.safeParse(i.usable_qty).success || new Decimal(i.usable_qty || 0).gt(actual))
        )
          fail(
            ['items', n, 'usable_qty'],
            'Usable quantity must be between zero and actual quantity.',
          );
      });
  });
export type TransferInput = z.input<typeof transferSchema>;
