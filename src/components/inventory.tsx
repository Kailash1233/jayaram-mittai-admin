'use client';
import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import {
  Plus,
  Search,
  ArrowUpRight,
  SlidersHorizontal,
  ArrowDownLeft,
  Sparkles,
  Flame,
  Truck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import {
  categoryLabels,
  isAdmin,
  movementLabels,
  type Balance,
  type Context,
  type Movement,
  type MovementType,
  type Product,
} from '@/lib/model';
import { dateLabel, money, qty, todayIndia } from '@/lib/business';
import { movementSchema, productSchema } from '@/lib/validation';
import { saveMovement, saveProduct, voidMovement } from '@/lib/actions';
import {
  ActionNotice,
  Empty,
  Field,
  Modal,
  Notice,
  ReasonDialog,
  Stat,
  Submit,
  useMutation,
} from './ui';
type EditMovement = { product?: string; type: MovementType; original?: Movement };
export function Inventory({
  context,
  balances,
  movements,
  location,
  preview = false,
}: {
  context: Context;
  balances: Balance[];
  movements: Movement[];
  location: string;
  preview?: boolean;
}) {
  const admin = isAdmin(context.account.user_role);
  const [view, setView] = useState('stock');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [product, setProduct] = useState<Product | null | undefined>();
  const [entry, setEntry] = useState<EditMovement | null>(null);
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const list = balances.filter(
    (p) =>
      (showInactive || p.is_active) &&
      (!category || p.category === category) &&
      p.product_name.toLowerCase().includes(search.toLowerCase()),
  );
  const names = new Map(balances.map((p) => [p.product_id, p]));
  const history = movements
    .filter(
      (m) =>
        (!type || m.movement_type === type) &&
        (!from || m.movement_date >= from) &&
        (!to || m.movement_date <= to) &&
        (!category || names.get(m.product_id)?.category === category) &&
        (names.get(m.product_id)?.product_name ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.movement_date.localeCompare(a.movement_date) || b.created_at.localeCompare(a.created_at),
    );
  const pageRows = history.slice(page * 20, page * 20 + 20);
  const purchaseCost = movements
    .filter(
      (m) =>
        !m.is_voided &&
        m.movement_type === 'purchase_received' &&
        m.movement_date.slice(0, 7) === todayIndia().slice(0, 7),
    )
    .reduce((s, m) => s.plus(m.total_cost ?? 0), new Decimal(0));
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">CENTRAL STORE</div>
          <h1>Inventory</h1>
          <p>Know what’s in store. Keep every movement accounted for.</p>
        </div>
        <div className="page-actions flow-action-group">
          <button
            className="button flow-green"
            disabled={!location || !balances.some((p) => p.is_active)}
            onClick={() => setEntry({ type: 'purchase_received' })}
            title="Log Purchases Received"
          >
            <ArrowDownLeft size={15} />
            Purchases received
          </button>
          <button
            className="button flow-blue"
            disabled={!location || !balances.some((p) => p.is_active)}
            onClick={() => setEntry({ type: 'production_received' })}
            title="Log Sweets/Savouries Produced"
          >
            <Sparkles size={15} />
            Sweets/Savouries Produced
          </button>
          <button
            className="button flow-violet"
            disabled={!location || !balances.some((p) => p.is_active)}
            onClick={() => setEntry({ type: 'used' })}
            title="Log Used in Store/Kitchen"
          >
            <Flame size={15} />
            Used
          </button>
          <Link
            className="button flow-orange"
            href={preview ? '/preview?view=transfers' : '/transfers'}
            title="Log Sent to Stores / Dispatches"
          >
            <Truck size={15} />
            Sent to stores
          </Link>
          <button
            className="button flow-red"
            disabled={!location || !balances.some((p) => p.is_active)}
            onClick={() => setEntry({ type: 'disposed' })}
            title="Log Disposal"
          >
            <Trash2 size={15} />
            Disposal
          </button>
          {admin && (
            <>
              <button
                className="button small"
                disabled={!location || !balances.some((p) => p.is_active)}
                onClick={() => setEntry({ type: 'opening_stock' })}
                title="Log Opening Stock (Admin)"
              >
                Opening stock
              </button>
              <button
                className="button small"
                disabled={!location || !balances.some((p) => p.is_active)}
                onClick={() => setEntry({ type: 'adjustment' })}
                title="Stock Adjustment (Admin)"
              >
                Stock adjustment
              </button>
            </>
          )}
          <button className="button small" onClick={() => setProduct(null)} title="Add a new catalog product">
            <Plus size={14} />
            Add product
          </button>
        </div>
      </header>
      {!location && (
        <Notice message="The central store location has not been set up. Add it in Supabase before recording inventory." />
      )}
      <div className="stats">
        <Stat
          label="Active products"
          value={balances.filter((p) => p.is_active).length}
          note="Across the central catalog"
        />
        <Stat
          label="Products in stock"
          value={balances.filter((p) => p.is_active && new Decimal(p.quantity).gt(0)).length}
          note="Positive available balance"
        />
        <Stat
          label="Out of stock"
          value={balances.filter((p) => p.is_active && new Decimal(p.quantity).isZero()).length}
          note="No stock currently available"
        />
        <Stat
          label="Purchases this month"
          value={money(purchaseCost.toString())}
          note="Total recorded purchase cost"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{view === 'stock' ? 'Stock overview' : 'Movement history'}</h2>
            <p>
              {context.locations.find((l) => l.location_id === location)?.location_name ??
                'Central store'}{' '}
              · Fixed units, traceable changes
            </p>
          </div>
          <div className="actions">
            <button
              className={`button small ${view === 'stock' ? 'primary' : ''}`}
              onClick={() => setView('stock')}
            >
              Current stock
            </button>
            <button
              className={`button small ${view === 'history' ? 'primary' : ''}`}
              onClick={() => setView('history')}
            >
              History
            </button>
          </div>
        </div>
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Find product"
              placeholder="Search products"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="toolbar-group">
            <select
              aria-label="Product category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All categories</option>
              {Object.entries(categoryLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {view === 'stock' ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Include inactive
              </label>
            ) : (
              <select
                aria-label="Movement type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All movements</option>
                {Object.entries(movementLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {view === 'stock' ? (
          list.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="numeric">Available stock</th>
                    <th>Status</th>
                    <th className="right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.product_id}>
                      <td>
                        <span className="cell-main">{p.product_name}</span>
                        <span className="cell-sub">Fixed unit · {p.unit}</span>
                      </td>
                      <td>{categoryLabels[p.category]}</td>
                      <td className="numeric cell-main">
                        {qty(p.quantity)} <span className="muted">{p.unit}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${!p.is_active ? '' : new Decimal(p.quantity).gt(0) ? 'green' : 'amber'}`}
                        >
                          {!p.is_active
                            ? 'Inactive'
                            : new Decimal(p.quantity).gt(0)
                              ? 'In stock'
                              : 'Out of stock'}
                        </span>
                      </td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          {p.is_active && (
                            <button
                              className="button small"
                              onClick={() =>
                                setEntry({ product: p.product_id, type: 'purchase_received' })
                              }
                            >
                              Manage stock
                            </button>
                          )}
                          <button className="text-link" onClick={() => setProduct(p)}>
                            Product details <ArrowUpRight size={12} style={{ display: 'inline' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Your product catalog starts here">
              Add a product, then record a purchase or opening stock.
            </Empty>
          )
        ) : (
          <>
            <div className="toolbar">
              <div className="toolbar-group">
                <input
                  type="date"
                  aria-label="History from"
                  value={from}
                  max={to || todayIndia()}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(0);
                  }}
                />
                <span className="muted">to</span>
                <input
                  type="date"
                  aria-label="History to"
                  value={to}
                  min={from}
                  max={todayIndia()}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <span className="field-hint">Voided entries remain visible for traceability</span>
            </div>
            {pageRows.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date / product</th>
                      <th>Movement</th>
                      <th className="numeric">Change</th>
                      <th className="numeric">Total cost</th>
                      <th>Notes / status</th>
                      {admin && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((m) => (
                      <tr key={m.movement_id}>
                        <td>
                          <span className="cell-main">{names.get(m.product_id)?.product_name}</span>
                          <span className="cell-sub">{dateLabel(m.movement_date)}</span>
                        </td>
                        <td>
                          {movementLabels[m.movement_type]}
                          <span className="cell-sub">Recorded {dateLabel(m.created_at)}</span>
                        </td>
                        <td
                          className={`numeric ${new Decimal(m.quantity_change).gt(0) ? 'quantity-positive' : 'quantity-negative'}`}
                        >
                          {new Decimal(m.quantity_change).gt(0) ? '+' : ''}
                          {qty(m.quantity_change)} {names.get(m.product_id)?.unit}
                        </td>
                        <td className="numeric">
                          {m.total_cost === null ? '—' : money(m.total_cost)}
                        </td>
                        <td>
                          {m.is_voided ? (
                            <span className="badge red">Voided</span>
                          ) : m.transfer_item_id ? (
                            <span className="badge">Transfer posting</span>
                          ) : (
                            <span className="badge green">Recorded</span>
                          )}
                          <span className="cell-sub">
                            {m.void_reason ||
                              m.reason ||
                              m.custom_purpose ||
                              m.usage_purpose?.replaceAll('_', ' ') ||
                              ''}
                          </span>
                        </td>
                        {admin && (
                          <td>
                            {!m.is_voided &&
                              (m.transfer_item_id ? (
                                <Link
                                  className="text-link"
                                  href={preview ? '/preview?view=transfers' : '/transfers'}
                                >
                                  Open transfers
                                </Link>
                              ) : (
                                <div className="actions">
                                  {(m.movement_type !== 'adjustment' ||
                                    m.movement_date === todayIndia()) && (
                                    <button
                                      className="text-link"
                                      onClick={() =>
                                        setEntry({
                                          product: m.product_id,
                                          type: m.movement_type as MovementType,
                                          original: m,
                                        })
                                      }
                                    >
                                      Correct
                                    </button>
                                  )}
                                  <button className="text-link" onClick={() => setVoiding(m)}>
                                    Void
                                  </button>
                                </div>
                              ))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No stock movements found">
                Record your first movement or adjust the filters.
              </Empty>
            )}
          </>
        )}
        <footer className="table-footer">
          <span>
            {view === 'stock'
              ? `${list.length} products · Quantities shown in each product’s unit`
              : `${history.length} movements · Page ${page + 1}`}
          </span>
          {view === 'history' && (
            <div className="actions">
              <button className="text-link" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button
                className="text-link"
                disabled={(page + 1) * 20 >= history.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </footer>
      </section>
      {admin && (
        <div className="actions section-gap">
          <button
            className="button"
            disabled={!location || !balances.length}
            onClick={() => setEntry({ type: 'opening_stock' })}
          >
            <Plus size={15} />
            Opening stock
          </button>
          <button
            className="button"
            disabled={!location || !balances.length}
            onClick={() => setEntry({ type: 'adjustment' })}
          >
            <SlidersHorizontal size={15} />
            Reconcile stock
          </button>
          <span className="field-hint">Admin tools · All changes keep a history</span>
        </div>
      )}
      {product !== undefined && (
        <ProductForm
          product={product}
          admin={admin}
          preview={preview}
          onClose={() => setProduct(undefined)}
        />
      )}
      {entry && (
        <MovementForm
          entry={entry}
          products={balances}
          location={location}
          admin={admin}
          preview={preview}
          onClose={() => setEntry(null)}
        />
      )}
      {voiding && (
        <ReasonDialog
          title="Void stock movement"
          description="The original entry stays in history. This change will be rejected if it would make stock negative on any affected date."
          onClose={() => setVoiding(null)}
          onSave={(reason) => voidMovement(voiding.movement_id, reason)}
          preview={preview}
        />
      )}
    </>
  );
}
function ProductForm({
  product,
  admin,
  preview,
  onClose,
}: {
  product: Product | null;
  admin: boolean;
  preview: boolean;
  onClose: () => void;
}) {
  const m = useMutation(preview);
  const readOnly = !!product && !admin;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      product_id: product?.product_id,
      product_name: product?.product_name ?? '',
      category: product?.category ?? 'grocery',
      unit: product?.unit ?? 'kg',
      is_active: product?.is_active ?? true,
    },
  });
  return (
    <Modal
      title={product ? 'Product details' : 'Add product'}
      subtitle="One product, one fixed unit. Stock is recorded separately."
      onClose={onClose}
      busy={m.pending}
    >
      <form
        className="form-body"
        onSubmit={handleSubmit((v) => m.execute(() => saveProduct(v), onClose))}
      >
        <Field label="Product name" error={errors.product_name?.message}>
          <input {...register('product_name')} readOnly={readOnly} placeholder="e.g. Sugar" />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select {...register('category')} disabled={readOnly}>
              {Object.entries(categoryLabels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fixed unit" hint="Cannot change once stock or transfer history exists.">
            <select {...register('unit')} disabled={readOnly}>
              {[
                ['kg', 'Kg'],
                ['litre', 'Litre'],
                ['gram', 'Gram'],
                ['piece', 'Piece'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {product && (
          <label className="checkbox">
            <input type="checkbox" {...register('is_active')} disabled={readOnly} />
            Active product
          </label>
        )}
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button className="button" type="button" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <Submit busy={m.pending}>{product ? 'Save changes' : 'Add product'}</Submit>
          )}
        </footer>
      </form>
    </Modal>
  );
}
function MovementForm({
  entry,
  products,
  location,
  admin,
  preview,
  onClose,
}: {
  entry: EditMovement;
  products: Balance[];
  location: string;
  admin: boolean;
  preview: boolean;
  onClose: () => void;
}) {
  const m = useMutation(preview);
  const old = entry.original;
  const [costAlertOpen, setCostAlertOpen] = useState(false);

  const initialProducts = products.filter((p) => {
    if (entry.type === 'production_received') return p.category === 'sweets_savouries';
    if (entry.type === 'used') return p.category !== 'sweets_savouries';
    return true;
  });
  const defaultProductId =
    entry.product ??
    initialProducts.find((p) => p.is_active)?.product_id ??
    products.find((p) => p.is_active)?.product_id ??
    '';

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      product_id: defaultProductId,
      location_id: location,
      movement_type: entry.type,
      movement_date: old?.movement_date ?? todayIndia(),
      quantity: old ? new Decimal(old.quantity_change).abs().toString() : '',
      total_cost:
        old?.total_cost === null || old?.total_cost === undefined ? '' : String(old.total_cost),
      usage_purpose: (old?.usage_purpose === 'restaurant_cooking'
        ? 'restaurant_cooking'
        : 'sweet_savoury_production') as 'sweet_savoury_production' | 'restaurant_cooking' | 'other',
      custom_purpose: old?.custom_purpose ?? '',
      reason: old?.reason ?? '',
      counted_quantity:
        old?.counted_quantity === null || old?.counted_quantity === undefined
          ? ''
          : String(old.counted_quantity),
      replaces_movement_id: old?.movement_id,
      correction_reason: '',
    },
  });

  const type = useWatch({ control, name: 'movement_type' });
  const productId = useWatch({ control, name: 'product_id' });

  const filteredProducts = products.filter((p) => {
    if (type === 'production_received') return p.category === 'sweets_savouries';
    if (type === 'used') return p.category !== 'sweets_savouries';
    return true;
  });
  const selectableProducts = filteredProducts.filter(
    (p) => p.is_active || p.product_id === old?.product_id,
  );

  useEffect(() => {
    if (!old && selectableProducts.length > 0 && !selectableProducts.some((p) => p.product_id === productId)) {
      setValue('product_id', selectableProducts[0].product_id);
    }
  }, [type, selectableProducts, productId, setValue, old]);

  const selected = products.find((p) => p.product_id === productId);

  const types = (Object.keys(movementLabels) as (keyof typeof movementLabels)[]).filter(
    (t) =>
      !['transfer_out', 'return_received'].includes(t) &&
      (admin || !['opening_stock', 'adjustment'].includes(t)),
  ) as ('opening_stock' | 'purchase_received' | 'production_received' | 'used' | 'disposed' | 'adjustment')[];

  const onSubmit = (v: any) => {
    if (type === 'purchase_received' && (!v.total_cost || String(v.total_cost).trim() === '')) {
      setCostAlertOpen(true);
      return;
    }
    m.execute(() => saveMovement(v), onClose);
  };

  const onInvalid = (fieldErrors: typeof errors) => {
    if (
      type === 'purchase_received' &&
      (fieldErrors.total_cost || !getValues('total_cost') || String(getValues('total_cost')).trim() === '')
    ) {
      setCostAlertOpen(true);
    }
  };

  return (
    <>
      <Modal
        title={old ? 'Correct stock movement' : 'Record stock movement'}
        subtitle={
          old
            ? 'The original will be voided and retained. A linked replacement is saved atomically.'
            : 'Record what changed in your central store.'
        }
        onClose={onClose}
        busy={m.pending}
      >
        <form
          className="form-body"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Movement type">
                <input type="hidden" {...register('movement_type')} />
                <div className="type-button-grid">
                  {types.map((t) => {
                    const isSelected = type === t;
                    const colorClass =
                      t === 'purchase_received'
                        ? 'selected-green'
                        : t === 'production_received'
                          ? 'selected-blue'
                          : t === 'used'
                            ? 'selected-violet'
                            : t === 'disposed'
                              ? 'selected-red'
                              : 'selected-default';
                    return (
                      <button
                        type="button"
                        key={t}
                        className={`type-button ${isSelected ? colorClass : ''}`}
                        disabled={!!old}
                        onClick={() => {
                          setValue('movement_type', t);
                          if (t === 'adjustment') setValue('movement_date', todayIndia());
                        }}
                      >
                        {movementLabels[t]}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <Field label="Date" error={errors.movement_date?.message}>
              <input
                type="date"
                max={todayIndia()}
                {...register('movement_date')}
                readOnly={type === 'adjustment'}
              />
            </Field>
            <div className="span-2">
              <Field label="Product" error={errors.product_id?.message}>
                <select {...register('product_id')} disabled={!!old}>
                  {selectableProducts.length === 0 ? (
                    <option value="">No matching products found</option>
                  ) : (
                    selectableProducts.map((p) => (
                      <option value={p.product_id} key={p.product_id}>
                        {p.product_name} · {p.unit}
                      </option>
                    ))
                  )}
                </select>
              </Field>
            </div>
            {type === 'adjustment' ? (
              <>
                <div className="count-display">
                  Recorded stock
                  <strong>
                    {qty(selected?.quantity ?? 0)} {selected?.unit}
                  </strong>
                  <small>Recalculated under lock when saved</small>
                </div>
                <Field
                  label={`Actual physical count (${selected?.unit ?? 'units'})`}
                  error={errors.counted_quantity?.message}
                >
                  <input {...register('counted_quantity')} inputMode="decimal" placeholder="0.000" />
                </Field>
              </>
            ) : (
              <Field
                label={`Quantity (${selected?.unit ?? 'units'})`}
                error={errors.quantity?.message}
              >
                <div className={['used', 'disposed'].includes(type) ? 'qty-with-available' : undefined}>
                  <input {...register('quantity')} inputMode="decimal" placeholder="0.000" />
                  {['used', 'disposed'].includes(type) && (
                    <div className="available-qty-badge">
                      <span className="available-qty-label">Available Qty:</span>
                      <strong className="available-qty-val">
                        {selected ? `${qty(selected.quantity)} ${selected.unit}` : '0'}
                      </strong>
                    </div>
                  )}
                </div>
              </Field>
            )}
            {['purchase_received', 'opening_stock'].includes(type) && (
              <Field
                label={
                  type === 'purchase_received'
                    ? 'Total cost (₹—not per unit) *'
                    : 'Total cost (₹—not per unit) · optional'
                }
                error={type === 'purchase_received' ? undefined : errors.total_cost?.message}
              >
                <input
                  {...register('total_cost')}
                  inputMode="decimal"
                  placeholder={
                    type === 'purchase_received'
                      ? 'Enter overall purchase price (₹)'
                      : 'Optional · leave blank if unknown'
                  }
                />
              </Field>
            )}
            {type === 'used' && (
              <Field label="Usage purpose">
                <select {...register('usage_purpose')}>
                  <option value="sweet_savoury_production">Sweet/Savoury production</option>
                  <option value="restaurant_cooking">Restaurant cooking</option>
                </select>
              </Field>
            )}
            {['disposed', 'adjustment'].includes(type) && (
              <div className="span-2">
                <Field
                  label={
                    type === 'adjustment' ? 'Reason for the difference' : 'Disposal reason · optional'
                  }
                  error={errors.reason?.message}
                >
                  <textarea {...register('reason')} />
                </Field>
              </div>
            )}
            {old && (
              <div className="span-2">
                <Field label="Reason for correction" error={errors.correction_reason?.message}>
                  <textarea {...register('correction_reason')} />
                </Field>
              </div>
            )}
          </div>
          {type === 'production_received' && (
            <Notice message="Log freshly produced sweets, savouries, or prepared batches. Ingredients used are recorded separately under Used." />
          )}
          {type === 'opening_stock' && (
            <Notice message="Record stock already held at go-live. Do not include purchases twice. One active opening entry is allowed per product/location." />
          )}
          <ActionNotice notice={m.notice} />
          <footer className="form-footer">
            <button className="button" type="button" onClick={onClose} disabled={m.pending}>
              Cancel
            </button>
            <Submit busy={m.pending}>{old ? 'Save correction' : 'Record movement'}</Submit>
          </footer>
        </form>
      </Modal>
      {costAlertOpen && (
        <Modal
          title="Price Required"
          subtitle="Mandatory field"
          onClose={() => setCostAlertOpen(false)}
        >
          <div className="form-body">
            <p style={{ margin: '1.25rem 0', fontSize: '1.05rem', fontWeight: 550, color: 'var(--ink)' }}>
              Kindly Enter the overll price for this product
            </p>
            <footer className="form-footer">
              <button
                type="button"
                className="button primary"
                autoFocus
                onClick={() => setCostAlertOpen(false)}
              >
                OK
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
}
