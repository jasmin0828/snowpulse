import assert from "node:assert/strict";
import test from "node:test";
import type { AvalancheChain, CoreMetricSeries, DailyMetricPoint, MetricSeries } from "../src/lib/avalanche/metrics.ts";
import { buildComparableWindow } from "../src/lib/avalanche/metrics.ts";
import { classifyPattern, generateExplanation } from "../src/lib/intelligence/explain.ts";
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
