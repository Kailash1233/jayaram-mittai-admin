import { Inventory } from '@/components/inventory';
import { allRows, balances, requireInventory } from '@/lib/data';
export default async function InventoryPage() {
  const context = await requireInventory();
  const location =
    context.locations.find((l) => l.location_type === 'central_store' && l.is_active)
      ?.location_id ?? '';
  const [stock, movements] = await Promise.all([
    balances(location),
    allRows('inventory_movements'),
  ]);
  return <Inventory context={context} balances={stock} movements={movements} location={location} />;
}
