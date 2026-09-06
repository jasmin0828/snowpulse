export default function Loading() {
  return (
    <main className="loading-shell" aria-live="polite">
      <div className="loading-mark" aria-hidden="true" />
      <p>Reading Avalanche L1 activity…</p>
    </main>
  );
}
