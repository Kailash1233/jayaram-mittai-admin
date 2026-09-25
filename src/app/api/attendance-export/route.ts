import { allRows, requireAdmin } from '@/lib/data';
import { reportInput } from '@/lib/report-input';
import { employeeCode, reportRows } from '@/lib/business';
import { attendanceWorkbook } from '@/lib/export';
export async function GET(request: Request) {
  const context = await requireAdmin();
  const input = reportInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success)
    return Response.json({ error: input.error.issues[0].message }, { status: 400 });
  const q = input.data;
  const [employees, attendance, holidays] = await Promise.all([
    allRows('employees'),
    allRows('employee_attendance', [
      { column: 'attendance_date', value: q.start, operator: 'gte' },
      { column: 'attendance_date', value: q.end, operator: 'lte' },
    ]),
    allRows('location_holidays'),
  ]);
  const rows = reportRows(
    employees,
    attendance,
    holidays,
    q.start,
    q.end,
    q.location,
    q.department,
  ).filter((r) =>
    `${r.employee_name} ${employeeCode(r.employee_id)}`
      .toLowerCase()
      .includes(q.search.toLowerCase()),
  );
  const file = await attendanceWorkbook(rows, context.locations, q.start, q.end);
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance-${q.start}-${q.end}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
