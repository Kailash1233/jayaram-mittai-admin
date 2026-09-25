import { Transfers } from '@/components/transfers';
import { balances, outletProductLogs, requireContext, transferProducts, transfers } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TransfersPage() {
  const context = await requireContext();
  const central =
    context.locations.find((l) => l.location_type === 'central_store' && l.is_active)
      ?.location_id ?? '';
  const [stockBalances, catalogProducts, batches, outletLogs] = await Promise.all([
    central ? balances(central).catch(() => []) : Promise.resolve([]),
    transferProducts(),
    transfers(),
    outletProductLogs(),
  ]);
  const stockMap = new Map(stockBalances.map((s) => [s.product_id, s.quantity]));
  const products = catalogProducts.map((p) => ({
    ...p,
    quantity: stockMap.get(p.product_id) ?? '0',
  }));
  return (
    <Transfers
      context={context}
      batches={batches}
      products={products}
      outletLogs={outletLogs}
    />
  );
}
