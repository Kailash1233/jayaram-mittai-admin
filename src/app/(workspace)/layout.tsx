import { Shell } from '@/components/shell';
import { requireContext } from '@/lib/data';
export const dynamic = 'force-dynamic';
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const context = await requireContext();
  return <Shell context={context}>{children}</Shell>;
}
