import assert from "node:assert/strict";
import test from "node:test";
import type { DataFreshness } from "../src/lib/avalanche/metrics.ts";
import { freshnessSummary, prepareDashboardViewModel } from "../src/lib/dashboard/view-model.ts";
import type { ChainSignal } from "../src/lib/intelligence/scoring.ts";

const baseFreshness: DataFreshness = {
  selectedTimestamp: "2026-09-03T00:00:00.000Z",
  latestAvailableTimestamp: "2026-09-04T00:00:00.000Z",
  state: "STABLE",
  usedFallbackBucket: true,
  latestAvailableState: "PROVISIONAL",
};

function signal(chainId: number, score: number | null): ChainSignal {
  return {
    chainId,
    chainName: `chain-${chainId}`,
    dataTimestamp: baseFreshness.selectedTimestamp,
    baselineRange: "2026-08-27T00:00:00.000Z to 2026-09-03T00:00:00.000Z",
    freshness: baseFreshness,
    txCount: {
      current: 100,
      baseline: 100,
      rawGrowthPct: 0,
      cappedGrowthPct: 0,
      normalizedGrowth: 0,
      sampleQuality: "STRONG",
      volumeConfidenceFactor: 1,
      validBaselineDays: 7,
      missingBaselineDays: 0,
      growthKind: "NORMAL",
    },
    activeAddresses: {
      current: 100,
      baseline: 100,
      rawGrowthPct: 0,
      cappedGrowthPct: 0,
      normalizedGrowth: 0,
      sampleQuality: "STRONG",
      volumeConfidenceFactor: 1,
      validBaselineDays: 7,
      missingBaselineDays: 0,
      growthKind: "NORMAL",
    },
    activeSenders: {
      current: 100,
      baseline: 100,
      rawGrowthPct: 0,
      cappedGrowthPct: 0,
      normalizedGrowth: 0,
      sampleQuality: "STRONG",
      volumeConfidenceFactor: 1,
      validBaselineDays: 7,
      missingBaselineDays: 0,
      growthKind: "NORMAL",
    },
    activityScore: score,
    status: score === null ? "INSUFFICIENT_DATA" : "ACTIVE",
    confidence: "HIGH",
    headline: "Test signal",
    explanation: "Test explanation",
    nextQuestion: "Test question",
  };
}

test("dashboard adapter preserves engine ranking order", () => {
  const view = prepareDashboardViewModel([signal(2, 53), signal(1, 62)], baseFreshness);
  assert.deepEqual(view.rankedSignals.map((item) => item.chainId), [1, 2]);
  assert.equal(view.withholdRanking, false);
});

test("dashboard adapter withholds ranking when freshness is uncertain", () => {
  const uncertain: DataFreshness = {
    ...baseFreshness,
    selectedTimestamp: "MISSING",
    state: "UNCERTAIN",
    usedFallbackBucket: false,
    latestAvailableState: "AVAILABLE",
  };
  const view = prepareDashboardViewModel([signal(1, 62)], uncertain);
  assert.deepEqual(view.rankedSignals, []);
  assert.equal(view.withholdRanking, true);
  assert.match(freshnessSummary(uncertain).primary, /uncertain/i);
});

test("stable fallback freshness remains visible in the presentation summary", () => {
  const summary = freshnessSummary(baseFreshness);
  assert.equal(summary.primary, "Latest stable data");
  assert.match(summary.secondary, /provisional/);
});
