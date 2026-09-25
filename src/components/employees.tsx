'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { employeeSchema } from '@/lib/validation';
import { dateLabel, employeeCode, todayIndia } from '@/lib/business';
import type { Context, Employee } from '@/lib/model';
import { saveEmployee } from '@/lib/actions';
import { ActionNotice, Empty, Field, Modal, Submit, useMutation } from './ui';
export function Employees({
  context,
  employees,
  preview = false,
}: {
  context: Context;
  employees: Employee[];
  preview?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [active, setActive] = useState('active');
  const [editing, setEditing] = useState<Employee | null | undefined>();
  const list = employees.filter(
    (e) =>
      (!location || e.location_id === location) &&
      (active === 'all' || e.is_active === (active === 'active')) &&
      `${e.employee_name} ${employeeCode(e.employee_id)} ${e.department}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">PEOPLE & PLACES</div>
          <h1>Employee directory</h1>
          <p>A clear view of your people, across every location.</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={16} />
          Add employee
        </button>
      </header>
      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Search employees"
              placeholder="Search name, ID or department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-group">
            <select
              aria-label="Employee location"
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
              aria-label="Employee status"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="active">Active employees</option>
              <option value="inactive">Inactive employees</option>
              <option value="all">All employees</option>
            </select>
          </div>
        </div>
        <div className="table-footer">
          <span>{list.length} employees</span>
          <span>Employee IDs are generated automatically</span>
        </div>
      </div>
      {list.length ? (
        <div className="employee-grid">
          {list.map((e) => (
            <article className="employee-card" key={e.employee_id}>
              <div className="person">
                <span className="person-avatar">
                  {e.employee_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <h3>{e.employee_name}</h3>
                  <span className="cell-sub">
                    {employeeCode(e.employee_id)} · {e.designation}
                  </span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Department</dt>
                  <dd>{e.department}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {context.locations.find((l) => l.location_id === e.location_id)?.location_name}
                  </dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{dateLabel(e.joining_date)}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{e.phone || 'Not provided'}</dd>
                </div>
              </dl>
              <footer>
                <span className={`badge ${e.is_active ? 'green' : ''}`}>
                  {e.is_active ? 'Active' : 'Inactive'}
                </span>
                <button className="text-link" onClick={() => setEditing(e)}>
                  View details <ArrowUpRight size={12} style={{ display: 'inline' }} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No employees here yet">Add your first employee or adjust the filters.</Empty>
      )}
      {editing !== undefined && (
        <EmployeeForm
          employee={editing}
          context={context}
          preview={preview}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
function EmployeeForm({
  employee,
  context,
  preview,
  onClose,
}: {
  employee: Employee | null;
  context: Context;
  preview: boolean;
  onClose: () => void;
}) {
  const m = useMutation(preview);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employee_id: employee?.employee_id,
      employee_name: employee?.employee_name ?? '',
      department: employee?.department ?? '',
      designation: employee?.designation ?? '',
      location_id:
        employee?.location_id ?? context.locations.find((l) => l.is_active)?.location_id ?? '',
      joining_date: employee?.joining_date ?? todayIndia(),
      phone: employee?.phone ?? '',
      email: employee?.email ?? '',
      address: employee?.address ?? '',
      is_active: employee?.is_active ?? true,
    },
  });
  return (
    <Modal
      title={employee ? 'Employee details' : 'Add employee'}
      subtitle={
        employee
          ? `${employeeCode(employee.employee_id)} · Keep employee information up to date.`
          : 'A few details to get your new team member set up.'
      }
      onClose={onClose}
      busy={m.pending}
    >
      <form
        className="form-body"
        onSubmit={handleSubmit((v) => m.execute(() => saveEmployee(v), onClose))}
      >
        <div className="form-grid">
          <div className="span-2">
            <Field label="Employee name" error={errors.employee_name?.message}>
              <input {...register('employee_name')} autoComplete="name" placeholder="Full name" />
            </Field>
          </div>
          <Field label="Department" error={errors.department?.message}>
            <input {...register('department')} placeholder="e.g. Kitchen" />
          </Field>
          <Field label="Designation" error={errors.designation?.message}>
            <input {...register('designation')} placeholder="e.g. Cook" />
          </Field>
          <Field label="Assigned location" error={errors.location_id?.message}>
            <select {...register('location_id')}>
              {context.locations
                .filter((l) => l.is_active || l.location_id === employee?.location_id)
                .map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Joining date" error={errors.joining_date?.message}>
            <input type="date" {...register('joining_date')} />
          </Field>
          <Field label="Phone · optional" error={errors.phone?.message}>
            <input {...register('phone')} type="tel" autoComplete="tel" />
          </Field>
          <Field label="Email · optional" error={errors.email?.message}>
            <input {...register('email')} type="email" autoComplete="email" />
          </Field>
          <div className="span-2">
            <Field label="Address · optional" error={errors.address?.message}>
              <textarea {...register('address')} autoComplete="street-address" />
            </Field>
          </div>
          {employee && (
            <label className="checkbox span-2">
              <input type="checkbox" {...register('is_active')} />
              Active employee — deactivating preserves attendance history
            </label>
          )}
        </div>
        {employee && (
          <p className="field-hint">
            Changing location affects new attendance. Saved attendance keeps its original branch.
          </p>
        )}
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button type="button" className="button" onClick={onClose} disabled={m.pending}>
            Cancel
          </button>
          <Submit busy={m.pending}>{employee ? 'Save changes' : 'Add employee'}</Submit>
        </footer>
      </form>
    </Modal>
  );
}
