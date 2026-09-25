import Link from 'next/link';
import { LoginForm } from '@/components/login';
import { configured } from '@/lib/supabase';
export default function Login() {
  return (
    <main className="auth-page">
      <section className="auth-art">
        <div className="brand">
          <span className="brand-mark">JM</span>
          <span>
            Jayaram Mittai<small>OPERATIONS</small>
          </span>
        </div>
        <div className="auth-art-content">
          <h1>
            Good operations.
            <br />
            Every day.
          </h1>
          <p>
            Your people, your stock, and every delivery between them. A shared workspace for the way
            your team works.
          </p>
        </div>
        <footer>JAYARAM MITTAI · INTERNAL WORKSPACE</footer>
      </section>
      <section className="auth-main">
        <div className="auth-form">
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in</h1>
          <p>Use your assigned operations account.</p>
          {configured() ? (
            <LoginForm />
          ) : (
            <div>
              <p className="notice">Your Supabase connection is not configured yet.</p>
              <Link className="button primary" href="/setup">
                Open setup
              </Link>
              <Link className="button" href="/preview" style={{ marginTop: 10 }}>
                View design preview
              </Link>
            </div>
          )}
          <small>
            Access is limited to your assigned role and location.
            <br />
            Contact your administrator for help with your account.
          </small>
        </div>
      </section>
    </main>
  );
}
