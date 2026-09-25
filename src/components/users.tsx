'use client';
import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { roleLabels, isAdmin, type Account, type Context, type Role } from '@/lib/model';
import { createAccount, updateAccount } from '@/lib/user-actions';
import { ActionNotice, Field, Modal, Notice, Submit, useMutation } from './ui';
export function UserAccess({
  context,
  accounts,
  provisioningAvailable,
  preview = false,
}: {
  context: Context;
  accounts: Account[];
  provisioningAvailable: boolean;
  preview?: boolean;
}) {
  const [editing, setEditing] = useState<Account | null | undefined>();
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>User access</h1>
          <p>The right access, for the right location.</p>
        </div>
        <button
          className="button primary"
          disabled={!provisioningAvailable && !preview}
          onClick={() => setEditing(null)}
        >
          <Plus size={16} />
          Create login
        </button>
      </header>
      {!provisioningAvailable && (
        <Notice
          message={
            preview
              ? 'Design preview. Actual login accounts are managed securely by administrators.'
              : 'Creating logins requires the server-only provisioning key. Your publishable key is enough for normal operations.'
          }
        />
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Operational accounts</h2>
            <p>Employees do not need individual login accounts</p>
          </div>
          <ShieldCheck size={20} className="muted" />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Assigned location</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.user_account_id}>
                  <td className="cell-main">
                    {a.display_name}
                    {a.user_account_id === context.account.user_account_id && (
                      <span className="cell-sub">Your account</span>
                    )}
                  </td>
                  <td>{roleLabels[a.user_role]}</td>
                  <td>
                    {a.location_id
                      ? context.locations.find((l) => l.location_id === a.location_id)
                          ?.location_name
                      : 'All locations'}
                  </td>
                  <td>
                    <span className={`badge ${a.is_active ? 'green' : ''}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="text-link" onClick={() => setEditing(a)}>
                      Manage access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>One active supervisor per location</span>
          <span>At least one administrator must stay active</span>
        </footer>
      </section>
      {editing !== undefined && (
        <AccountForm
          context={context}
          account={editing}
          preview={preview}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
function AccountForm({
  context,
  account,
  preview,
  onClose,
}: {
  context: Context;
  account: Account | null;
  preview: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(account?.display_name ?? '');
  const [role, setRole] = useState<Role>(account?.user_role ?? 'outlet_supervisor');
  const [location, setLocation] = useState(account?.location_id ?? '');
  const [active, setActive] = useState(account?.is_active ?? true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation(preview);
  return (
    <Modal
      title={account ? 'Manage user access' : 'Create operational login'}
      subtitle="Roles and locations are enforced by the database."
      onClose={onClose}
      busy={m.pending}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          m.execute(
            () =>
              account
                ? updateAccount({
                    user_account_id: account.user_account_id,
                    display_name: name,
                    user_role: role,
                    location_id: location,
                    is_active: active,
                  })
                : createAccount({
                    display_name: name,
                    user_role: role,
                    location_id: location,
                    email,
                    password,
                  }),
            onClose,
          );
        }}
      >
        <Field label="Display name">
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setLocation('');
            }}
          >
            {Object.entries(roleLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {!isAdmin(role) && (
          <Field label="Assigned location">
            <select value={location} required onChange={(e) => setLocation(e.target.value)}>
              <option value="">Choose location</option>
              {context.locations
                .filter(
                  (l) =>
                    l.is_active &&
                    l.location_type === (role === 'store_supervisor' ? 'central_store' : 'outlet'),
                )
                .map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {account ? (
          <label className="checkbox">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active account
          </label>
        ) : (
          <>
            <Field label="Login email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Initial password"
              hint="At least 12 characters. Share securely with the intended user."
            >
              <input
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </>
        )}
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={m.pending}>{account ? 'Save access' : 'Create login'}</Submit>
        </footer>
      </form>
    </Modal>
  );
}
