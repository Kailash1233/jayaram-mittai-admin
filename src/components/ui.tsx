'use client';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle, X, PackageOpen } from 'lucide-react';
import type { ActionResult } from '@/lib/model';
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
export function Notice({
  message,
  kind = 'info',
}: {
  message?: string;
  kind?: 'info' | 'error' | 'success';
}) {
  if (!message) return null;
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      <span>{message}</span>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <PackageOpen size={28} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="modal-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Submit({
  busy,
  children = 'Save changes',
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy && <LoaderCircle className="spin" size={16} />} {busy ? 'Saving…' : children}
    </button>
  );
}
export function useMutation(preview = false) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ message: string; kind: 'error' | 'success' | 'info' }>();
  const router = useRouter();
  function execute(fn: () => Promise<ActionResult>, onSuccess?: (id?: string) => void) {
    if (preview) {
      setNotice({
        message: 'Design preview only. Connect Supabase to save real records.',
        kind: 'info',
      });
      return;
    }
    setNotice(undefined);
    start(async () => {
      try {
        const r = await fn();
        setNotice({ message: r.message, kind: r.ok ? 'success' : 'error' });
        if (r.ok) {
          router.refresh();
          onSuccess?.(r.id);
        }
      } catch {
        setNotice({
          message:
            'The response was interrupted. Refresh and check whether the record saved before retrying.',
          kind: 'error',
        });
      }
    });
  }
  return { pending, execute, notice, clear: () => setNotice(undefined) };
}
export function ActionNotice({
  notice,
}: {
  notice?: { message: string; kind: 'error' | 'success' | 'info' };
}) {
  return <Notice {...notice} message={notice?.message} />;
}
export function ReasonDialog({
  title,
  description,
  onClose,
  onSave,
  preview = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onSave: (reason: string) => Promise<ActionResult>;
  preview?: boolean;
}) {
  const [reason, setReason] = useState('');
  const m = useMutation(preview);
  return (
    <Modal title={title} onClose={onClose} busy={m.pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.execute(() => onSave(reason), onClose);
        }}
        className="form-body"
      >
        <p className="muted">{description}</p>
        <Field label="Reason">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            maxLength={2000}
          />
        </Field>
        <ActionNotice notice={m.notice} />
        <footer className="form-footer">
          <button className="button" type="button" onClick={onClose} disabled={m.pending}>
            Cancel
          </button>
          <Submit busy={m.pending}>Confirm</Submit>
        </footer>
      </form>
    </Modal>
  );
}
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
