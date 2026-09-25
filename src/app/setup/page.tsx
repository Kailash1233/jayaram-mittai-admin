import Link from 'next/link';
import { ArrowRight, Database } from 'lucide-react';
export default function Setup() {
  return (
    <main className="setup-page">
      <div className="brand">
        <span className="brand-mark">JM</span>
        <span>
          Jayaram Mittai<small>OPERATIONS</small>
        </span>
      </div>
      <div className="eyebrow" style={{ marginTop: 42 }}>
        WORKSPACE SETUP
      </div>
      <h1>Your operations, in one place.</h1>
      <p className="muted">
        The app is ready to connect to your Supabase project. No sample records will be mixed into
        your live workspace.
      </p>
      <section className="panel">
        <div className="actions" style={{ marginBottom: 20 }}>
          <Database size={20} />
          <h2>Connect your database</h2>
        </div>
        <ol>
          <li>Apply the three approved scope SQL files in order.</li>
          <li>
            Add the project URL and publishable key to <code>.env.local</code>.
          </li>
          <li>Restart the app and sign in with a provisioned account.</li>
        </ol>
        <p className="field-hint" style={{ marginTop: 16 }}>
          The publishable key supports ordinary workflows. Creating login accounts additionally
          needs a server-only service-role key.
        </p>
      </section>
      <div className="actions">
        <Link className="button primary" href="/preview">
          Explore the design preview <ArrowRight size={15} />
        </Link>
        <Link className="button" href="/login">
          Go to sign in
        </Link>
      </div>
      <p className="field-hint" style={{ marginTop: 20 }}>
        Preview contains clearly labeled sample data. It cannot save to Supabase.
      </p>
    </main>
  );
}
