import type { AvalancheChain, ComparableWindow, CoreMetricName, DataFreshness } from "../avalanche/metrics.ts";

export const SAMPLE_QUALITY = ["STRONG", "MEDIUM", "WEAK", "UNAVAILABLE"] as const;
export type SampleQuality = (typeof SAMPLE_QUALITY)[number];

export const GROWTH_KINDS = ["NORMAL", "UNAVAILABLE", "ZERO_BASELINE_NEUTRAL", "NEW_ACTIVITY"] as const;
export type GrowthKind = (typeof GROWTH_KINDS)[number];

export type MetricComparison = {
  current: number | null;
  baseline: number | null;
  rawGrowthPct: number | null;
  cappedGrowthPct: number | null;
  normalizedGrowth: number | null;
  sampleQuality: SampleQuality;
  volumeConfidenceFactor: number;
  validBaselineDays: number;
  missingBaselineDays: number;
  growthKind: GrowthKind;
};

export type CoreComparisons = Record<CoreMetricName, MetricComparison>;

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type ActivityStatus = "HEATING" | "ACTIVE" | "STABLE" | "COOLING" | "INSUFFICIENT_DATA";

export type ChainSignal = {
  chainId: number;
  chainName: string;
  dataTimestamp: string;
  baselineRange: string;
  freshness: DataFreshness;
  txCount: MetricComparison;
  activeAddresses: MetricComparison;
  activeSenders: MetricComparison;
  activityScore: number | null;
  status: ActivityStatus;
  confidence: Confidence;
  headline: string;
  explanation: string;
  nextQuestion: string;
};

const SAMPLE_FACTORS: Record<SampleQuality, number> = {
  STRONG: 1,
  MEDIUM: 0.6,
  WEAK: 0.25,
  UNAVAILABLE: 0,
};

function sampleQuality(metric: CoreMetricName, current: number | null): SampleQuality {
  if (current === null) return "UNAVAILABLE";
  const thresholds = {
    txCount: [100, 1_000],
    activeAddresses: [25, 100],
    activeSenders: [20, 75],
  } satisfies Record<CoreMetricName, [number, number]>;
  const [mediumFloor, strongFloor] = thresholds[metric];
  if (current < mediumFloor) return "WEAK";
  if (current < strongFloor) return "MEDIUM";
  return "STRONG";
}

export function clampGrowthPct(growthPct: number): number {
  return Math.min(200, Math.max(-100, growthPct));
}

export function normalizeCappedGrowth(cappedGrowthPct: number): number {
  return cappedGrowthPct < 0 ? cappedGrowthPct / 100 : cappedGrowthPct / 200;
}

export function buildMetricComparison(
  metric: CoreMetricName,
  current: number | null,
  baseline: number | null,
  validBaselineDays: number,
  missingBaselineDays: number,
): MetricComparison {
  const quality = sampleQuality(metric, current);
  const base = {
    current,
    baseline,
    rawGrowthPct: null,
    cappedGrowthPct: null,
    normalizedGrowth: null,
    sampleQuality: quality,
    volumeConfidenceFactor: SAMPLE_FACTORS[quality],
    validBaselineDays,
    missingBaselineDays,
    growthKind: "UNAVAILABLE" as GrowthKind,
  };

  if (current === null || baseline === null) return base;
  if (baseline === 0) {
    return {
      ...base,
      normalizedGrowth: 0,
      growthKind: current === 0 ? "ZERO_BASELINE_NEUTRAL" : "NEW_ACTIVITY",
    };
  }

  const rawGrowthPct = ((current - baseline) / baseline) * 100;
  const cappedGrowthPct = clampGrowthPct(rawGrowthPct);
  return {
    ...base,
    rawGrowthPct,
    cappedGrowthPct,
    normalizedGrowth: normalizeCappedGrowth(cappedGrowthPct),
    growthKind: "NORMAL",
  };
}

export function comparisonsFromWindow(window: ComparableWindow): CoreComparisons {
  return {
    txCount: buildMetricComparison(
      "txCount",
      window.currentByMetric.txCount,
      window.baselineByMetric.txCount,
      window.validBaselineDays.txCount,
      window.missingBaselineDays.txCount,
    ),
    activeAddresses: buildMetricComparison(
      "activeAddresses",
      window.currentByMetric.activeAddresses,
      window.baselineByMetric.activeAddresses,
      window.validBaselineDays.activeAddresses,
      window.missingBaselineDays.activeAddresses,
    ),
    activeSenders: buildMetricComparison(
      "activeSenders",
      window.currentByMetric.activeSenders,
      window.baselineByMetric.activeSenders,
      window.validBaselineDays.activeSenders,
      window.missingBaselineDays.activeSenders,
    ),
  };
}

export function determineConfidence(comparisons: CoreComparisons): Confidence {
  const metrics = Object.values(comparisons);
  if (metrics.some((metric) => metric.current === null || metric.baseline === null)) return "LOW";
  if (metrics.some((metric) => metric.growthKind !== "NORMAL")) return "LOW";
  if (metrics.some((metric) => metric.validBaselineDays < 4)) return "LOW";
  if (metrics.every((metric) => metric.validBaselineDays >= 7 && metric.sampleQuality === "STRONG")) return "HIGH";
  return "MEDIUM";
}

function confidencePenalty(confidence: Confidence): number {
  return confidence === "HIGH" ? 0 : confidence === "MEDIUM" ? 5 : 10;
}

export function computeActivityScore(
  comparisons: CoreComparisons,
  confidence = determineConfidence(comparisons),
): number | null {
  const metrics = [comparisons.txCount, comparisons.activeAddresses, comparisons.activeSenders];
  if (metrics.some((metric) => metric.normalizedGrowth === null)) return null;
  const [tx, addresses, senders] = metrics;
  if (tx.normalizedGrowth === null || addresses.normalizedGrowth === null || senders.normalizedGrowth === null) return null;
  const normalizedAggregate =
    0.4 * tx.normalizedGrowth * tx.volumeConfidenceFactor
    + 0.4 * addresses.normalizedGrowth * addresses.volumeConfidenceFactor
    + 0.2 * senders.normalizedGrowth * senders.volumeConfidenceFactor;
  const score = 50 + 50 * normalizedAggregate - confidencePenalty(confidence);
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

export function statusForScore(score: number | null, confidence: Confidence): ActivityStatus {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score >= 70 && confidence === "LOW") return "INSUFFICIENT_DATA";
  if (score >= 70) return "HEATING";
  if (score >= 55) return "ACTIVE";
  if (score >= 45) return "STABLE";
  return "COOLING";
}

export function rankSignals(signals: ChainSignal[]): ChainSignal[] {
  return [...signals]
    .filter((signal) => signal.activityScore !== null && signal.status !== "INSUFFICIENT_DATA")
    .sort((left, right) => {
      const scoreDifference = (right.activityScore ?? -1) - (left.activityScore ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return left.chainId - right.chainId;
    });
}

export function buildChainSignal(
  chain: AvalancheChain,
  window: ComparableWindow,
  narrative: { headline: string; explanation: string; nextQuestion: string },
  freshnessOverride?: DataFreshness,
): ChainSignal {
  const comparisons = comparisonsFromWindow(window);
  const confidence = determineConfidence(comparisons);
  const activityScore = computeActivityScore(comparisons, confidence);
  const status = statusForScore(activityScore, confidence);
  const dataTimestamp = window.currentTimestamp === null
    ? "MISSING"
    : new Date(window.currentTimestamp * 1000).toISOString();
  const baselineRange = window.baselineRangeStart === null || window.baselineRangeEnd === null
    ? "MISSING"
    : `${new Date(window.baselineRangeStart * 1000).toISOString()} to ${new Date((window.baselineRangeEnd + 86_400) * 1000).toISOString()}`;
  const freshness = freshnessOverride ?? {
    selectedTimestamp: dataTimestamp,
    latestAvailableTimestamp: dataTimestamp,
    state: "UNCERTAIN" as const,
    usedFallbackBucket: false,
    latestAvailableState: dataTimestamp === "MISSING" ? null : "AVAILABLE" as const,
    reason: "No cross-chain stable-bucket assessment was supplied.",
  };
  return {
    chainId: chain.evmChainId,
    chainName: chain.chainName,
    dataTimestamp,
    baselineRange,
    freshness,
    ...comparisons,
    activityScore,
    status,
    confidence,
    ...narrative,
  };
}
