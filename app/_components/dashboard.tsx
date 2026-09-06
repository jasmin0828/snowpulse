"use client";

import { useState, type CSSProperties } from "react";
import type { DataFreshness } from "../../src/lib/avalanche/metrics";
import type { DashboardData } from "../../src/lib/dashboard/data";
import { freshnessSummary, prepareDashboardViewModel } from "../../src/lib/dashboard/view-model";
import type { ChainSignal, MetricComparison } from "../../src/lib/intelligence/scoring";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CHAIN_LABELS: Record<number, string> = {
  4337: "Beam",
  432204: "Dexalot",
  43419: "Gunzilla",
  46975: "Blaze",
};

const METRIC_ITEMS = [
  { key: "txCount", label: "Transactions", shortLabel: "Tx" },
  { key: "activeAddresses", label: "Active Addresses", shortLabel: "Addresses" },
  { key: "activeSenders", label: "Active Senders", shortLabel: "Senders" },
] as const;

type MetricKey = (typeof METRIC_ITEMS)[number]["key"];

function chainLabel(signal: ChainSignal): string {
  return CHAIN_LABELS[signal.chainId] ?? signal.chainName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(timestamp: string): string {
  if (timestamp === "MISSING") return "Unavailable";
  const [year, month, day] = timestamp.slice(0, 10).split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function formatBaselineRange(range: string): string {
  if (range === "MISSING") return "Prior 7 days unavailable";
  const [start, end] = range.split(" to ");
  const endDate = new Date(end);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return `${formatDate(start)} — ${formatDate(endDate.toISOString())}`;
}

function formatNumber(value: number | null): string {
  return value === null ? "Unavailable" : new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function formatGrowth(value: number | null): string {
  return value === null ? "Unavailable" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function statusClass(status: ChainSignal["status"]): string {
  return `state-badge state-${status.toLowerCase()}`;
}

function growthClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.1) return "growth-neutral";
  return value > 0 ? "growth-positive" : "growth-negative";
}

function confidenceDescription(confidence: ChainSignal["confidence"]): string {
  switch (confidence) {
    case "HIGH":
      return "Complete metrics, a full seven-day baseline, and strong current samples.";
    case "MEDIUM":
      return "Core metrics are available, with moderate sample or baseline coverage.";
    case "LOW":
      return "Interpretation is limited by sample size, missing data, or baseline coverage.";
  }
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" role="img" aria-label="SnowPulse mark">
      <path d="M4 30 14.5 13 21 23l5.5-8L36 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 34h32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="28" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}

function EcosystemVisual() {
  return (
    <div className="ecosystem-visual" aria-label="A signal moving across Avalanche L1 peaks" role="img">
      <div className="visual-glow visual-glow-one" />
      <div className="visual-glow visual-glow-two" />
      <svg viewBox="0 0 520 310" aria-hidden="true">
        <defs>
          <linearGradient id="mountain-fill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#9fe8ff" stopOpacity="0.72" />
            <stop offset="1" stopColor="#32618e" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="signal-line" x1="0" x2="1">
            <stop offset="0" stopColor="#8ed8ff" stopOpacity="0.25" />
            <stop offset="0.55" stopColor="#d9f6ff" />
            <stop offset="1" stopColor="#75cfff" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path d="M20 257 122 102l72 111 67-150 117 194 56-90 66 90H20Z" fill="url(#mountain-fill)" opacity="0.3" />
        <path d="m20 257 102-155 72 111 67-150 117 194 56-90 66 90" fill="none" stroke="#5b9cc7" strokeOpacity="0.55" strokeWidth="1.5" />
        <path d="m20 257 102-155 72 111 67-150 117 194 56-90 66 90" fill="none" stroke="#bfeeff" strokeDasharray="2 13" strokeLinecap="round" strokeWidth="2" opacity="0.8" />
        <path d="M32 225c57-51 92-20 139-36 50-18 65-75 121-54 53 20 70 75 119 60 34-10 56-45 87-54" fill="none" stroke="url(#signal-line)" strokeLinecap="round" strokeWidth="3" />
        <circle cx="292" cy="136" r="7" fill="#d9f6ff" opacity="0.95" />
        <circle cx="292" cy="136" r="18" fill="none" stroke="#8ed8ff" strokeOpacity="0.3" />
        <circle cx="292" cy="136" r="29" fill="none" stroke="#8ed8ff" strokeDasharray="2 8" strokeOpacity="0.32" />
        <path d="M24 275h470" stroke="#6d9ac1" strokeOpacity="0.25" />
      </svg>
      <div className="visual-caption"><span className="caption-dot" />Four L1s · one signal surface</div>
    </div>
  );
}

function FreshnessStrip({ freshness, sourceState }: { freshness: DataFreshness; sourceState: DashboardData["sourceState"] }) {
  const summary = freshnessSummary(freshness);
  return (
    <section className={`freshness-strip freshness-${freshness.state.toLowerCase()}`} aria-label="Data freshness">
      <div className="freshness-main">
        <span className="freshness-icon" aria-hidden="true"><span /></span>
        <div>
          <p className="strip-label">{summary.primary}</p>
          <p className="strip-value">
            {freshness.selectedTimestamp === "MISSING"
              ? "Ranking unavailable"
              : `${formatDate(freshness.selectedTimestamp)} UTC`}
          </p>
        </div>
      </div>
      <div className="freshness-detail">
        <span className="detail-label">Latest available</span>
        <span className="detail-value">
          {formatDate(freshness.latestAvailableTimestamp)}
          {freshness.latestAvailableState === "PROVISIONAL" ? <em>provisional</em> : null}
        </span>
      </div>
      <div className="freshness-source"><span className="live-dot" />{sourceState}</div>
    </section>
  );
}

function SignalRow({ signal, rank, selected, onSelect }: {
  signal: ChainSignal;
  rank: number;
  selected: boolean;
  onSelect: (chainId: number) => void;
}) {
  return (
    <button
      className={`signal-row${selected ? " signal-row-selected" : ""}`}
      type="button"
      aria-pressed={selected}
      data-testid={`signal-row-${signal.chainId}`}
      onClick={() => onSelect(signal.chainId)}
    >
      <span className="signal-rank">{String(rank).padStart(2, "0")}</span>
      <span className="signal-chain">
        <strong>{chainLabel(signal)}</strong>
        <small>{signal.chainId} · Avalanche L1</small>
      </span>
      <span className="signal-score"><strong>{formatScore(signal.activityScore)}</strong><small>/100</small></span>
      <span className={statusClass(signal.status)}>{signal.status}</span>
      <span className="confidence-pill">{signal.confidence} confidence</span>
      <span className="signal-trend">
        <span className={growthClass(signal.txCount.rawGrowthPct)}>{formatGrowth(signal.txCount.rawGrowthPct)}</span>
        <small>Tx change</small>
      </span>
      <span className="row-chevron" aria-hidden="true">↗</span>
    </button>
  );
}

function MetricEvidence({ label, comparison }: { label: string; comparison: MetricComparison }) {
  const current = comparison.current ?? 0;
  const baseline = comparison.baseline ?? 0;
  const max = Math.max(current, baseline, 1);
  const currentWidth = Math.min(100, Math.max(0, (current / max) * 100));
  const baselineWidth = Math.min(100, Math.max(0, (baseline / max) * 100));
  const currentStyle = { width: `${currentWidth}%` } satisfies CSSProperties;
  const baselineStyle = { width: `${baselineWidth}%` } satisfies CSSProperties;
  return (
    <article className="metric-evidence">
      <div className="metric-heading">
        <span>{label}</span>
        <strong className={growthClass(comparison.rawGrowthPct)}>{formatGrowth(comparison.rawGrowthPct)}</strong>
      </div>
      <div className="metric-bars" aria-hidden="true">
        <div className="metric-bar metric-bar-baseline"><span style={baselineStyle} /></div>
        <div className="metric-bar metric-bar-current"><span style={currentStyle} /></div>
      </div>
      <div className="metric-values">
        <span><i className="value-key current-key" />Current <strong>{formatNumber(comparison.current)}</strong></span>
        <span><i className="value-key baseline-key" />Baseline <strong>{formatNumber(comparison.baseline)}</strong></span>
      </div>
    </article>
  );
}

function SignalDetail({ signal }: { signal: ChainSignal }) {
  return (
    <section className="detail-panel" aria-labelledby="detail-title">
      <div className="detail-pipeline" aria-label="Signal process">
        <span className="pipeline-active">Signal</span><b>→</b><span>Evidence</span><b>→</b><span>Why it matters</span><b>→</b><span>Next question</span>
      </div>
      <div className="detail-heading">
        <div>
          <p className="eyebrow eyebrow-small">Selected signal</p>
          <h3 id="detail-title">{chainLabel(signal)}</h3>
          <p className="detail-subtitle">Measured {formatDate(signal.dataTimestamp)} UTC · baseline {formatBaselineRange(signal.baselineRange)}</p>
        </div>
        <div className="detail-score-block">
          <span>Activity Score</span>
          <strong>{formatScore(signal.activityScore)}</strong>
          <span className={statusClass(signal.status)}>{signal.status}</span>
        </div>
      </div>
      <div className="confidence-note">
        <span className="confidence-symbol">✦</span>
        <div><strong>{signal.confidence} confidence</strong><p>{confidenceDescription(signal.confidence)}</p></div>
      </div>
      <div className="detail-section-heading"><p className="eyebrow eyebrow-small">Evidence</p><span>Current activity vs prior 7-day baseline</span></div>
      <div className="evidence-grid">
        {METRIC_ITEMS.map((metric) => (
          <MetricEvidence key={metric.key} label={metric.label} comparison={signal[metric.key]} />
        ))}
      </div>
      <div className="why-next-grid">
        <div className="why-block">
          <p className="eyebrow eyebrow-small">Why this matters</p>
          <h4>{signal.headline}</h4>
          <p>{signal.explanation}</p>
        </div>
        <div className="next-block">
          <p className="eyebrow eyebrow-small">Next question</p>
          <p>{signal.nextQuestion}</p>
          <span className="question-arrow">↗</span>
        </div>
      </div>
    </section>
  );
}

function UncertainState() {
  return (
    <div className="uncertain-state" role="status">
      <span className="uncertain-icon">!</span>
      <div>
        <strong>Current data freshness is uncertain.</strong>
        <p>Ranking is temporarily withheld until a comparable stable data bucket is available.</p>
      </div>
    </div>
  );
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const viewModel = prepareDashboardViewModel(data.signals, data.freshness);
  const [selectedChainId, setSelectedChainId] = useState(viewModel.rankedSignals[0]?.chainId ?? null);
  const selectedSignal = viewModel.rankedSignals.find((signal) => signal.chainId === selectedChainId) ?? viewModel.rankedSignals[0] ?? null;

  return (
    <main className="dashboard-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand-lockup" href="/" aria-label="SnowPulse home">
          <BrandMark />
          <span className="brand-name">SnowPulse</span>
          <span className="brand-divider" />
          <span className="brand-descriptor">Avalanche L1 Activity Intelligence</span>
        </a>
        <div className="topbar-meta">
          <span className="live-indicator"><span className="live-dot" />{data.sourceState}</span>
          <span>{data.monitoredL1Count} L1s monitored</span>
        </div>
      </nav>

      <div className="dashboard-content">
        <section className="dashboard-hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">Attention across the mountain range</p>
            <h1 id="page-title">Where is activity <em>moving</em> across Avalanche?</h1>
            <p className="hero-lede">SnowPulse compares activity across Avalanche L1s and surfaces the networks showing the most meaningful changes.</p>
            <div className="hero-proof"><span className="proof-line" />Many Avalanche L1s <b>→</b> Detect change <b>→</b> Surface signal</div>
          </div>
          <EcosystemVisual />
        </section>

        <FreshnessStrip freshness={data.freshness} sourceState={data.sourceState} />

        <section className="signals-section" aria-labelledby="signals-title">
          <div className="section-heading">
            <div><p className="eyebrow">Discovery layer</p><h2 id="signals-title">Activity Signals</h2></div>
            <p>Ranked by change in transactions and participant activity<br className="desktop-break" /> versus the prior 7-day baseline.</p>
          </div>
          {viewModel.withholdRanking ? <UncertainState /> : (
            <div className="signals-layout">
              <div className="signals-list" aria-label="Ranked Avalanche L1 activity signals">
                {viewModel.rankedSignals.map((signal, index) => (
                  <SignalRow
                    key={signal.chainId}
                    signal={signal}
                    rank={index + 1}
                    selected={signal.chainId === selectedSignal?.chainId}
                    onSelect={setSelectedChainId}
                  />
                ))}
              </div>
              {selectedSignal ? <SignalDetail signal={selectedSignal} /> : null}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>SnowPulse · deterministic intelligence for Avalanche L1 discovery</span>
          <span>Official Avalanche Metrics API · UTC data</span>
        </footer>
      </div>
    </main>
  );
}
