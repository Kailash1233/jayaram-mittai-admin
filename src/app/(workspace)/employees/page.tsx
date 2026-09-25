import { Employees } from '@/components/employees';
import { allRows, requireAdmin } from '@/lib/data';
export default async function EmployeesPage() {
  const context = await requireAdmin();
  const employees = await allRows('employees');
  return <Employees context={context} employees={employees} />;
}
