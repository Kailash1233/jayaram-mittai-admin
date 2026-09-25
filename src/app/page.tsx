import { redirect } from 'next/navigation';
import { configured } from '@/lib/supabase';
import { requireContext } from '@/lib/data';
import { isAdmin } from '@/lib/model';

export default async function Home() {
  if (!configured()) redirect('/setup');
  const { account } = await requireContext();
  if (isAdmin(account.user_role)) {
    redirect('/dashboard');
  } else if (account.user_role === 'store_supervisor') {
    redirect('/inventory');
  } else {
    redirect('/transfers');
  }
}
