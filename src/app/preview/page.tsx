import { Shell } from '@/components/shell';
import { Dashboard } from '@/components/dashboard';
import { Employees } from '@/components/employees';
import { AttendanceWorkspace } from '@/components/attendance';
import { Inventory } from '@/components/inventory';
import { Transfers } from '@/components/transfers';
import { UserAccess } from '@/components/users';
import {
  previewContext as context,
  previewAccounts,
  previewAttendance,
  previewEmployees,
  previewHolidays,
  previewMovements,
  previewRoster,
  previewStock,
  previewTransfers,
} from '@/lib/preview';
import { monthStart, todayIndia } from '@/lib/business';
export const dynamic = 'force-dynamic';
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; role?: string }>;
}) {
  const { view = 'dashboard', role } = await searchParams;
  const activeContext = role
    ? {
        ...context,
        account: {
          ...context.account,
          user_role: role as any,
          display_name: `${role.replace('_', ' ')} preview`,
        },
      }
    : context;
  const location = activeContext.locations[0].location_id;
  let screen;
  switch (view) {
    case 'employees':
      screen = <Employees context={activeContext} employees={previewEmployees} preview />;
      break;
    case 'inventory':
      screen = (
        <Inventory
          context={activeContext}
          balances={previewStock}
          movements={previewMovements}
          location={location}
          preview
        />
      );
      break;
    case 'transfers':
      screen = (
        <Transfers context={activeContext} batches={previewTransfers} products={previewStock} preview />
      );
      break;
    case 'admin/users':
      screen = (
        <UserAccess
          context={activeContext}
          accounts={previewAccounts}
          provisioningAvailable={false}
          preview
        />
      );
      break;
    case 'attendance':
      screen = (
        <AttendanceWorkspace
          context={activeContext}
          rows={previewRoster}
          employees={previewEmployees}
          attendance={previewAttendance}
          holidays={previewHolidays}
          date={todayIndia()}
          location={location}
          start={monthStart()}
          end={todayIndia()}
          preview
        />
      );
      break;
    case 'dashboard':
    default:
      screen = (
        <Dashboard
          context={activeContext}
          balances={previewStock}
          movements={previewMovements}
          transfers={previewTransfers}
          employees={previewEmployees}
          attendance={previewAttendance}
          holidays={previewHolidays}
          date={todayIndia()}
          preview
        />
      );
  }
  return (
    <Shell context={activeContext} preview view={view}>
      {screen}
    </Shell>
  );
}
