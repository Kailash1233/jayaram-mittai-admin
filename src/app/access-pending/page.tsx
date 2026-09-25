import { logout } from '@/lib/actions';
export default function Pending() {
  return (
    <main className="setup-page">
      <div className="eyebrow">ACCOUNT ACCESS</div>
      <h1>Your account needs setup.</h1>
      <p className="muted">
        You are signed in, but an active operations profile and location must be assigned before you
        can enter the workspace. Ask your administrator to check your account.
      </p>
      <form action={logout} style={{ marginTop: 25 }}>
        <button className="button primary">Sign out</button>
      </form>
    </main>
  );
}
