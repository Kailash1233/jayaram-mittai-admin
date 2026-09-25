'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Check, Download, Plus, Search, RotateCcw, X } from 'lucide-react';
import {
  isAdmin,
  statusLabels,
  type Attendance,
  type Context,
  type Employee,
  type Holiday,
  type Roster,
  type Status,
} from '@/lib/model';
import { dateLabel, employeeCode, reportRows, todayIndia } from '@/lib/business';
import { bulkAttendance, resetAttendance, saveHolidays, setAttendance } from '@/lib/actions';
import { ActionNotice, Empty, Field, Modal, Notice, Stat, Submit, useMutation } from './ui';
export function AttendanceWorkspace({
  context,
  rows,
  employees,
  attendance,
  holidays,
  date,
  location,
  start,
  end,
  preview = false,
}: {
  context: Context;
  rows: Roster[];
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  date: string;
  location: string;
  start: string;
  end: string;
  preview?: boolean;
}) {
  const admin = isAdmin(context.account.user_role);
  const [tab, setTab] = useState('daily');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [bulk, setBulk] = useState<'present' | 'holiday' | null>(null);
  const [historical, setHistorical] = useState<{ row: Roster; status: Status } | null>(null);
  const [historicalLocation, setHistoricalLocation] = useState(location);
  const m = useMutation(preview);
  const router = useRouter();
  const params = useSearchParams();
  const navigate = (values: Record<string, string>) => {
    if (preview) return;
    const p = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => p.set(k, v));
    router.replace(`/attendance?${p}`);
  };
  const filtered = rows.filter(
    (r) =>
      (!department || r.department === department) &&
      `${r.employee_name} ${employeeCode(r.employee_id)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const departments = [...new Set(rows.map((r) => r.department))].sort();
  const canEdit = admin || date === todayIndia();
  function mark(row: Roster, status: Status) {
    if (admin && date < todayIndia() && !row.attendance_id) {
      setHistorical({ row, status });
      setHistoricalLocation(location);
      return;
    }
    m.execute(() => setAttendance(row.employee_id, date, status));
  }
  const counts = (s: string) => rows.filter((r) => r.effective_status === s).length;
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">DAILY OPERATIONS</div>
          <h1>Attendance</h1>
          <p>Every person accounted for. Every location in view.</p>
        </div>
        <div className="page-actions">
          {admin && (
            <button
              className="button"
              onClick={() => setTab(tab === 'calendar' ? 'daily' : 'calendar')}
            >
              <CalendarDays size={16} />
              Holiday calendar
            </button>
          )}
          <span className="badge">{dateLabel(date)}</span>
        </div>
      </header>
      {admin && (
        <div className="tabs" role="tablist" aria-label="Attendance view">
          {[
            ['daily', 'Daily attendance'],
            ['summary', 'Summary & export'],
            ['calendar', 'Holiday calendar'],
          ].map(([v, l]) => (
            <button
              role="tab"
              aria-selected={tab === v}
              key={v}
              className={`tab ${tab === v ? 'active' : ''}`}
              onClick={() => setTab(v)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <ActionNotice notice={m.notice} />
      {tab === 'daily' && (
        <>
          <div className="stats">
            <Stat label="People on roster" value={rows.length} note="For this location and date" />
            <Stat
              label="Present"
              value={counts('present')}
              note={`${counts('half_day')} half-day`}
            />
            <Stat
              label="Absent / holiday"
              value={`${counts('absent')} / ${counts('holiday')}`}
              note="Holidays do not count as absence"
            />
            <Stat label="Not marked" value={counts('not_marked')} note="Awaiting a status" />
          </div>
          {!canEdit && (
            <Notice message="Past attendance is read-only for supervisors. An administrator can make corrections." />
          )}
          {date < todayIndia() && (
            <Notice message="Saved marks retain their original location. Missing historical dates use the current roster and are estimates." />
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Daily register</h2>
                <p>
                  {context.locations.find((l) => l.location_id === location)?.location_name ??
                    'Choose a location'}{' '}
                  · Changes save as you mark
                </p>
              </div>
              {date === todayIndia() && (
                <div className="actions">
                  <button
                    className="button small"
                    disabled={!rows.length || m.pending}
                    onClick={() => setBulk('holiday')}
                  >
                    Mark holiday
                  </button>
                  <button
                    className="button small primary"
                    disabled={!rows.length || m.pending}
                    onClick={() => setBulk('present')}
                  >
                    <Check size={14} />
                    Mark all present
                  </button>
                </div>
              )}
            </div>
            <div className="toolbar">
              <div className="toolbar-group">
                <input
                  type="date"
                  aria-label="Attendance date"
                  max={todayIndia()}
                  value={date}
                  disabled={preview}
                  onChange={(e) => navigate({ date: e.target.value })}
                />
                {admin && (
                  <select
                    aria-label="Attendance location"
                    value={location}
                    disabled={preview}
                    onChange={(e) => navigate({ location: e.target.value })}
                  >
                    {context.locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <option value={l.location_id} key={l.location_id}>
                          {l.location_name}
                        </option>
                      ))}
                  </select>
                )}
                <select
                  aria-label="Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="search">
                <Search size={15} />
                <input
                  placeholder="Find an employee"
                  aria-label="Search attendance"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {filtered.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th className="hidden-mobile">Department</th>
                      <th>Attendance</th>
                      <th>Record</th>
                      {admin && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.employee_id}>
                        <td>
                          <div className="person">
                            <span className="person-avatar">
                              {r.employee_name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </span>
                            <div className="cell-main">
                              {r.employee_name}
                              <span className="cell-sub">
                                {employeeCode(r.employee_id)} · {r.designation}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden-mobile">{r.department}</td>
                        <td>
                          <div className="status-buttons">
                            {(['present', 'absent', 'half_day', 'holiday'] as Status[]).map((s) => (
                              <button
                                key={s}
                                aria-label={`${r.employee_name}: ${statusLabels[s]}`}
                                aria-pressed={r.effective_status === s}
                                className={`status-button ${s} ${r.effective_status === s ? 'selected' : ''}`}
                                disabled={!canEdit || m.pending}
                                onClick={() => mark(r, s)}
                              >
                                {statusLabels[s]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${r.attendance_id ? 'green' : ''}`}>
                            {r.attendance_id
                              ? 'Saved'
                              : r.status_source === 'calendar'
                                ? 'Calendar holiday'
                                : r.status_source === 'current_roster_estimate'
                                  ? 'Estimate'
                                  : 'Not marked'}
                          </span>
                        </td>
                        {admin && (
                          <td>
                            {r.attendance_id && (
                              <button
                                className="icon-button"
                                title="Reset individual mark"
                                aria-label={`Reset ${r.employee_name}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      'Remove this individual mark and return to the calendar default?',
                                    )
                                  )
                                    m.execute(() => resetAttendance(r.employee_id, date));
                                }}
                                disabled={m.pending}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No employees found">
                Add employees for this location or change the filters.
              </Empty>
            )}
            <footer className="table-footer">
              <span>
                {filtered.length} of {rows.length} employees
              </span>
              <span>Not marked is never automatically absent</span>
            </footer>
          </section>
        </>
      )}
      {tab === 'summary' && (
        <Summary
          context={context}
          employees={employees}
          attendance={attendance}
          holidays={holidays}
          start={start}
          end={end}
          preview={preview}
          navigate={navigate}
        />
      )}
      {tab === 'calendar' && (
        <HolidayCalendar context={context} holidays={holidays} preview={preview} />
      )}
      {bulk && (
        <BulkDialog
          status={bulk}
          location={location}
          preview={preview}
          onClose={() => setBulk(null)}
        />
      )}
      {historical && (
        <Modal
          title="Confirm historical location"
          subtitle="A missing past record has no saved branch. Select where this employee worked that day."
          onClose={() => setHistorical(null)}
          busy={m.pending}
        >
          <div className="form-body">
            <Field label="Historical location">
              <select
                value={historicalLocation}
                onChange={(e) => setHistoricalLocation(e.target.value)}
              >
                {context.locations.map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            </Field>
            <ActionNotice notice={m.notice} />
            <button
              className="button primary"
              disabled={m.pending}
              onClick={() =>
                m.execute(
                  () =>
                    setAttendance(
                      historical.row.employee_id,
                      date,
                      historical.status,
                      historicalLocation,
                    ),
                  () => setHistorical(null),
                )
              }
            >
              Save {statusLabels[historical.status]}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function BulkDialog({
  status,
  location,
  preview,
  onClose,
}: {
  status: 'present' | 'holiday';
  location: string;
  preview: boolean;
  onClose: () => void;
}) {
  const [replace, setReplace] = useState(false);
  const m = useMutation(preview);
  return (
    <Modal
      title={status === 'present' ? 'Mark location present' : 'Mark location holiday'}
      subtitle="Applies to the entire eligible location roster for today, not just search results."
      onClose={onClose}
      busy={m.pending}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          m.execute(() => bulkAttendance(location, status, replace), onClose);
        }}
      >
        <label className="checkbox">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace existing individual statuses
        </label>
        <Notice
          message={
            replace
              ? 'Existing statuses will be replaced.'
              : status === 'present'
                ? 'Existing marks and calendar holidays are preserved.'
                : 'Existing individual marks are preserved.'
          }
        />
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={m.pending}>Mark {statusLabels[status]}</Submit>
        </footer>
      </form>
    </Modal>
  );
}
function Summary({
  context,
  employees,
  attendance,
  holidays,
  start,
  end,
  preview,
  navigate,
}: {
  context: Context;
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  start: string;
  end: string;
  preview: boolean;
  navigate: (v: Record<string, string>) => void;
}) {
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const rows = useMemo(
    () =>
      reportRows(employees, attendance, holidays, start, end, location, department).filter((r) =>
        `${r.employee_name} ${employeeCode(r.employee_id)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [employees, attendance, holidays, start, end, location, department, search],
  );
  const query = new URLSearchParams({ start, end, location, department, search });
  return (
    <>
      <Notice message="Missing historical dates use current-roster estimates. Saved marks use their recorded branch. Holiday and Not marked are excluded from attendance percentage." />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance summary</h2>
            <p>Employee-level totals · Current department and location shown</p>
          </div>
          {preview ? (
            <button className="button" disabled>
              <Download size={15} />
              Export Excel
            </button>
          ) : (
            <a className="button" href={`/api/attendance-export?${query}`}>
              <Download size={15} />
              Export Excel
            </a>
          )}
        </div>
        <div className="toolbar">
          <div className="toolbar-group">
            <input
              type="date"
              aria-label="Report start"
              value={start}
              max={end}
              disabled={preview}
              onChange={(e) => navigate({ start: e.target.value })}
            />
            <span className="muted">to</span>
            <input
              type="date"
              aria-label="Report end"
              value={end}
              min={start}
              max={todayIndia()}
              disabled={preview}
              onChange={(e) => navigate({ end: e.target.value })}
            />
            <select
              aria-label="Report location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">All locations</option>
              {context.locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_name}
                </option>
              ))}
            </select>
            <select
              aria-label="Report department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {[...new Set(employees.map((e) => e.department))].sort().map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Search summary"
              placeholder="Employee name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Current location</th>
                  {['Present', 'Absent', 'Half-day', 'Holiday', 'Not marked', 'Attendance'].map(
                    (s) => (
                      <th key={s} className="numeric">
                        {s}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee_id}>
                    <td>
                      <span className="cell-main">{r.employee_name}</span>
                      <span className="cell-sub">
                        {employeeCode(r.employee_id)} · {r.department}
                      </span>
                    </td>
                    <td>
                      {
                        context.locations.find((l) => l.location_id === r.location_id)
                          ?.location_name
                      }
                    </td>
                    <td className="numeric">{r.present}</td>
                    <td className="numeric">{r.absent}</td>
                    <td className="numeric">{r.half_day}</td>
                    <td className="numeric">{r.holiday}</td>
                    <td className="numeric">
                      {r.not_marked}
                      {r.estimated_days > 0 && (
                        <span className="cell-sub">{r.estimated_days} estimated days</span>
                      )}
                    </td>
                    <td className="numeric cell-main">
                      {r.percentage === null ? 'N/A' : `${r.percentage.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No report records">Try a different date range or location.</Empty>
        )}
      </section>
    </>
  );
}
function HolidayCalendar({
  context,
  holidays,
  preview,
}: {
  context: Context;
  holidays: Holiday[];
  preview: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [day, setDay] = useState(todayIndia());
  const [name, setName] = useState('');
  const m = useMutation(preview);
  const locations = context.locations.filter((l) => l.is_active);
  return (
    <div className="split-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Declare a holiday</h2>
            <p>Past, present or future · individual attendance still takes priority</p>
          </div>
        </div>
        <form
          className="form-body"
          onSubmit={(e) => {
            e.preventDefault();
            m.execute(
              () => saveHolidays({ locations: selected, dates, name, remove: false }),
              () => {
                setDates([]);
                setName('');
              },
            );
          }}
        >
          <div className="actions">
            <span className="field-label">Locations</span>
            <button
              className="text-link"
              type="button"
              onClick={() =>
                setSelected(
                  selected.length === locations.length ? [] : locations.map((l) => l.location_id),
                )
              }
            >
              {selected.length === locations.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="checkbox-list">
            {locations.map((l) => (
              <label className="checkbox" key={l.location_id}>
                <input
                  type="checkbox"
                  checked={selected.includes(l.location_id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, l.location_id]
                        : selected.filter((id) => id !== l.location_id),
                    )
                  }
                />
                {l.location_name}
              </label>
            ))}
          </div>
          <Field label="Choose holiday dates">
            <div className="date-add">
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (day) setDates([...new Set([...dates, day])].sort());
                }}
              >
                <Plus size={15} />
                Add date
              </button>
            </div>
          </Field>
          <div className="holiday-dates">
            {dates.map((d) => (
              <span className="chip" key={d}>
                {dateLabel(d)}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${d}`}
                  onClick={() => setDates(dates.filter((x) => x !== d))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <Field label="Holiday name · optional">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={250}
              placeholder="e.g. Festival holiday"
            />
          </Field>
          <ActionNotice notice={m.notice} />
          <footer className="form-footer">
            <span className="muted">
              {selected.length * dates.length} location/date combinations
            </span>
            <Submit busy={m.pending}>Save holidays</Submit>
          </footer>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Declared holidays</h2>
          <span className="badge">{holidays.length}</span>
        </div>
        {holidays.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date / location</th>
                  <th>Holiday</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...holidays]
                  .sort((a, b) => b.holiday_date.localeCompare(a.holiday_date))
                  .map((h) => (
                    <tr key={h.location_holiday_id}>
                      <td className="cell-main">
                        {dateLabel(h.holiday_date)}
                        <span className="cell-sub">
                          {
                            context.locations.find((l) => l.location_id === h.location_id)
                              ?.location_name
                          }
                        </span>
                      </td>
                      <td>{h.holiday_name || 'Holiday'}</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Remove holiday ${h.holiday_date}`}
                          disabled={m.pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Remove this location holiday? Individual attendance marks will remain.',
                              )
                            )
                              m.execute(() =>
                                saveHolidays({
                                  locations: [h.location_id],
                                  dates: [h.holiday_date],
                                  name: '',
                                  remove: true,
                                }),
                              );
                          }}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No holidays declared">Add dates and locations using the calendar.</Empty>
        )}
      </section>
    </div>
  );
}
