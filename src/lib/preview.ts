import type {
  Account,
  Attendance,
  Balance,
  Context,
  Employee,
  Holiday,
  Movement,
  Roster,
  Transfer,
} from './model';
import { todayIndia } from './business';
// This file is imported exclusively by /preview. It is never a live-data fallback.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = todayIndia();
const timestamp = `${now}T09:00:00+05:30`;
export const previewContext: Context = {
  account: {
    user_account_id: uuid(100),
    auth_user_id: uuid(101),
    display_name: 'Operations manager',
    user_role: 'manager',
    location_id: null,
    is_active: true,
  },
  locations: [
    {
      location_id: uuid(1),
      location_name: 'Central store',
      location_type: 'central_store',
      is_active: true,
      address: null,
      phone: null,
    },
    ...[2, 3, 4, 5].map((n) => ({
      location_id: uuid(n),
      location_name: `Outlet 0${n - 1}`,
      location_type: 'outlet' as const,
      is_active: true,
      address: null,
      phone: null,
    })),
  ],
};
export const previewEmployees: Employee[] = [
  ['Arun Kumar', 'Kitchen', 'Head cook'],
  ['Meena R', 'Production', 'Sweet maker'],
  ['Suresh B', 'Store', 'Store assistant'],
  ['Lakshmi S', 'Kitchen', 'Cook'],
  ['Karthik P', 'Production', 'Production assistant'],
  ['Divya M', 'Housekeeping', 'Housekeeping'],
  ['Ravi S', 'Store', 'Packing assistant'],
  ['Priya N', 'Production', 'Sweet maker'],
].map(([name, department, designation], i) => ({
  employee_id: String(i + 1),
  employee_name: name,
  department,
  designation,
  location_id: uuid(1),
  phone: null,
  email: null,
  address: null,
  joining_date: '2026-01-05',
  is_active: true,
}));
export const previewRoster: Roster[] = previewEmployees.map((e, i) => ({
  ...e,
  current_location_id: e.location_id,
  recorded_location_id: i < 5 ? e.location_id : null,
  attendance_id: i < 5 ? uuid(200 + i) : null,
  effective_status: i < 4 ? 'present' : i === 4 ? 'half_day' : 'not_marked',
  status_source: i < 5 ? 'explicit' : 'unmarked',
}));
export const previewAttendance: Attendance[] = previewRoster
  .filter((r) => r.attendance_id)
  .map((r) => ({
    attendance_id: r.attendance_id!,
    employee_id: r.employee_id,
    location_id: uuid(1),
    attendance_date: now,
    attendance_status: r.effective_status as Attendance['attendance_status'],
  }));
export const previewHolidays: Holiday[] = [];
export const previewStock: Balance[] = [
  {
    product_id: uuid(10),
    product_name: 'Sugar',
    category: 'grocery',
    unit: 'kg',
    is_active: true,
    quantity: '125.5',
  },
  {
    product_id: uuid(11),
    product_name: 'Pure ghee',
    category: 'grocery',
    unit: 'litre',
    is_active: true,
    quantity: '42',
  },
  {
    product_id: uuid(12),
    product_name: 'Besan flour',
    category: 'grocery',
    unit: 'kg',
    is_active: true,
    quantity: '80',
  },
  {
    product_id: uuid(13),
    product_name: 'Carrots',
    category: 'vegetables',
    unit: 'kg',
    is_active: true,
    quantity: '18.5',
  },
  {
    product_id: uuid(14),
    product_name: 'Mysore pak',
    category: 'sweets_savouries',
    unit: 'kg',
    is_active: true,
    quantity: '32',
  },
  {
    product_id: uuid(15),
    product_name: 'Mixture',
    category: 'sweets_savouries',
    unit: 'kg',
    is_active: true,
    quantity: '24',
  },
  {
    product_id: uuid(16),
    product_name: 'Onions',
    category: 'vegetables',
    unit: 'kg',
    is_active: true,
    quantity: '0',
  },
];
export const previewMovements: Movement[] = previewStock
  .slice(0, 4)
  .map((p, i) => ({
    movement_id: uuid(300 + i),
    product_id: p.product_id,
    location_id: uuid(1),
    movement_type: 'purchase_received',
    movement_date: now,
    quantity_change: p.quantity,
    total_cost: [5020, 25200, 6400, 740][i],
    usage_purpose: null,
    custom_purpose: null,
    reason: null,
    counted_quantity: null,
    stock_before_count: null,
    replaces_movement_id: null,
    transfer_item_id: null,
    is_voided: false,
    void_reason: null,
    created_at: timestamp,
    voided_at: null,
  }));
export const previewTransfers: Transfer[] = [0, 1, 2, 3].map((n) => ({
  transfer_id: uuid(400 + n),
  transfer_type: n === 2 ? 'return' : 'dispatch',
  origin_location_id: n === 2 ? uuid(3) : uuid(1),
  destination_location_id: n === 2 ? uuid(1) : uuid(2 + (n % 3)),
  dispatch_date: now,
  status: n === 3 ? 'received' : 'dispatched',
  received_date: n === 3 ? now : null,
  received_at: n === 3 ? timestamp : null,
  created_at: timestamp,
  void_reason: null,
  replaces_transfer_id: null,
  items: [4, 5, 0]
    .slice(0, n === 2 ? 2 : 3)
    .map((p, i) => ({
      transfer_item_id: uuid(500 + n * 10 + i),
      transfer_id: uuid(400 + n),
      product_id: previewStock[p].product_id,
      qty_sent: [8, 5, 10][i],
      received_in_full: n === 3 ? true : null,
      actual_qty_received: n === 3 ? [8, 5, 10][i] : null,
      receipt_notes: null,
      dispose_all: null,
      usable_qty: null,
      disposal_notes: null,
    })),
}));
export const previewAccounts: Account[] = [
  previewContext.account,
  {
    ...previewContext.account,
    user_account_id: uuid(110),
    display_name: 'Owner',
    user_role: 'owner',
  },
  ...previewContext.locations.map((l, i) => ({
    user_account_id: uuid(120 + i),
    auth_user_id: uuid(130 + i),
    display_name:
      l.location_type === 'central_store' ? 'Store supervisor' : `${l.location_name} supervisor`,
    user_role:
      l.location_type === 'central_store'
        ? ('store_supervisor' as const)
        : ('outlet_supervisor' as const),
    location_id: l.location_id,
    is_active: true,
  })),
];
