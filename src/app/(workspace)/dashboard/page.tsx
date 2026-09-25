import { Dashboard } from '@/components/dashboard';
import { allRows, balances, requireAdmin, transfers } from '@/lib/data';
import { monthStart, todayIndia } from '@/lib/business';

export default async function DashboardPage() {
  const context = await requireAdmin();
  const central =
    context.locations.find((l) => l.location_type === 'central_store' && l.is_active)
      ?.location_id ?? '';
  const date = todayIndia();
  const start = monthStart(date);

  const [stock, movementsList, transfersList, employeesList, attendanceList, holidaysList] =
    await Promise.all([
      balances(central),
      allRows('inventory_movements'),
      transfers(),
      allRows('employees'),
      allRows('employee_attendance', [
        { column: 'attendance_date', value: start, operator: 'gte' },
        { column: 'attendance_date', value: date, operator: 'lte' },
      ]),
      allRows('location_holidays'),
    ]);

  return (
    <Dashboard
      context={context}
      balances={stock}
      movements={movementsList}
      transfers={transfersList}
      employees={employeesList}
      attendance={attendanceList}
      holidays={holidaysList}
      date={date}
    />
  );
}
