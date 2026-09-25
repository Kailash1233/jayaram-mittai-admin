import Decimal from 'decimal.js';
import type { Attendance, Employee, Holiday, Status } from './model';
export const todayIndia = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export const monthStart = (date = todayIndia()) => date.slice(0, 8) + '01';
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date.length === 10 ? date + 'T12:00:00+05:30' : date));
export const qty = (n: string | number) =>
  new Decimal(n)
    .toDecimalPlaces(3)
    .toNumber()
    .toLocaleString('en-IN', { maximumFractionDigits: 3 });
export const money = (n: string | number) =>
  new Decimal(n)
    .toDecimalPlaces(2)
    .toNumber()
    .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const employeeCode = (id: string) => `EMP_${id}`;
export function attendancePercentage(p: number, a: number, h: number): number | null {
  const denominator = p + a + h;
  return denominator
    ? new Decimal(p)
        .plus(new Decimal(h).times('.5'))
        .div(denominator)
        .times(100)
        .toDecimalPlaces(2)
        .toNumber()
    : null;
}
export function returnSplit(actual: string | number, usable: string | number) {
  const a = new Decimal(actual);
  const u = new Decimal(usable);
  if (!a.isFinite() || !u.isFinite() || u.lt(0) || a.lt(u))
    throw new Error('Usable quantity must be between zero and actual received.');
  return { disposed: a.minus(u).toFixed(3), net: u.toFixed(3) };
}
export interface ReportRow {
  employee_id: string;
  employee_name: string;
  department: string;
  location_id: string;
  present: number;
  absent: number;
  half_day: number;
  holiday: number;
  not_marked: number;
  estimated_days: number;
  percentage: number | null;
}
export function reportRows(
  employees: Employee[],
  attendance: Attendance[],
  holidays: Holiday[],
  start: string,
  end: string,
  location = '',
  department = '',
  now = todayIndia(),
): ReportRow[] {
  const until = end < now ? end : now;
  const marks = new Map(attendance.map((a) => [`${a.employee_id}/${a.attendance_date}`, a]));
  const calendar = new Set(holidays.map((h) => `${h.location_id}/${h.holiday_date}`));
  return employees
    .filter((e) => !department || e.department === department)
    .map((e) => {
      const row: ReportRow = {
        employee_id: e.employee_id,
        employee_name: e.employee_name,
        department: e.department,
        location_id: e.location_id,
        present: 0,
        absent: 0,
        half_day: 0,
        holiday: 0,
        not_marked: 0,
        estimated_days: 0,
        percentage: null,
      };
      const from = start > e.joining_date ? start : e.joining_date;
      for (
        const d = new Date(from + 'T00:00:00Z');
        d.toISOString().slice(0, 10) <= until;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const day = d.toISOString().slice(0, 10);
        const mark = marks.get(`${e.employee_id}/${day}`);
        if (mark) {
          if (!location || mark.location_id === location) row[mark.attendance_status]++;
        } else if (e.is_active && (!location || e.location_id === location)) {
          if (calendar.has(`${e.location_id}/${day}`)) row.holiday++;
          else row.not_marked++;
          if (day < now) row.estimated_days++;
        }
      }
      row.percentage = attendancePercentage(row.present, row.absent, row.half_day);
      return row;
    })
    .filter((r) => r.present + r.absent + r.half_day + r.holiday + r.not_marked > 0);
}
export const isStoredStatus = (s: string): s is Status =>
  ['present', 'absent', 'half_day', 'holiday'].includes(s);
