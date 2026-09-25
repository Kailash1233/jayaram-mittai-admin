import { AttendanceWorkspace } from '@/components/attendance';
import { allRows, requireContext, roster } from '@/lib/data';
import { isAdmin } from '@/lib/model';
import { pastDate } from '@/lib/validation';
import { reportInput } from '@/lib/report-input';
import { todayIndia } from '@/lib/business';
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requireContext();
  const q = await searchParams;
  const day = pastDate.safeParse(q.date);
  const date = day.success ? day.data : todayIndia();
  const report = reportInput.safeParse({ start: q.start, end: q.end });
  const range = report.success ? report.data : reportInput.parse({});
  const admin = isAdmin(context.account.user_role);
  const location = admin
    ? context.locations.some((l) => l.location_id === q.location)
      ? q.location!
      : (context.locations.find((l) => l.is_active)?.location_id ?? '')
    : (context.account.location_id ?? '');
  const [rows, employees, attendance, holidays] = await Promise.all([
    roster(date, location),
    admin ? allRows('employees') : [],
    admin
      ? allRows('employee_attendance', [
          { column: 'attendance_date', value: range.start, operator: 'gte' },
          { column: 'attendance_date', value: range.end, operator: 'lte' },
        ])
      : [],
    admin ? allRows('location_holidays') : [],
  ]);
  return (
    <AttendanceWorkspace
      context={context}
      rows={rows}
      employees={employees}
      attendance={attendance}
      holidays={holidays}
      date={date}
      location={location}
      start={range.start}
      end={range.end}
    />
  );
}
