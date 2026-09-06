import snapshotValue from "../../../data/snapshot.json" with { type: "json" };
import type { DataFreshness, DataFreshnessState, DailyBucketState } from "../avalanche/metrics.ts";
import type { ChainSignal, MetricComparison } from "../intelligence/scoring.ts";
import { prepareDashboardViewModel, type DashboardViewModel } from "./view-model.ts";
import { FROZEN_DEMO_CHAIN_IDS, type DashboardData } from "./types.ts";

export type SnowPulseSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: "AVALANCHE_METRICS_API";
  dashboard: {
    monitoredL1Count: number;
    signals: ChainSignal[];
    freshness: DataFreshness;
    rankedSignals: DashboardViewModel["rankedSignals"];
    withholdRanking: boolean;
  };
};

const FRESHNESS_STATES = new Set<DataFreshnessState>(["STABLE", "PROVISIONAL", "UNCERTAIN"]);
const BUCKET_STATES = new Set<DailyBucketState>(["AVAILABLE", "PROVISIONAL", "STABLE"]);
const SAMPLE_QUALITIES = new Set<MetricComparison["sampleQuality"]>(["STRONG", "MEDIUM", "WEAK", "UNAVAILABLE"]);
const GROWTH_KINDS = new Set<MetricComparison["growthKind"]>(["NORMAL", "UNAVAILABLE", "ZERO_BASELINE_NEUTRAL", "NEW_ACTIVITY"]);
const SIGNAL_STATUSES = new Set<ChainSignal["status"]>(["HEATING", "ACTIVE", "STABLE", "COOLING", "INSUFFICIENT_DATA"]);
const CONFIDENCES = new Set<ChainSignal["confidence"]>(["HIGH", "MEDIUM", "LOW"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isMetricComparison(value: unknown): value is MetricComparison {
  if (!isRecord(value)) return false;
  const validBaselineDays = value.validBaselineDays;
  const missingBaselineDays = value.missingBaselineDays;
  return isNullableFiniteNumber(value.current)
    && isNullableFiniteNumber(value.baseline)
    && isNullableFiniteNumber(value.rawGrowthPct)
    && isNullableFiniteNumber(value.cappedGrowthPct)
    && isNullableFiniteNumber(value.normalizedGrowth)
    && SAMPLE_QUALITIES.has(value.sampleQuality as MetricComparison["sampleQuality"])
    && typeof value.volumeConfidenceFactor === "number"
    && Number.isFinite(value.volumeConfidenceFactor)
    && typeof validBaselineDays === "number"
    && Number.isInteger(validBaselineDays)
    && validBaselineDays >= 0
    && typeof missingBaselineDays === "number"
    && Number.isInteger(missingBaselineDays)
    && missingBaselineDays >= 0
    && GROWTH_KINDS.has(value.growthKind as MetricComparison["growthKind"]);
}

function isDataFreshness(value: unknown): value is DataFreshness {
  if (!isRecord(value)) return false;
  return typeof value.selectedTimestamp === "string"
    && typeof value.latestAvailableTimestamp === "string"
    && FRESHNESS_STATES.has(value.state as DataFreshnessState)
    && typeof value.usedFallbackBucket === "boolean"
    && (value.latestAvailableState === null || BUCKET_STATES.has(value.latestAvailableState as DailyBucketState))
    && (value.reason === undefined || typeof value.reason === "string");
}

function isChainSignal(value: unknown): value is ChainSignal {
  if (!isRecord(value)) return false;
  return typeof value.chainId === "number"
    && Number.isInteger(value.chainId)
    && typeof value.chainName === "string"
    && value.chainName.length > 0
    && typeof value.dataTimestamp === "string"
    && typeof value.baselineRange === "string"
    && isDataFreshness(value.freshness)
    && isMetricComparison(value.txCount)
    && isMetricComparison(value.activeAddresses)
    && isMetricComparison(value.activeSenders)
    && isNullableFiniteNumber(value.activityScore)
    && SIGNAL_STATUSES.has(value.status as ChainSignal["status"])
    && CONFIDENCES.has(value.confidence as ChainSignal["confidence"])
    && typeof value.headline === "string"
    && typeof value.explanation === "string"
    && typeof value.nextQuestion === "string";
}

function hasFrozenUniverse(signals: ChainSignal[]): boolean {
  const expected = [...FROZEN_DEMO_CHAIN_IDS].sort((left, right) => left - right);
  const actual = signals.map((signal) => signal.chainId).sort((left, right) => left - right);
  return actual.length === expected.length && actual.every((chainId, index) => chainId === expected[index]);
}

export function parseSnowPulseSnapshot(value: unknown): SnowPulseSnapshot | null {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || value.source !== "AVALANCHE_METRICS_API"
    || typeof value.generatedAt !== "string"
    || Number.isNaN(Date.parse(value.generatedAt))
    || !isRecord(value.dashboard)) {
    return null;
  }

  const dashboard = value.dashboard;
  const monitoredL1Count = dashboard.monitoredL1Count;
  if (!Number.isInteger(dashboard.monitoredL1Count)
    || typeof monitoredL1Count !== "number"
    || monitoredL1Count !== FROZEN_DEMO_CHAIN_IDS.length
    || !Array.isArray(dashboard.signals)
    || dashboard.signals.length !== FROZEN_DEMO_CHAIN_IDS.length
    || !dashboard.signals.every(isChainSignal)
    || !hasFrozenUniverse(dashboard.signals)
    || !isDataFreshness(dashboard.freshness)
    || dashboard.freshness.state === "UNCERTAIN"
    || !Array.isArray(dashboard.rankedSignals)
    || dashboard.rankedSignals.length !== FROZEN_DEMO_CHAIN_IDS.length
    || !dashboard.rankedSignals.every(isChainSignal)
    || !hasFrozenUniverse(dashboard.rankedSignals)
    || typeof dashboard.withholdRanking !== "boolean"
    || dashboard.withholdRanking) {
    return null;
  }

  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    source: "AVALANCHE_METRICS_API",
    dashboard: {
      monitoredL1Count,
      signals: dashboard.signals,
      freshness: dashboard.freshness,
      rankedSignals: dashboard.rankedSignals,
      withholdRanking: dashboard.withholdRanking,
    },
  };
}

export function readSnowPulseSnapshot(): SnowPulseSnapshot | null {
  return parseSnowPulseSnapshot(snapshotValue);
}

export function snapshotToDashboardData(snapshot: SnowPulseSnapshot): DashboardData {
  return {
    sourceState: "SNAPSHOT DATA",
    monitoredL1Count: snapshot.dashboard.monitoredL1Count,
    signals: snapshot.dashboard.signals,
    freshness: snapshot.dashboard.freshness,
  };
}

export function buildSnowPulseSnapshot(
  liveData: DashboardData,
  generatedAt = new Date().toISOString(),
): SnowPulseSnapshot {
  const viewModel = prepareDashboardViewModel(liveData.signals, liveData.freshness);
  return {
    schemaVersion: 1,
    generatedAt,
    source: "AVALANCHE_METRICS_API",
    dashboard: {
      monitoredL1Count: liveData.monitoredL1Count,
      signals: liveData.signals,
      freshness: liveData.freshness,
      rankedSignals: viewModel.rankedSignals,
      withholdRanking: viewModel.withholdRanking,
    },
  };
}
