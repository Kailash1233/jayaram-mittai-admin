'use client';
import { useState } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import {
  CalendarCheck2,
  Package,
  ArrowUpRight,
  Search,
  Download,
  Truck,
} from 'lucide-react';
import {
  isAdmin,
  type Context,
  type Balance,
  type Movement,
  type Transfer,
  type Employee,
  type Attendance,
  type Holiday,
} from '@/lib/model';
import {
  dateLabel,
  qty,
  todayIndia,
  monthStart,
  reportRows,
  employeeCode,
} from '@/lib/business';
import { Empty } from './ui';

export function Dashboard({
  context,
  balances,
  movements,
  transfers,
  employees,
  attendance,
  holidays,
  date = todayIndia(),
  preview = false,
}: {
  context: Context;
  balances: Balance[];
  movements: Movement[];
  transfers: Transfer[];
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  date?: string;
  preview?: boolean;
}) {
  const admin = isAdmin(context.account.user_role);
  if (!admin) {
    return (
      <div className="panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
          The Operations Dashboard is strictly reserved for Administrators.
        </p>
      </div>
    );
  }

  // Top 3 options toggle: Attendance, Inventory, Transfers
  const [activeTab, setActiveTab] = useState<'attendance' | 'inventory' | 'transfers'>('attendance');

  // =========================================================================
  // 1. ATTENDANCE TAB STATE & LOGIC (Table Alone - KPI Cards Removed)
  // =========================================================================
  const [attendanceStartDate, setAttendanceStartDate] = useState(monthStart(date));
  const [attendanceEndDate, setAttendanceEndDate] = useState(date);
  const [attendanceLocation, setAttendanceLocation] = useState('');
  const [attendanceDepartment, setAttendanceDepartment] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');

  const activeEmployees = employees.filter((e) => e.is_active);
  const departments = Array.from(new Set(activeEmployees.map((e) => e.department))).filter(Boolean);

  const allReportRows = reportRows(
    employees,
    attendance,
    holidays,
    attendanceStartDate,
    attendanceEndDate,
    attendanceLocation,
    attendanceDepartment,
    todayIndia(),
  );

  const filteredReportRows = allReportRows.filter((r) => {
    if (!attendanceSearch) return true;
    const q = attendanceSearch.toLowerCase();
    return (
      r.employee_name.toLowerCase().includes(q) ||
      employeeCode(r.employee_id).toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // 2. INVENTORY TAB STATE & LOGIC (Month-Wise Quantity Comparison Bar Graph)
  // =========================================================================
  // Default to past 6 months up to current date
  const [invStartDate, setInvStartDate] = useState(() => {
    const d = new Date(date + 'T12:00:00+05:30');
    d.setMonth(d.getMonth() - 5);
    return d.toISOString().slice(0, 7) + '-01';
  });
  const [invEndDate, setInvEndDate] = useState(date);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Generate list of distinct months (YYYY-MM) between invStartDate and invEndDate
  const invMonths: string[] = [];
  const startMonthDate = new Date(invStartDate.slice(0, 7) + '-01T00:00:00Z');
  const endMonthDate = new Date(invEndDate.slice(0, 7) + '-01T00:00:00Z');
  for (let m = new Date(startMonthDate); m <= endMonthDate; m.setUTCMonth(m.getUTCMonth() + 1)) {
    invMonths.push(m.toISOString().slice(0, 7));
  }
  if (invMonths.length === 0) invMonths.push(date.slice(0, 7));

  // Filter movements within date range and product
  const validMovements = movements.filter((m) => !m.is_voided);

  // Month-wise data points
  const monthData = invMonths.map((mStr) => {
    const monthMoves = validMovements.filter((m) => {
      if (m.movement_date < invStartDate || m.movement_date > invEndDate) return false;
      if (m.movement_date.slice(0, 7) !== mStr) return false;
      if (selectedProductId && m.product_id !== selectedProductId) return false;
      return true;
    });

    const procured = monthMoves
      .filter((m) => m.movement_type === 'purchase_received')
      .reduce((s, m) => s.plus(m.quantity_change), new Decimal(0));

    const wasted = monthMoves
      .filter((m) => m.movement_type === 'disposed')
      .reduce((s, m) => s.plus(new Decimal(m.quantity_change).abs()), new Decimal(0));

    return {
      month: mStr,
      procured,
      wasted,
    };
  });

  // Overall totals for inventory in selected date range
  const totalProcuredQty = monthData.reduce((s, m) => s.plus(m.procured), new Decimal(0));
  const totalWastedQty = monthData.reduce((s, m) => s.plus(m.wasted), new Decimal(0));
  const maxMonthQty = Math.max(
    1,
    ...monthData.map((d) => Math.max(d.procured.toNumber(), d.wasted.toNumber())),
  );

  const selectedProduct = balances.find((p) => p.product_id === selectedProductId);
  const qtyUnit = selectedProduct ? selectedProduct.unit : 'units/kg';

  // =========================================================================
  // 3. TRANSFERS TAB STATE & LOGIC (Outlet Category Breakdown: Grocery, Veg, Sweets)
  // =========================================================================
  const [transferStartDate, setTransferStartDate] = useState(monthStart(date));
  const [transferEndDate, setTransferEndDate] = useState(date);
  const [selectedTransferProduct, setSelectedTransferProduct] = useState('');

  const productMap = new Map(balances.map((p) => [p.product_id, p]));

  // Dispatches in date range
  const validDispatches = transfers.filter(
    (t) =>
      t.transfer_type === 'dispatch' &&
      t.status !== 'voided' &&
      t.dispatch_date >= transferStartDate &&
      t.dispatch_date <= transferEndDate,
  );

  const outletLocations = context.locations.filter((l) => l.location_type === 'outlet' && l.is_active);

  const outletTransferStats = outletLocations.map((out) => {
    const outDispatches = validDispatches.filter((t) => t.destination_location_id === out.location_id);

    let groceryQty = new Decimal(0);
    let vegetableQty = new Decimal(0);
    let sweetQty = new Decimal(0);

    for (const t of outDispatches) {
      for (const item of t.items) {
        if (selectedTransferProduct && item.product_id !== selectedTransferProduct) continue;
        const prod = productMap.get(item.product_id);
        const q = new Decimal(item.qty_sent || 0);
        if (prod?.category === 'grocery') {
          groceryQty = groceryQty.plus(q);
        } else if (prod?.category === 'vegetables') {
          vegetableQty = vegetableQty.plus(q);
        } else if (prod?.category === 'sweets_savouries') {
          sweetQty = sweetQty.plus(q);
        } else {
          groceryQty = groceryQty.plus(q);
        }
      }
    }

    const totalSent = groceryQty.plus(vegetableQty).plus(sweetQty);

    return {
      location_id: out.location_id,
      location_name: out.location_name,
      groceryQty,
      vegetableQty,
      sweetQty,
      totalSent,
      dispatchCount: outDispatches.length,
    };
  });

  const grandGrocery = outletTransferStats.reduce((s, o) => s.plus(o.groceryQty), new Decimal(0));
  const grandVegetables = outletTransferStats.reduce((s, o) => s.plus(o.vegetableQty), new Decimal(0));
  const grandSweets = outletTransferStats.reduce((s, o) => s.plus(o.sweetQty), new Decimal(0));
  const grandTotalSent = outletTransferStats.reduce((s, o) => s.plus(o.totalSent), new Decimal(0));

  const navLink = (view: string) => (preview ? `/preview?view=${view}` : `/${view}`);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">EXECUTIVE OVERVIEW</div>
          <h1>Operations Dashboard</h1>
          <p>
            Key operational metrics for Staff Attendance, Store Inventory, and Outlet Transfers.
          </p>
        </div>
        {/* 3 top options: Attendance, Inventory, Transfers */}
        <div className="actions" style={{ gap: '8px' }}>
          <button
            type="button"
            className={`button ${activeTab === 'attendance' ? 'primary' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <CalendarCheck2 size={16} />
            Attendance
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'inventory' ? 'primary' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={16} />
            Inventory
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'transfers' ? 'primary' : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <Truck size={16} />
            Transfers
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 1. ATTENDANCE TAB VIEW (Table Alone - KPI Cards Removed)            */}
      {/* =================================================================== */}
      {activeTab === 'attendance' && (
        <>
          {/* Attendance Filters: Start date, End date, Location, Department, Search */}
          <div className="toolbar" style={{ marginBottom: '20px' }}>
            <div className="toolbar-group" style={{ flexWrap: 'wrap', gap: '16px', width: '100%', alignItems: 'flex-end' }}>
              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">Start date</span>
                <input
                  aria-label="Start date"
                  type="date"
                  value={attendanceStartDate}
                  max={attendanceEndDate}
                  onChange={(e) => setAttendanceStartDate(e.target.value)}
                />
              </label>

              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">End date</span>
                <input
                  aria-label="End date"
                  type="date"
                  value={attendanceEndDate}
                  min={attendanceStartDate}
                  max={todayIndia()}
                  onChange={(e) => setAttendanceEndDate(e.target.value)}
                />
              </label>

              <label className="field" style={{ minWidth: '180px' }}>
                <span className="field-label">Location</span>
                <select
                  aria-label="Location"
                  value={attendanceLocation}
                  onChange={(e) => setAttendanceLocation(e.target.value)}
                >
                  <option value="">All locations</option>
                  {context.locations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                    </option>
                  ))}
                </select>
              </label>

              {departments.length > 0 && (
                <label className="field" style={{ minWidth: '160px' }}>
                  <span className="field-label">Department</span>
                  <select
                    aria-label="Department"
                    value={attendanceDepartment}
                    onChange={(e) => setAttendanceDepartment(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="search" style={{ flex: 1, minWidth: '200px', height: '39px', marginBottom: '1px' }}>
                <Search size={15} />
                <input
                  placeholder="Search staff by name or code..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table Alone - KPI Cards Removed */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Employee Attendance Details</h2>
                <p>
                  Individual attendance tracking from {dateLabel(attendanceStartDate)} to {dateLabel(attendanceEndDate)}
                </p>
              </div>
              <div className="actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <a
                  className="button small"
                  href={`/api/attendance-dashboard-export?start=${attendanceStartDate}&end=${attendanceEndDate}&location=${attendanceLocation}&department=${encodeURIComponent(attendanceDepartment)}${preview ? '&preview=true' : ''}`}
                  download={`attendance-dashboard-${attendanceStartDate}-to-${attendanceEndDate}.xlsx`}
                  title="Download and export employee attendance table as Excel"
                >
                  <Download size={13} />
                  Export Excel
                </a>
                <Link className="button small primary" href={navLink('attendance')}>
                  Attendance workspace <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            {filteredReportRows.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Branch / Location</th>
                      <th>Department</th>
                      <th className="numeric">Present Days</th>
                      <th className="numeric">Absent Days</th>
                      <th className="numeric">Half Days</th>
                      <th className="numeric">Not Marked</th>
                      <th className="numeric">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReportRows.map((r) => {
                      const locName =
                        context.locations.find((l) => l.location_id === r.location_id)?.location_name ??
                        'Branch';
                      return (
                        <tr key={r.employee_id}>
                          <td>
                            <strong>{r.employee_name}</strong>
                            <div className="mono muted" style={{ fontSize: '12px' }}>
                              {employeeCode(r.employee_id)}
                            </div>
                          </td>
                          <td>
                            <span className="pill neutral">{locName}</span>
                          </td>
                          <td>{r.department}</td>
                          <td className="numeric" style={{ color: '#2b7a4b', fontWeight: 600 }}>
                            {r.present}
                          </td>
                          <td className="numeric" style={{ color: r.absent > 0 ? '#c92a2a' : '#888' }}>
                            {r.absent}
                          </td>
                          <td className="numeric" style={{ color: r.half_day > 0 ? '#d97706' : '#888' }}>
                            {r.half_day}
                          </td>
                          <td className="numeric" style={{ color: r.not_marked > 0 ? '#888' : '#bbb' }}>
                            {r.not_marked}
                          </td>
                          <td className="numeric">
                            {r.percentage !== null ? (
                              <span
                                className={`pill ${
                                  r.percentage >= 80 ? 'success' : r.percentage >= 50 ? 'warning' : 'danger'
                                }`}
                              >
                                {r.percentage}%
                              </span>
                            ) : (
                              <span className="pill neutral">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No staff records found">
                Adjust date range or filter criteria.
              </Empty>
            )}

            <footer className="table-footer">
              <span>
                Showing {filteredReportRows.length} employee(s) · {dateLabel(attendanceStartDate)} to {dateLabel(attendanceEndDate)}
              </span>
              <Link className="text-link" href={navLink('attendance')}>
                Open full attendance workspace &rarr;
              </Link>
            </footer>
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* 2. INVENTORY TAB VIEW: Month-Wise Quantity Bar Graph                */}
      {/* =================================================================== */}
      {activeTab === 'inventory' && (
        <>
          {/* Inventory Filters: Product dropdown & Date range */}
          <div className="toolbar" style={{ marginBottom: '20px' }}>
            <div className="toolbar-group" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', width: '100%' }}>
              <label className="field" style={{ minWidth: '240px', flex: 1 }}>
                <span className="field-label">Select Product</span>
                <select
                  aria-label="Select Product"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">All Products</option>
                  {balances
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name} ({p.unit}) — {p.category.replace('_', ' ')}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">Start date</span>
                <input
                  aria-label="Start date"
                  type="date"
                  value={invStartDate}
                  max={invEndDate}
                  onChange={(e) => setInvStartDate(e.target.value)}
                />
              </label>

              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">End date</span>
                <input
                  aria-label="End date"
                  type="date"
                  value={invEndDate}
                  min={invStartDate}
                  max={todayIndia()}
                  onChange={(e) => setInvEndDate(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Month-Wise Quantity Comparison Bar Graph */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Procured vs Wasted Quantity (Month-Wise)</h2>
                <p>
                  Comparing physical volume of purchased raw materials vs discarded wastage
                  {selectedProduct ? ` for ${selectedProduct.product_name}` : ' across all products'}
                  {' '}({dateLabel(invStartDate)} to {dateLabel(invEndDate)})
                </p>
              </div>
              <div className="actions">
                <Link className="button small primary" href={navLink('inventory')}>
                  Inventory workspace <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            {/* Overview Summary Badges */}
            <div style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', background: '#fafaf9', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', background: '#2b7a4b', borderRadius: '3px' }} />
                <span style={{ fontSize: '13px', color: '#555' }}>Total Procured:</span>
                <strong style={{ fontSize: '15px', color: '#1f5a36' }}>
                  {qty(totalProcuredQty.toString())} {qtyUnit}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', background: '#c92a2a', borderRadius: '3px' }} />
                <span style={{ fontSize: '13px', color: '#555' }}>Total Wasted:</span>
                <strong style={{ fontSize: '15px', color: '#a62020' }}>
                  {qty(totalWastedQty.toString())} {qtyUnit}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#555' }}>Spoilage Rate:</span>
                <strong style={{ fontSize: '15px', color: totalWastedQty.gt(0) ? '#c92a2a' : '#666' }}>
                  {totalProcuredQty.gt(0)
                    ? `${totalWastedQty.div(totalProcuredQty).mul(100).toFixed(1)}%`
                    : '0.0%'}
                </strong>
              </div>

              {selectedProduct && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pill neutral" style={{ textTransform: 'capitalize' }}>
                    {selectedProduct.category.replace('_', ' ')}
                  </span>
                  <span className="mono muted" style={{ fontSize: '12px' }}>
                    Stock: <strong>{qty(selectedProduct.quantity)} {selectedProduct.unit}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Proper Month-Wise Bar Graph */}
            <div style={{ padding: '32px 24px 20px 24px', overflowX: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: monthData.length <= 4 ? 'space-around' : 'flex-start',
                  gap: '32px',
                  minHeight: '260px',
                  minWidth: monthData.length > 6 ? `${monthData.length * 85}px` : 'auto',
                  borderBottom: '2px solid #ddd',
                  paddingBottom: '8px',
                }}
              >
                {monthData.map((d) => {
                  const pHeight = maxMonthQty > 0 ? (d.procured.toNumber() / maxMonthQty) * 190 : 0;
                  const wHeight = maxMonthQty > 0 ? (d.wasted.toNumber() / maxMonthQty) * 190 : 0;

                  // Month label formatting (e.g. Sep 2026)
                  const [y, m] = d.month.split('-');
                  const monthDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                  const monthName = monthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

                  return (
                    <div
                      key={d.month}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        flex: monthData.length <= 4 ? 1 : '0 0 75px',
                        maxWidth: '120px',
                      }}
                    >
                      {/* Dual bars: Procured vs Wasted */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: '6px',
                          height: '200px',
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        {/* Procured Bar */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '40%',
                            maxWidth: '36px',
                            minWidth: '20px',
                          }}
                          title={`Procured: ${qty(d.procured.toString())} ${qtyUnit}`}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: '11px',
                              fontWeight: 650,
                              color: '#1f5a36',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {d.procured.gt(0) ? qty(d.procured.toString()) : ''}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(d.procured.gt(0) ? 6 : 0, pHeight)}px`,
                              background: '#2b7a4b',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                            }}
                          />
                        </div>

                        {/* Wasted Bar */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '40%',
                            maxWidth: '36px',
                            minWidth: '20px',
                          }}
                          title={`Wasted: ${qty(d.wasted.toString())} ${qtyUnit}`}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: '11px',
                              fontWeight: 650,
                              color: '#c92a2a',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {d.wasted.gt(0) ? qty(d.wasted.toString()) : ''}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(d.wasted.gt(0) ? 6 : 0, wHeight)}px`,
                              background: '#c92a2a',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Month label underneath */}
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#555',
                          marginTop: '4px',
                          textAlign: 'center',
                        }}
                      >
                        {monthName}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '16px', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', background: '#2b7a4b', borderRadius: '3px', display: 'inline-block' }} />
                  <strong>Procured Quantity</strong> ({qtyUnit})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', background: '#c92a2a', borderRadius: '3px', display: 'inline-block' }} />
                  <strong>Wasted / Disposed Quantity</strong> ({qtyUnit})
                </span>
              </div>
            </div>

            <footer className="table-footer">
              <span>
                Figures recalculated for {monthData.length} month(s) · {dateLabel(invStartDate)} to {dateLabel(invEndDate)}
              </span>
              <Link className="text-link" href={navLink('inventory')}>
                Manage inventory &rarr;
              </Link>
            </footer>
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* 3. TRANSFERS TAB VIEW: Outlet Category Breakdown                    */}
      {/* =================================================================== */}
      {activeTab === 'transfers' && (
        <>
          {/* Transfers Filters: Dates & Product selection */}
          <div className="toolbar" style={{ marginBottom: '20px' }}>
            <div className="toolbar-group" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', width: '100%' }}>
              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">Start date</span>
                <input
                  aria-label="Start date"
                  type="date"
                  value={transferStartDate}
                  max={transferEndDate}
                  onChange={(e) => setTransferStartDate(e.target.value)}
                />
              </label>

              <label className="field" style={{ minWidth: '150px' }}>
                <span className="field-label">End date</span>
                <input
                  aria-label="End date"
                  type="date"
                  value={transferEndDate}
                  min={transferStartDate}
                  max={todayIndia()}
                  onChange={(e) => setTransferEndDate(e.target.value)}
                />
              </label>

              <label className="field" style={{ minWidth: '240px', flex: 1 }}>
                <span className="field-label">Filter Product</span>
                <select
                  aria-label="Filter Product"
                  value={selectedTransferProduct}
                  onChange={(e) => setSelectedTransferProduct(e.target.value)}
                >
                  <option value="">All Products</option>
                  <optgroup label="Grocery">
                    {balances
                      .filter((p) => p.category === 'grocery' && p.is_active)
                      .map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.unit})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Vegetables">
                    {balances
                      .filter((p) => p.category === 'vegetables' && p.is_active)
                      .map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.unit})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Sweets & Savouries">
                    {balances
                      .filter((p) => p.category === 'sweets_savouries' && p.is_active)
                      .map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.unit})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
            </div>
          </div>

          {/* Overall Grand Totals Sent Across Outlets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#f5faf6', border: '1px solid #d2e7d8', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#2b7a4b', fontWeight: 650, letterSpacing: '0.8px' }}>
                Grocery Sent
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#1f5a36', marginTop: '6px' }}>
                {qty(grandGrocery.toString())} <small style={{ fontSize: '12px', fontWeight: 400 }}>units/kg</small>
              </div>
              <div style={{ fontSize: '12px', color: '#2b7a4b', marginTop: '4px' }}>
                To all branch outlets
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#b45309', fontWeight: 650, letterSpacing: '0.8px' }}>
                Vegetables Sent
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#92400e', marginTop: '6px' }}>
                {qty(grandVegetables.toString())} <small style={{ fontSize: '12px', fontWeight: 400 }}>kg</small>
              </div>
              <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>
                Fresh vegetable stock
              </div>
            </div>

            <div style={{ background: '#f0f7ff', border: '1px solid #cfe2ff', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1971c2', fontWeight: 650, letterSpacing: '0.8px' }}>
                Sweets & Savouries Sent
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#145999', marginTop: '6px' }}>
                {qty(grandSweets.toString())} <small style={{ fontSize: '12px', fontWeight: 400 }}>kg</small>
              </div>
              <div style={{ fontSize: '12px', color: '#1971c2', marginTop: '4px' }}>
                Prepared confectionery
              </div>
            </div>

            <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#444', fontWeight: 650, letterSpacing: '0.8px' }}>
                Total Dispatched
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#222', marginTop: '6px' }}>
                {qty(grandTotalSent.toString())} <small style={{ fontSize: '12px', fontWeight: 400 }}>units/kg</small>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Across {validDispatches.length} shipment(s)
              </div>
            </div>
          </div>

          {/* Outlet Breakdown Cards */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Quantity Sent to Each Outlet</h2>
                <p>
                  Breakdown of Grocery, Vegetables, and Sweets sent from Central Store to each outlet
                  {' '}({dateLabel(transferStartDate)} to {dateLabel(transferEndDate)})
                </p>
              </div>
              <div className="actions">
                <Link className="button small primary" href={navLink('transfers')}>
                  New dispatch <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {outletTransferStats.map((out) => {
                return (
                  <div
                    key={out.location_id}
                    style={{
                      padding: '16px 20px',
                      background: '#fafaf9',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '15px' }}>{out.location_name}</strong>
                        <span className="pill neutral" style={{ fontSize: '11px' }}>
                          Outlet
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          ({out.dispatchCount} dispatch{out.dispatchCount === 1 ? '' : 'es'})
                        </span>
                      </div>
                      <div>
                        <span className="mono" style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>
                          Total: {qty(out.totalSent.toString())} units/kg
                        </span>
                      </div>
                    </div>

                    {/* 3 Categories: Grocery, Vegetables, Sweets */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ padding: '8px 12px', background: '#f5faf6', border: '1px solid #d2e7d8', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#2b7a4b', fontWeight: 650 }}>GROCERY</span>
                        <div className="mono" style={{ fontSize: '15px', fontWeight: 700, color: '#1f5a36', marginTop: '2px' }}>
                          {qty(out.groceryQty.toString())} units/kg
                        </div>
                      </div>

                      <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 650 }}>VEGETABLES</span>
                        <div className="mono" style={{ fontSize: '15px', fontWeight: 700, color: '#92400e', marginTop: '2px' }}>
                          {qty(out.vegetableQty.toString())} kg
                        </div>
                      </div>

                      <div style={{ padding: '8px 12px', background: '#f0f7ff', border: '1px solid #cfe2ff', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#1971c2', fontWeight: 650 }}>SWEETS &amp; SAVOURIES</span>
                        <div className="mono" style={{ fontSize: '15px', fontWeight: 700, color: '#145999', marginTop: '2px' }}>
                          {qty(out.sweetQty.toString())} kg
                        </div>
                      </div>
                    </div>

                    {/* Category Distribution Bar */}
                    {out.totalSent.gt(0) && (
                      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#eee' }}>
                        <div
                          style={{
                            width: `${out.groceryQty.div(out.totalSent).mul(100).toNumber()}%`,
                            background: '#2b7a4b',
                          }}
                          title={`Grocery: ${qty(out.groceryQty.toString())}`}
                        />
                        <div
                          style={{
                            width: `${out.vegetableQty.div(out.totalSent).mul(100).toNumber()}%`,
                            background: '#d97706',
                          }}
                          title={`Vegetables: ${qty(out.vegetableQty.toString())}`}
                        />
                        <div
                          style={{
                            width: `${out.sweetQty.div(out.totalSent).mul(100).toNumber()}%`,
                            background: '#1971c2',
                          }}
                          title={`Sweets: ${qty(out.sweetQty.toString())}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary Table */}
            <div className="table-wrap" style={{ borderTop: '1px solid #eee' }}>
              <table>
                <thead>
                  <tr>
                    <th>Outlet Branch</th>
                    <th className="numeric">Grocery Sent</th>
                    <th className="numeric">Vegetables Sent</th>
                    <th className="numeric">Sweets &amp; Savouries</th>
                    <th className="numeric">Total Sent</th>
                    <th className="numeric">Dispatches</th>
                  </tr>
                </thead>
                <tbody>
                  {outletTransferStats.map((out) => (
                    <tr key={out.location_id}>
                      <td>
                        <strong>{out.location_name}</strong>
                      </td>
                      <td className="numeric">
                        <span className="mono" style={{ color: out.groceryQty.gt(0) ? '#2b7a4b' : '#888', fontWeight: out.groceryQty.gt(0) ? 600 : 400 }}>
                          {qty(out.groceryQty.toString())}
                        </span>
                      </td>
                      <td className="numeric">
                        <span className="mono" style={{ color: out.vegetableQty.gt(0) ? '#b45309' : '#888', fontWeight: out.vegetableQty.gt(0) ? 600 : 400 }}>
                          {qty(out.vegetableQty.toString())}
                        </span>
                      </td>
                      <td className="numeric">
                        <span className="mono" style={{ color: out.sweetQty.gt(0) ? '#1971c2' : '#888', fontWeight: out.sweetQty.gt(0) ? 600 : 400 }}>
                          {qty(out.sweetQty.toString())}
                        </span>
                      </td>
                      <td className="numeric">
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {qty(out.totalSent.toString())}
                        </span>
                      </td>
                      <td className="numeric">
                        {out.dispatchCount}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr style={{ background: '#f8f8f7', fontWeight: 700 }}>
                    <td>TOTAL ALL OUTLETS</td>
                    <td className="numeric" style={{ color: '#2b7a4b' }}>
                      {qty(grandGrocery.toString())}
                    </td>
                    <td className="numeric" style={{ color: '#b45309' }}>
                      {qty(grandVegetables.toString())}
                    </td>
                    <td className="numeric" style={{ color: '#1971c2' }}>
                      {qty(grandSweets.toString())}
                    </td>
                    <td className="numeric" style={{ color: '#111', fontSize: '14px' }}>
                      {qty(grandTotalSent.toString())}
                    </td>
                    <td className="numeric">
                      {validDispatches.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <footer className="table-footer">
              <span>
                {outletTransferStats.length} destination outlets · Period: {dateLabel(transferStartDate)} to {dateLabel(transferEndDate)}
              </span>
              <Link className="text-link" href={navLink('transfers')}>
                View all transfer logs &rarr;
              </Link>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
