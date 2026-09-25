'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="setup-page">
      <div className="eyebrow">WORKSPACE UNAVAILABLE</div>
      <h1>We couldn’t load this view.</h1>
      <p className="muted">
        Check your connection. If this is your first sign-in, confirm that all three scope
        migrations and your account profile have been set up in Supabase.
      </p>
      <button className="button primary" style={{ marginTop: 24 }} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
