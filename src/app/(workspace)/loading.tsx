export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace">
      <div className="skeleton" style={{ width: 210, height: 34, marginBottom: 25 }} />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <div className="skeleton" />
            <div className="skeleton" style={{ width: '50%', height: 30, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 24 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} style={{ marginBottom: 22, height: 34 }} />
        ))}
      </div>
    </div>
  );
}
