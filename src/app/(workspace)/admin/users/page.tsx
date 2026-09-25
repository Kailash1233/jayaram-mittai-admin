import { UserAccess } from '@/components/users';
import { allRows, requireAdmin } from '@/lib/data';
export default async function UsersPage() {
  const context = await requireAdmin();
  const accounts = await allRows('user_accounts');
  return (
    <UserAccess
      context={context}
      accounts={accounts}
      provisioningAvailable={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
    />
  );
}
