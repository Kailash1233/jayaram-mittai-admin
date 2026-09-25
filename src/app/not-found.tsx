import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="setup-page">
      <h1>Page not found</h1>
      <p className="muted">This view isn’t part of the operations workspace.</p>
      <Link href="/" className="button primary" style={{ marginTop: 20 }}>
        Back to workspace
      </Link>
    </main>
  );
}
