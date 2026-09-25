import { allRows, requireContext } from '@/lib/data';
import { attendanceDashboardWorkbook } from '@/lib/export';
import {
  previewContext,
  previewEmployees,
  previewAttendance,
  previewHolidays,
} from '@/lib/preview';
import { monthStart, reportRows, todayIndia } from '@/lib/business';
import type { Location, Employee, Attendance, Holiday } from '@/lib/model';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = todayIndia();
  const start = url.searchParams.get('start') || monthStart(now);
  const end = url.searchParams.get('end') || url.searchParams.get('date') || now;
  const filterLocation = url.searchParams.get('location') || '';
  const filterDepartment = url.searchParams.get('department') || '';
  const isPreview = url.searchParams.get('preview') === 'true';

  let locations: Location[] = [];
  let employees: Employee[] = [];
  let attendanceList: Attendance[] = [];
  let holidaysList: Holiday[] = [];

  if (isPreview) {
    locations = previewContext.locations;
    employees = previewEmployees;
    attendanceList = previewAttendance;
    holidaysList = previewHolidays;
  } else {
    try {
      const context = await requireContext();
      locations = context.locations;
      const [empData, attData, holData] = await Promise.all([
        allRows('employees'),
        allRows('employee_attendance', [
          { column: 'attendance_date', value: start, operator: 'gte' },
          { column: 'attendance_date', value: end, operator: 'lte' },
        ]),
        allRows('location_holidays'),
      ]);
      employees = empData;
      attendanceList = attData;
      holidaysList = holData;
    } catch {
      return Response.json({ error: 'Unauthorized or session expired' }, { status: 401 });
    }
  }

  // Calculate employee-level attendance rows for the date range
  const rRows = reportRows(
    employees,
    attendanceList,
    holidaysList,
    start,
    end,
    filterLocation,
    filterDepartment,
    now,
  );

  const dashboardRows = rRows.map((r) => ({
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    department: r.department,
    location_name: locations.find((l) => l.location_id === r.location_id)?.location_name ?? 'Branch',
    present: r.present,
    absent: r.absent,
    half_day: r.half_day,
    not_marked: r.not_marked,
    percentage: r.percentage,
  }));

  const locName = locations.find((l) => l.location_id === filterLocation)?.location_name;
  const file = await attendanceDashboardWorkbook(
    dashboardRows,
    start,
    end,
    locName,
    filterDepartment,
  );

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance-dashboard-${start}-to-${end}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
