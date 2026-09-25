export type Role = 'owner' | 'manager' | 'store_supervisor' | 'outlet_supervisor';
export type Status = 'present' | 'absent' | 'half_day' | 'holiday';
export type Category = 'grocery' | 'vegetables' | 'sweets_savouries';
export type Unit = 'kg' | 'litre' | 'gram' | 'piece';
export type MovementType =
  | 'opening_stock'
  | 'purchase_received'
  | 'production_received'
  | 'used'
  | 'disposed'
  | 'adjustment';
export interface Location {
  location_id: string;
  location_name: string;
  location_type: 'central_store' | 'outlet';
  address: string | null;
  phone: string | null;
  is_active: boolean;
}
export interface Account {
  user_account_id: string;
  auth_user_id: string;
  display_name: string;
  user_role: Role;
  location_id: string | null;
  is_active: boolean;
}
export interface Employee {
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  location_id: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  joining_date: string;
  is_active: boolean;
}
export interface Attendance {
  attendance_id: string;
  employee_id: string;
  location_id: string;
  attendance_date: string;
  attendance_status: Status;
}
export interface Roster {
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  current_location_id: string;
  recorded_location_id: string | null;
  effective_status: Status | 'not_marked';
  status_source: string;
  attendance_id: string | null;
}
export interface Holiday {
  location_holiday_id: string;
  location_id: string;
  holiday_date: string;
  holiday_name: string | null;
}
export interface Product {
  product_id: string;
  product_name: string;
  category: Category;
  unit: Unit;
  is_active: boolean;
}
export interface Balance extends Product {
  quantity: string | number;
}
export interface Movement {
  movement_id: string;
  product_id: string;
  location_id: string;
  movement_type: MovementType | 'transfer_out' | 'return_received';
  movement_date: string;
  quantity_change: string | number;
  total_cost: string | number | null;
  usage_purpose: string | null;
  custom_purpose: string | null;
  reason: string | null;
  counted_quantity: string | number | null;
  stock_before_count: string | number | null;
  replaces_movement_id: string | null;
  transfer_item_id: string | null;
  is_voided: boolean;
  void_reason: string | null;
  created_at: string;
  voided_at: string | null;
}
export interface TransferItem {
  transfer_item_id: string;
  transfer_id: string;
  product_id: string;
  qty_sent: string | number;
  received_in_full: boolean | null;
  actual_qty_received: string | number | null;
  receipt_notes: string | null;
  dispose_all: boolean | null;
  usable_qty: string | number | null;
  disposal_notes: string | null;
}
export interface Transfer {
  transfer_id: string;
  transfer_type: 'dispatch' | 'return';
  origin_location_id: string;
  destination_location_id: string;
  dispatch_date: string;
  status: 'dispatched' | 'received' | 'voided';
  received_date: string | null;
  received_at: string | null;
  created_at: string;
  void_reason: string | null;
  replaces_transfer_id: string | null;
  items: TransferItem[];
}
export interface OutletProductLog {
  outlet_id: string;
  product_id: string;
  total_received_qty: string;
  total_returned_qty: string;
  net_available_qty: string;
  last_received_date: string | null;
  last_returned_date: string | null;
  updated_at: string;
}
export interface Context {
  account: Account;
  locations: Location[];
}
export type ActionResult =
  { ok: true; message: string; id?: string } | { ok: false; message: string };
export const isAdmin = (role: Role) => role === 'owner' || role === 'manager';
export const statusLabels = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half-day',
  holiday: 'Holiday',
  not_marked: 'Not marked',
};
export const categoryLabels: Record<Category, string> = {
  grocery: 'Grocery',
  vegetables: 'Vegetables',
  sweets_savouries: 'Sweets / savouries',
};
export const movementLabels = {
  opening_stock: 'Opening stock',
  purchase_received: 'Purchase received',
  production_received: 'Sweets/Savouries Produced',
  used: 'Used',
  disposed: 'Disposed',
  adjustment: 'Stock adjustment',
  transfer_out: 'Sent to outlet',
  return_received: 'Return received',
};
export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  store_supervisor: 'Store supervisor',
  outlet_supervisor: 'Outlet supervisor',
};
