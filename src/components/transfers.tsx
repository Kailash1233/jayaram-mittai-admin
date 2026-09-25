'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { isAdmin, type Context, type Product, type Transfer, type OutletProductLog } from '@/lib/model';
import { dateLabel, qty, todayIndia } from '@/lib/business';
import { transferSchema, type TransferInput } from '@/lib/validation';
import { saveTransfer, voidTransfer } from '@/lib/actions';
import { SearchableProductSelect } from './searchable-select';
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
type FormState = {
  mode: 'create' | 'receive' | 'replace';
  type: 'dispatch' | 'return';
  batch?: Transfer;
};
export function Transfers({
  context,
  batches,
  products,
  outletLogs = [],
  preview = false,
}: {
  context: Context;
  batches: Transfer[];
  products: Product[];
  outletLogs?: OutletProductLog[];
  preview?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };
  const admin = isAdmin(context.account.user_role);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [location, setLocation] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [voiding, setVoiding] = useState<Transfer | null>(null);
  const names = new Map(context.locations.map((l) => [l.location_id, l.location_name]));
  const shown = batches.filter(
    (b) =>
      (!type || b.transfer_type === type) &&
      (!status || b.status === status) &&
      (!location || [b.origin_location_id, b.destination_location_id].includes(location)) &&
      (!direction ||
        (direction === 'incoming' ? b.destination_location_id : b.origin_location_id) ===
          context.account.location_id) &&
      (!from || b.dispatch_date >= from) &&
      (!to || b.dispatch_date <= to) &&
      `${b.transfer_id} ${names.get(b.origin_location_id)} ${names.get(b.destination_location_id)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pending = batches.filter((b) => b.status === 'dispatched');
  const canReceive = (b: Transfer) =>
    b.status === 'dispatched' &&
    (admin || b.destination_location_id === context.account.location_id);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">STORE & OUTLETS</div>
          <h1>Transfers</h1>
          <p>From dispatch to receipt. One clear record for every shipment.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh transfers"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {(admin || context.account.user_role === 'outlet_supervisor') && (
            <button
              className="button"
              disabled={!products.some((p) => p.is_active)}
              onClick={() => setForm({ mode: 'create', type: 'return' })}
            >
              <RotateCcw size={15} />
              New return
            </button>
          )}
          {(admin || context.account.user_role === 'store_supervisor') && (
            <button
              className="button primary"
              disabled={!products.some((p) => p.is_active)}
              onClick={() => setForm({ mode: 'create', type: 'dispatch' })}
            >
              <Plus size={16} />
              New dispatch
            </button>
          )}
        </div>
      </header>
      <div className="stats stats-two">
        <Stat
          label="Store dispatches"
          value={
            batches.filter((b) => b.transfer_type === 'dispatch' && b.status !== 'voided').length
          }
          note="Mixed products in each shipment"
        />
        <Stat
          label="Open returns"
          value={
            batches.filter((b) => b.transfer_type === 'return' && b.status !== 'voided').length
          }
          note={
            batches.filter((b) => b.transfer_type === 'return' && b.status === 'dispatched').length > 0
              ? `${batches.filter((b) => b.transfer_type === 'return' && b.status === 'dispatched').length} awaiting store receipt`
              : 'Independent return shipments'
          }
        />
      </div>
      {pending.some(canReceive) && (
        <Notice
          message={`${pending.filter(canReceive).length} incoming shipment${pending.filter(canReceive).length === 1 ? ' needs' : 's need'} a receipt checklist. Confirm the quantities that physically arrived.`}
        />
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Shipment register</h2>
            <p>Dispatches and independent returns, together</p>
          </div>
          <span className="badge">{shown.length} shipments</span>
        </div>
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Search shipments"
              placeholder="Location or shipment ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="toolbar-group">
            <select
              aria-label="Transfer type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All types</option>
              <option value="dispatch">Store dispatches</option>
              <option value="return">Outlet returns</option>
            </select>
            <select
              aria-label="Transfer status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              <option value="dispatched">Awaiting receipt</option>
              <option value="received">Received</option>
              <option value="voided">Voided</option>
            </select>
            {admin ? (
              <select
                aria-label="Transfer location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All locations</option>
                {context.locations.map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                aria-label="Transfer direction"
                value={direction}
                onChange={(e) => {
                  setDirection(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Incoming & outgoing</option>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            )}
          </div>
        </div>
        <div className="toolbar">
          <div className="toolbar-group">
            <input
              aria-label="Dispatch from date"
              type="date"
              value={from}
              max={to || todayIndia()}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
            />
            <span className="muted">to</span>
            <input
              aria-label="Dispatch to date"
              type="date"
              value={to}
              min={from}
              max={todayIndia()}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
            />
            <button
              type="button"
              className="button small"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh transfers log table"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <span className="field-hint">Returns are not linked to earlier deliveries</span>
        </div>
        {shown.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Route</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(page * 20, page * 20 + 20).map((b) => (
                  <tr key={b.transfer_id}>
                    <td>
                      <span className="cell-main">
                        {b.transfer_type === 'return' ? 'Return' : 'Dispatch'}{' '}
                        <span className="muted">#{b.transfer_id.slice(0, 8)}</span>
                      </span>
                      <span className="cell-sub">
                        {dateLabel(b.dispatch_date)}
                        {b.replaces_transfer_id ? ' · Corrected record' : ''}
                      </span>
                    </td>
                    <td>
                      <span className="transfer-route">
                        {names.get(b.origin_location_id)}
                        <ArrowRight size={13} />
                        {names.get(b.destination_location_id)}
                      </span>
                    </td>
                    <td>
                      {b.items.length} product{b.items.length !== 1 ? 's' : ''}
                    </td>
                    <td>
                      <span
                        className={`badge ${b.status === 'received' ? 'green' : b.status === 'voided' ? 'red' : 'amber'}`}
                      >
                        {b.status === 'dispatched'
                          ? 'Awaiting receipt'
                          : b.status === 'received'
                            ? 'Received'
                            : 'Voided'}
                      </span>
                    </td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end' }}>
                        {canReceive(b) && (
                          <button
                            className="button small primary"
                            onClick={() =>
                              setForm({ mode: 'receive', type: b.transfer_type, batch: b })
                            }
                          >
                            <CheckCheck size={14} />
                            Receive
                          </button>
                        )}
                        <button className="text-link" onClick={() => setDetail(b)}>
                          Details <ArrowUpRight size={12} style={{ display: 'inline' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No shipments found">
            Create a dispatch or return, or change the filters.
          </Empty>
        )}
        <footer className="table-footer">
          <span>
            Page {page + 1} · {shown.length} shipments
          </span>
          <div className="actions">
            <button className="text-link" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button
              className="text-link"
              disabled={(page + 1) * 20 >= shown.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
      {form && (
        <TransferForm
          state={form}
          context={context}
          products={products}
          outletLogs={outletLogs}
          preview={preview}
          onClose={() => {
            setForm(null);
            handleRefresh();
          }}
        />
      )}
      {detail && (
        <TransferDetail
          batch={detail}
          context={context}
          products={products}
          onClose={() => {
            setDetail(null);
            handleRefresh();
          }}
          onReceive={() => {
            setForm({ mode: 'receive', type: detail.transfer_type, batch: detail });
            setDetail(null);
          }}
          onCorrect={() => {
            setForm({ mode: 'replace', type: detail.transfer_type, batch: detail });
            setDetail(null);
          }}
          onVoid={() => {
            setVoiding(detail);
            setDetail(null);
          }}
        />
      )}
      {voiding && (
        <ReasonDialog
          title="Void shipment"
          description="The shipment and its automatic stock postings will be voided together. The change is rejected if it causes negative historical stock."
          onClose={() => {
            setVoiding(null);
            handleRefresh();
          }}
          onSave={(reason) => voidTransfer(voiding.transfer_id, reason)}
          preview={preview}
        />
      )}
    </>
  );
}
function TransferDetail({
  batch,
  context,
  products,
  onClose,
  onReceive,
  onCorrect,
  onVoid,
}: {
  batch: Transfer;
  context: Context;
  products: Product[];
  onClose: () => void;
  onReceive: () => void;
  onCorrect: () => void;
  onVoid: () => void;
}) {
  const admin = isAdmin(context.account.user_role);
  const canReceive =
    batch.status === 'dispatched' &&
    (admin || batch.destination_location_id === context.account.location_id);
  return (
    <Modal
      title={`${batch.transfer_type === 'return' ? 'Return' : 'Dispatch'} details`}
      subtitle={batch.transfer_id}
      wide
      onClose={onClose}
    >
      <div className="form-body">
        <div className="detail-summary">
          <div>
            <span>From</span>
            <strong>
              {
                context.locations.find((l) => l.location_id === batch.origin_location_id)
                  ?.location_name
              }
            </strong>
          </div>
          <div>
            <span>To</span>
            <strong>
              {
                context.locations.find((l) => l.location_id === batch.destination_location_id)
                  ?.location_name
              }
            </strong>
          </div>
          <div>
            <span>Dispatched</span>
            <strong>
              {dateLabel(batch.dispatch_date)} · {batch.status}
            </strong>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="numeric">Sent</th>
                <th className="numeric">Actual</th>
                <th className="numeric">Shortage</th>
                {batch.transfer_type === 'return' && (
                  <>
                    <th className="numeric">Usable</th>
                    <th className="numeric">Disposed</th>
                  </>
                )}
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {batch.items.map((i) => {
                const p = products.find((p) => p.product_id === i.product_id);
                return (
                  <tr key={i.transfer_item_id}>
                    <td className="cell-main">
                      {p?.product_name}
                      <span className="cell-sub">{p?.unit}</span>
                    </td>
                    <td className="numeric">{qty(i.qty_sent)}</td>
                    <td className="numeric">
                      {i.actual_qty_received === null ? 'Pending' : qty(i.actual_qty_received)}
                    </td>
                    <td className="numeric">
                      {i.actual_qty_received === null
                        ? '—'
                        : qty(new Decimal(i.qty_sent).minus(i.actual_qty_received).toString())}
                    </td>
                    {batch.transfer_type === 'return' && (
                      <>
                        <td className="numeric">
                          {i.usable_qty === null ? '—' : qty(i.usable_qty)}
                        </td>
                        <td className="numeric">
                          {i.actual_qty_received === null || i.usable_qty === null
                            ? '—'
                            : qty(
                                new Decimal(i.actual_qty_received).minus(i.usable_qty).toString(),
                              )}
                        </td>
                      </>
                    )}
                    <td>
                      {i.receipt_notes || '—'}
                      {i.disposal_notes && (
                        <span className="cell-sub">Handling: {i.disposal_notes}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          Recorded {dateLabel(batch.created_at)}
          {batch.received_date ? ` · Receipt dated ${dateLabel(batch.received_date)}` : ''}
          {batch.received_at ? ` · Confirmed ${dateLabel(batch.received_at)}` : ''}
        </p>
        {batch.replaces_transfer_id && (
          <Notice
            message={`Correction of shipment ${batch.replaces_transfer_id}. The original remains in history.`}
          />
        )}
        <Notice
          kind="error"
          message={batch.void_reason ? `Void reason: ${batch.void_reason}` : undefined}
        />
        <footer className="form-footer">
          {admin && batch.status !== 'voided' && (
            <>
              <button className="button danger" onClick={onVoid}>
                Void shipment
              </button>
              <button className="button" onClick={onCorrect}>
                Correct record
              </button>
            </>
          )}
          {canReceive && (
            <button className="button primary" onClick={onReceive}>
              Confirm receipt
            </button>
          )}
          <button className="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </Modal>
  );
}
function blankItem(product_id = ''): TransferInput['items'][number] {
  return {
    product_id,
    qty_sent: '',
    received_in_full: true,
    actual_qty_received: '',
    receipt_notes: '',
    dispose_all: true,
    usable_qty: '',
    disposal_notes: '',
  };
}
function TransferForm({
  state,
  context,
  products,
  outletLogs = [],
  preview,
  onClose,
}: {
  state: FormState;
  context: Context;
  products: Product[];
  outletLogs?: OutletProductLog[];
  preview: boolean;
  onClose: () => void;
}) {
  const admin = isAdmin(context.account.user_role);
  const batch = state.batch;
  const receipt =
    state.mode === 'receive' || (state.mode === 'replace' && batch?.status === 'received');
  const central =
    context.locations.find((l) => l.location_type === 'central_store' && l.is_active)
      ?.location_id ?? '';
  const outlet =
    context.locations.find((l) => l.location_type === 'outlet' && l.is_active)?.location_id ?? '';
  const m = useMutation(preview);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      action: state.mode,
      transfer_id: batch?.transfer_id,
      transfer_type: state.type,
      origin_location_id:
        batch?.origin_location_id ??
        (admin
          ? state.type === 'dispatch'
            ? central
            : outlet
          : (context.account.location_id ?? '')),
      destination_location_id:
        batch?.destination_location_id ?? (state.type === 'dispatch' ? outlet : central),
      dispatch_date: batch?.dispatch_date ?? todayIndia(),
      received_date: receipt
        ? state.mode === 'receive'
          ? todayIndia()
          : (batch?.received_date ?? todayIndia())
        : '',
      reason: '',
      items: batch
        ? batch.items.map((i) => ({
            product_id: i.product_id,
            qty_sent: String(i.qty_sent),
            received_in_full: i.received_in_full ?? true,
            actual_qty_received:
              i.actual_qty_received === null ? '' : String(i.actual_qty_received),
            receipt_notes: i.receipt_notes ?? '',
            dispose_all: i.dispose_all ?? true,
            usable_qty: i.usable_qty === null ? '' : String(i.usable_qty),
            disposal_notes: i.disposal_notes ?? '',
          }))
        : [blankItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const values = useWatch({ control, name: 'items' });
  const dispatchDate = useWatch({ control, name: 'dispatch_date' });
  const originLocationId = useWatch({ control, name: 'origin_location_id' });
  const selected = new Set(values.map((i) => i.product_id));
  return (
    <Modal
      wide
      title={
        state.mode === 'receive'
          ? state.type === 'return'
            ? 'Receive outlet return'
            : 'Receive shipment'
          : state.mode === 'replace'
            ? 'Correct shipment'
            : state.type === 'return'
              ? 'New outlet return'
              : 'New store dispatch'
      }
      subtitle={
        state.type === 'return'
          ? 'An independent return. No earlier delivery reference is needed.'
          : 'Grocery, vegetables and sweets can travel in one shipment.'
      }
      onClose={onClose}
      busy={m.pending}
    >
      <form
        className="form-body"
        onSubmit={handleSubmit((v) => m.execute(() => saveTransfer(v), onClose))}
      >
        <div className="form-grid">
          {state.type === 'dispatch' ? (
            <Field label="From" hint="Dispatches always originate from Central Store">
              <input type="hidden" {...register('origin_location_id')} />
              <input
                type="text"
                readOnly
                disabled
                value={
                  context.locations.find((l) => l.location_id === central)?.location_name ??
                  'Central store'
                }
              />
            </Field>
          ) : (
            <Field label="From" error={errors.origin_location_id?.message}>
              <select {...register('origin_location_id')} disabled={!!batch || !admin}>
                {context.locations
                  .filter((l) => l.location_type === 'outlet')
                  .map((l) => (
                    <option key={l.location_id} value={l.location_id}>
                      {l.location_name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="To" error={errors.destination_location_id?.message}>
            <select {...register('destination_location_id')} disabled={!!batch}>
              {context.locations
                .filter(
                  (l) =>
                    l.location_type === (state.type === 'dispatch' ? 'outlet' : 'central_store'),
                )
                .map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Dispatch date" error={errors.dispatch_date?.message}>
            <input
              type="date"
              max={todayIndia()}
              {...register('dispatch_date')}
              readOnly={state.mode === 'receive' || !admin}
            />
          </Field>
          {receipt && (
            <Field label="Receipt date" error={errors.received_date?.message}>
              <input
                type="date"
                min={dispatchDate}
                max={todayIndia()}
                {...register('received_date')}
                readOnly={!admin}
              />
            </Field>
          )}
        </div>
        {(!receipt || state.mode === 'replace') && (
          <div className="line-items">
            {fields.map((f, n) => {
              const selectedProduct = products.find((p) => p.product_id === values[n]?.product_id);
              const avail =
                selectedProduct && 'quantity' in selectedProduct
                  ? (selectedProduct as any).quantity
                  : null;
              const returnLog =
                state.type === 'return' && values[n]?.product_id && originLocationId
                  ? outletLogs.find(
                      (l) =>
                        l.outlet_id === originLocationId &&
                        l.product_id === values[n]?.product_id,
                    )
                  : null;
              const originalReturnQty =
                state.mode === 'replace' && state.type === 'return' && batch
                  ? (batch.items.find((i) => i.product_id === values[n]?.product_id)?.qty_sent ?? 0)
                  : 0;
              const maxReturnable = returnLog
                ? Math.max(0, Number(returnLog.net_available_qty) + Number(originalReturnQty))
                : 0;
              return (
                <div
                  className={`line-item ${state.type === 'dispatch' || state.type === 'return' ? 'has-available' : ''}`}
                  key={f.id}
                >
                  <Field
                    label={n === 0 ? 'Product' : ''}
                    error={errors.items?.[n]?.product_id?.message}
                  >
                    <input type="hidden" {...register(`items.${n}.product_id`)} />
                    <SearchableProductSelect
                      products={products.filter(
                        (p) =>
                          (p.is_active ||
                            batch?.items.some((i) => i.product_id === p.product_id)) &&
                          (!selected.has(p.product_id) || p.product_id === values[n]?.product_id),
                      )}
                      value={values[n]?.product_id || ''}
                      onChange={(productId) => {
                        setValue(`items.${n}.product_id`, productId, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                      hasError={!!errors.items?.[n]?.product_id}
                    />
                  </Field>
                  <Field
                    label={n === 0 ? 'Quantity' : ''}
                    error={errors.items?.[n]?.qty_sent?.message}
                  >
                    <div className={state.type === 'dispatch' || state.type === 'return' ? 'qty-with-available' : undefined}>
                      <input
                        {...register(`items.${n}.qty_sent`)}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                      {state.type === 'dispatch' && (
                        <div className="available-qty-badge">
                          <span className="available-qty-label">Available Qty:</span>
                          <strong className="available-qty-val">
                            {selectedProduct && avail !== null && avail !== undefined
                              ? `${qty(avail)} ${selectedProduct.unit}`
                              : '—'}
                          </strong>
                        </div>
                      )}
                      {state.type === 'return' && (
                        <div className="available-qty-badge">
                          <span className="available-qty-label">Max Returnable:</span>
                          <strong className="available-qty-val">
                            {selectedProduct
                              ? `${qty(maxReturnable)} ${selectedProduct.unit}`
                              : '—'}
                          </strong>
                        </div>
                      )}
                    </div>
                  </Field>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove product ${n + 1}`}
                    disabled={fields.length === 1}
                    onClick={() => remove(n)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <button className="button" type="button" onClick={() => append(blankItem())}>
              <Plus size={15} />
              Add another product
            </button>
          </div>
        )}
        {receipt && (
          <>
            <div className="actions">
              <h3>Receipt checklist</h3>
              {state.mode === 'receive' && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    values.forEach((_, n) => {
                      setValue(`items.${n}.received_in_full`, true);
                      setValue(`items.${n}.actual_qty_received`, '');
                    })
                  }
                >
                  Check all received
                </button>
              )}
            </div>
            {fields.map((f, n) => {
              const v = values[n] ?? blankItem();
              const p = products.find((p) => p.product_id === v?.product_id);
              let disposed = '—';
              try {
                const actual = v.received_in_full ? v.qty_sent : v.actual_qty_received;
                const remainder = actual
                  ? new Decimal(actual).minus(v.dispose_all ? 0 : v.usable_qty || 0)
                  : null;
                disposed = remainder?.gte(0) ? qty(remainder.toString()) : '—';
              } catch {
                /* Incomplete decimal input. */
              }
              return (
                <div className="receipt-card" key={f.id}>
                  <header>
                    <div>
                      <h3>{p?.product_name}</h3>
                      <span className="cell-sub">
                        Sent {v.qty_sent || '—'} {p?.unit}
                      </span>
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" {...register(`items.${n}.received_in_full`)} />
                      Received in full
                    </label>
                  </header>
                  <div className="receipt-grid">
                    <Field
                      label={`Actual Qty (${p?.unit})`}
                      error={errors.items?.[n]?.actual_qty_received?.message}
                    >
                      {v.received_in_full ? (
                        <input
                          key="full"
                          value={v.qty_sent}
                          readOnly
                          aria-label={`Actual quantity ${p?.product_name}`}
                        />
                      ) : (
                        <input
                          key="actual"
                          {...register(`items.${n}.actual_qty_received`)}
                          inputMode="decimal"
                          placeholder="Required, including 0"
                        />
                      )}
                    </Field>
                    <div>
                      <span className="badge">
                        {v.received_in_full ? 'Full quantity' : 'Exception'}
                      </span>
                    </div>
                    <Field label="Notes · optional">
                      <input
                        {...register(`items.${n}.receipt_notes`)}
                        placeholder="Receipt details"
                      />
                    </Field>
                  </div>
                  {state.type === 'return' && (
                    <div className="receipt-disposal">
                      <label className="checkbox">
                        <input type="checkbox" {...register(`items.${n}.dispose_all`)} />
                        Dispose all
                      </label>
                      <Field
                        label={`Usable Qty (${p?.unit})`}
                        error={errors.items?.[n]?.usable_qty?.message}
                      >
                        {v.dispose_all ? (
                          <input key="disposed" value="0" readOnly />
                        ) : (
                          <input
                            key="usable"
                            {...register(`items.${n}.usable_qty`)}
                            inputMode="decimal"
                            placeholder="Required"
                          />
                        )}
                      </Field>
                      <Field label="Handling notes · optional">
                        <input {...register(`items.${n}.disposal_notes`)} />
                      </Field>
                      <span className="field-hint">
                        Disposed: {disposed} {p?.unit}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        {state.mode === 'replace' && (
          <>
            <Notice message="The original shipment and postings will be voided. The corrected shipment is saved in the same transaction. Route and receipt stage stay the same." />
            <Field label="Correction reason" error={errors.reason?.message}>
              <textarea {...register('reason')} />
            </Field>
          </>
        )}
        {state.type === 'return' && receipt && (
          <Notice message="Only usable quantity returns to available stock. The rest is recorded as disposal; central stock is updated once." />
        )}
        {(errors.items?.message || errors.items?.root?.message) && (
          <Notice kind="error" message={errors.items.message ?? errors.items.root?.message} />
        )}
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button className="button" type="button" onClick={onClose} disabled={m.pending}>
            Cancel
          </button>
          <Submit busy={m.pending}>
            {state.mode === 'replace'
              ? 'Save correction'
              : receipt
                ? 'Confirm receipt'
                : 'Dispatch shipment'}
          </Submit>
        </footer>
      </form>
    </Modal>
  );
}
