import ExcelJS from 'exceljs';
import type { ReportRow } from './business';
import { employeeCode } from './business';
import type { Location } from './model';
export async function attendanceWorkbook(
  rows: ReportRow[],
  locations: Location[],
  start: string,
  end: string,
) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Jayaram Mittai Operations';
  const sheet = book.addWorksheet('Attendance', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Employee ID', key: 'id', width: 18 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Current department', key: 'dept', width: 22 },
    { header: 'Current location', key: 'location', width: 26 },
    ...[
      'Present',
      'Absent',
      'Half-day',
      'Holiday',
      'Not marked',
      'Estimated days',
      'Attendance %',
    ].map((header, i) => ({ header, key: `n${i}`, width: 18 })),
  ];
  for (const r of rows)
    sheet.addRow({
      id: employeeCode(r.employee_id),
      name: r.employee_name,
      dept: r.department,
      location: locations.find((l) => l.location_id === r.location_id)?.location_name ?? '',
      n0: r.present,
      n1: r.absent,
      n2: r.half_day,
      n3: r.holiday,
      n4: r.not_marked,
      n5: r.estimated_days,
      n6: r.percentage ?? 'N/A',
    });
  sheet.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E282E' } };
  });
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  const notes = book.addWorksheet('Report notes');
  notes.getColumn(1).width = 110;
  notes.addRows([
    [`Date range: ${start} to ${end}`],
    [
      `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (Asia/Kolkata)`,
    ],
    ['Present=1; half-day=0.5. Holiday and Not marked excluded from percentage.'],
    [
      'Missing historical days use current-roster estimates, not reconstructed branch/employment history.',
    ],
    [
      'Saved attendance uses its recorded branch. Name/department/current location reflect the current employee card.',
    ],
    ['Inactive employees retain saved history but do not receive estimated missing days.'],
  ]);
  return book.xlsx.writeBuffer();
}

export interface DashboardEmployeeRow {
  employee_id: string;
  employee_name: string;
  department: string;
  location_name: string;
  present: number;
  absent: number;
  half_day: number;
  not_marked: number;
  percentage: number | null;
}

export async function attendanceDashboardWorkbook(
  rows: DashboardEmployeeRow[],
  start: string,
  end: string,
  filterLocationName?: string,
  filterDepartment?: string,
) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Jayaram Mittai Operations';

  // Sheet 1: Employee Attendance Details (the dashboard table!)
  const sheet = book.addWorksheet('Employee Attendance', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Employee ID', key: 'id', width: 18 },
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'Branch / Location', key: 'location', width: 26 },
    { header: 'Department', key: 'dept', width: 22 },
    { header: 'Present Days', key: 'present', width: 16 },
    { header: 'Absent Days', key: 'absent', width: 16 },
    { header: 'Half Days', key: 'half_day', width: 15 },
    { header: 'Not Marked', key: 'not_marked', width: 15 },
    { header: 'Attendance %', key: 'percentage', width: 16 },
  ];

  for (const r of rows) {
    sheet.addRow({
      id: employeeCode(r.employee_id),
      name: r.employee_name,
      location: r.location_name,
      dept: r.department,
      present: r.present,
      absent: r.absent,
      half_day: r.half_day,
      not_marked: r.not_marked,
      percentage: r.percentage !== null ? `${r.percentage}%` : 'N/A',
    });
  }

  // Summary row at the bottom
  const totalPresent = rows.reduce((acc, r) => acc + r.present, 0);
  const totalAbsent = rows.reduce((acc, r) => acc + r.absent, 0);
  const totalHalfDay = rows.reduce((acc, r) => acc + r.half_day, 0);
  const totalNotMarked = rows.reduce((acc, r) => acc + r.not_marked, 0);
  const totalMarked = totalPresent + totalAbsent + totalHalfDay;
  const totalRate =
    totalMarked > 0 ? Math.round(((totalPresent + totalHalfDay * 0.5) / totalMarked) * 100) : null;

  const totalRow = sheet.addRow({
    id: 'TOTAL',
    name: `${rows.length} Employees`,
    location: filterLocationName || 'All Branches',
    dept: filterDepartment || 'All Departments',
    present: totalPresent,
    absent: totalAbsent,
    half_day: totalHalfDay,
    not_marked: totalNotMarked,
    percentage: totalRate !== null ? `${totalRate}%` : 'N/A',
  });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5EBEB' },
    };
  });

  sheet.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E282E' } };
  });
  sheet.autoFilter = { from: 'A1', to: 'I1' };

  // Sheet 2: Report Notes
  const notes = book.addWorksheet('Report Notes');
  notes.getColumn(1).width = 32;
  notes.getColumn(2).width = 65;
  notes.addRows([
    ['Report Name', 'Jayaram Mittai Operations - Staff Attendance Detail Dashboard'],
    ['Date Range', `${start} to ${end}`],
    ['Location Filter', filterLocationName || 'All locations'],
    ['Department Filter', filterDepartment || 'All departments'],
    [
      'Generated At',
      `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (Asia/Kolkata)`,
    ],
    ['Calculation Basis', 'Present = 1.0, Half-day = 0.5. Percentage based on marked attendance.'],
  ]);
  notes.getRow(1).font = { bold: true };

  return book.xlsx.writeBuffer();
}
