import assert from "node:assert/strict";
import test from "node:test";
import type {
  AvalancheChain,
  CoreMetricSeries,
  CoreRollingMetricSeries,
  DailyMetricPoint,
  MetricSeries,
} from "../src/lib/avalanche/metrics.ts";
import {
  buildComparableWindow,
  DAY_SECONDS,
  selectStableDailyBucket,
} from "../src/lib/avalanche/metrics.ts";
import { classifyPattern, generateExplanation } from "../src/lib/intelligence/explain.ts";
import { buildIntelligenceSignals } from "../src/lib/intelligence/engine.ts";
import {
  buildChainSignal,
  buildMetricComparison,
  computeActivityScore,
  comparisonsFromWindow,
  rankSignals,
  type CoreComparisons,
} from "../src/lib/intelligence/scoring.ts";

const chain: AvalancheChain = {
  chainName: "Test Chain",
  evmChainId: 1,
  network: "mainnet",
  blockchainId: "blockchain",
  subnetId: "subnet",
};

const request = { url: "test", status: 200, latencyMs: 1, error: null };

function series(values: Record<number, number>): MetricSeries {
  const points: DailyMetricPoint[] = Object.entries(values).map(([timestamp, value]) => ({
    timestamp: Number(timestamp),
    value,
  }));
  return { points, request };
}

function allSeries(values: Record<number, number>): CoreMetricSeries {
  return { txCount: series(values), activeAddresses: series(values), activeSenders: series(values) };
}

function rollingSeries(lastDay: number | null): CoreRollingMetricSeries {
  return {
    txCount: { lastDay, request },
    activeAddresses: { lastDay, request },
    activeSenders: { lastDay, request },
  };
}

function frozenChains(): AvalancheChain[] {
  return [4337, 432204, 43419, 46975].map((evmChainId) => ({
    chainName: `Chain ${evmChainId}`,
    evmChainId,
    network: "mainnet",
    blockchainId: `blockchain-${evmChainId}`,
    subnetId: `subnet-${evmChainId}`,
  }));
}

function seriesByFrozenChain(values: Record<number, number>): Record<number, CoreMetricSeries> {
  return Object.fromEntries(frozenChains().map((frozenChain) => [frozenChain.evmChainId, allSeries(values)]));
}

function rollingByFrozenChain(lastDay: number | null): Record<number, CoreRollingMetricSeries> {
  return Object.fromEntries(frozenChains().map((frozenChain) => [frozenChain.evmChainId, rollingSeries(lastDay)]));
}

function comparisons(txRatio: number, addressRatio: number, senderRatio: number): CoreComparisons {
  return {
    txCount: buildMetricComparison("txCount", 2_000 * txRatio, 2_000, 7, 0),
    activeAddresses: buildMetricComparison("activeAddresses", 200 * addressRatio, 200, 7, 0),
    activeSenders: buildMetricComparison("activeSenders", 150 * senderRatio, 150, 7, 0),
  };
}

test("positive growth is calculated and normalized", () => {
  const comparison = buildMetricComparison("txCount", 200, 100, 7, 0);
  assert.equal(comparison.rawGrowthPct, 100);
  assert.equal(comparison.cappedGrowthPct, 100);
  assert.equal(comparison.normalizedGrowth, 0.5);
});

test("negative growth is calculated and normalized", () => {
  const comparison = buildMetricComparison("txCount", 50, 100, 7, 0);
  assert.equal(comparison.rawGrowthPct, -50);
  assert.equal(comparison.normalizedGrowth, -0.5);
});

test("zero baseline is explicit and never becomes infinite growth", () => {
  const neutral = buildMetricComparison("txCount", 0, 0, 7, 0);
  const newActivity = buildMetricComparison("txCount", 20, 0, 7, 0);
  assert.equal(neutral.rawGrowthPct, null);
  assert.equal(neutral.growthKind, "ZERO_BASELINE_NEUTRAL");
  assert.equal(neutral.normalizedGrowth, 0);
  assert.equal(newActivity.rawGrowthPct, null);
  assert.equal(newActivity.growthKind, "NEW_ACTIVITY");
  assert.equal(newActivity.normalizedGrowth, 0);
});

test("missing baseline day is tracked without zero filling", () => {
  const current = 1_000_000;
  const values: Record<number, number> = { [current]: 200 };
  for (let index = 1; index <= 7; index += 1) {
    if (index !== 3) values[current - index * 86_400] = 100;
  }
  const window = buildComparableWindow(allSeries(values), (current + 86_400) * 1000);
  const comparison = comparisonsFromWindow(window).txCount;
  assert.equal(comparison.validBaselineDays, 6);
  assert.equal(comparison.missingBaselineDays, 1);
  assert.equal(comparison.baseline, 100);
});

test("newest synchronized collapse is provisional and selects the previous common bucket", () => {
  const latest = 100 * DAY_SECONDS;
  const values: Record<number, number> = {
    [latest]: 100,
    [latest - DAY_SECONDS]: 300,
    [latest - 2 * DAY_SECONDS]: 300,
  };
  const selection = selectStableDailyBucket(
    frozenChains(),
    seriesByFrozenChain(values),
    rollingByFrozenChain(1_000),
    (latest + DAY_SECONDS) * 1000,
  );
  assert.equal(selection.latestAvailableTimestamp, latest);
  assert.equal(selection.selectedTimestamp, latest - DAY_SECONDS);
  assert.equal(selection.freshness.state, "STABLE");
  assert.equal(selection.freshness.latestAvailableState, "PROVISIONAL");
  assert.equal(selection.freshness.usedFallbackBucket, true);
  assert.deepEqual(selection.severeDropChainIds, [4337, 432204, 43419, 46975]);
  assert.deepEqual(selection.rollingInconsistentChainIds, [4337, 432204, 43419, 46975]);
});

test("newest bucket stays stable when the cross-chain heuristic does not trigger", () => {
  const latest = 100 * DAY_SECONDS;
  const values: Record<number, number> = {
    [latest]: 300,
    [latest - DAY_SECONDS]: 300,
  };
  const selection = selectStableDailyBucket(
    frozenChains(),
    seriesByFrozenChain(values),
    rollingByFrozenChain(350),
    (latest + DAY_SECONDS) * 1000,
  );
  assert.equal(selection.selectedTimestamp, latest);
  assert.equal(selection.freshness.state, "STABLE");
  assert.equal(selection.freshness.latestAvailableState, "STABLE");
  assert.equal(selection.freshness.usedFallbackBucket, false);
  assert.deepEqual(selection.severeDropChainIds, []);
  assert.deepEqual(selection.rollingInconsistentChainIds, []);
});

test("missing rolling evidence uses the conservative historical-collapse fallback", () => {
  const latest = 100 * DAY_SECONDS;
  const values: Record<number, number> = {
    [latest]: 100,
    [latest - DAY_SECONDS]: 300,
  };
  const selection = selectStableDailyBucket(
    frozenChains(),
    seriesByFrozenChain(values),
    undefined,
    (latest + DAY_SECONDS) * 1000,
  );
  assert.equal(selection.selectedTimestamp, latest - DAY_SECONDS);
  assert.equal(selection.freshness.state, "STABLE");
  assert.equal(selection.freshness.latestAvailableState, "PROVISIONAL");
  assert.equal(selection.rollingEvidenceComplete, false);
});

test("uncertain freshness does not silently select a bucket when rolling evidence is missing", () => {
  const latest = 100 * DAY_SECONDS;
  const values: Record<number, number> = {
    [latest]: 300,
    [latest - DAY_SECONDS]: 300,
  };
  const selection = selectStableDailyBucket(
    frozenChains(),
    seriesByFrozenChain(values),
    undefined,
    (latest + DAY_SECONDS) * 1000,
  );
  assert.equal(selection.selectedTimestamp, null);
  assert.equal(selection.freshness.state, "UNCERTAIN");
  assert.equal(selection.freshness.latestAvailableState, "AVAILABLE");
});

test("universe intelligence signals expose the selected bucket freshness", () => {
  const latest = 100 * DAY_SECONDS;
  const values: Record<number, number> = {
    [latest]: 100,
    [latest - DAY_SECONDS]: 300,
  };
  const { signals, selection } = buildIntelligenceSignals(
    frozenChains(),
    seriesByFrozenChain(values),
    rollingByFrozenChain(1_000),
    (latest + DAY_SECONDS) * 1000,
  );
  assert.equal(signals.length, 4);
  assert.equal(signals[0].dataTimestamp, new Date((latest - DAY_SECONDS) * 1000).toISOString());
  assert.equal(signals[0].freshness.state, "STABLE");
  assert.equal(signals[0].freshness.latestAvailableTimestamp, new Date(latest * 1000).toISOString());
  assert.equal(signals[0].freshness.usedFallbackBucket, true);
  assert.deepEqual(signals.map((signal) => signal.freshness), signals.map(() => selection.freshness));
});

test("weak samples receive a small-base factor", () => {
  const comparison = buildMetricComparison("activeAddresses", 20, 10, 7, 0);
  assert.equal(comparison.sampleQuality, "WEAK");
  assert.equal(comparison.volumeConfidenceFactor, 0.25);
});

test("extreme growth is capped for scoring while raw growth is preserved", () => {
  const comparison = buildMetricComparison("txCount", 600, 100, 7, 0);
  assert.equal(comparison.rawGrowthPct, 500);
  assert.equal(comparison.cappedGrowthPct, 200);
  assert.equal(comparison.normalizedGrowth, 1);
});

test("broad growth produces HEATING", () => {
  const signal = buildChainSignal(chain, {
    currentTimestamp: 1_000_000,
    baselineTimestamps: [],
    baselineRangeStart: 900_000,
    baselineRangeEnd: 999_999,
    currentByMetric: { txCount: 6_000, activeAddresses: 600, activeSenders: 450 },
    baselineByMetric: { txCount: 2_000, activeAddresses: 200, activeSenders: 150 },
    validBaselineDays: { txCount: 7, activeAddresses: 7, activeSenders: 7 },
    missingBaselineDays: { txCount: 0, activeAddresses: 0, activeSenders: 0 },
  }, generateExplanation(comparisons(3, 3, 3)));
  assert.equal(signal.status, "HEATING");
  assert.equal(signal.confidence, "HIGH");
});

test("neutral strong activity produces STABLE", () => {
  const neutral = comparisons(1, 1, 1);
  assert.equal(computeActivityScore(neutral), 50);
  assert.equal(classifyPattern(neutral), "MIXED");
});

test("broad decline produces COOLING", () => {
  const cooling = comparisons(0.5, 0.5, 0.5);
  const score = computeActivityScore(cooling);
  assert.equal(score, 25);
  assert.equal(generateExplanation(cooling).pattern, "COOLING");
});

test("explanations select evidence-grounded patterns", () => {
  assert.equal(generateExplanation(comparisons(3, 1, 1)).pattern, "EXISTING_INTENSITY");
  assert.equal(generateExplanation(comparisons(1, 3, 3)).pattern, "BROADER_PARTICIPATION");
  assert.match(generateExplanation(comparisons(3, 1, 1)).explanation, /existing participants/);
});

test("ranking excludes insufficient data and breaks ties by chain id", () => {
  const makeSignal = (id: number, score: number | null) => ({
    chainId: id,
    chainName: `Chain ${id}`,
    activityScore: score,
    status: score === null ? "INSUFFICIENT_DATA" : "ACTIVE",
  }) as never;
  const ranked = rankSignals([makeSignal(2, 60), makeSignal(1, 60), makeSignal(3, null)]);
  assert.deepEqual(ranked.map((signal) => signal.chainId), [1, 2]);
});
