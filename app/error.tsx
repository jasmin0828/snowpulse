"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="error-shell" role="alert">
      <p className="eyebrow">SnowPulse · live data</p>
      <h1>Unable to load current Avalanche metrics.</h1>
      <p>The official Metrics API did not return a complete Mainnet dataset.</p>
      <button className="retry-button" type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
