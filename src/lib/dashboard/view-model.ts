import { rankSignals, type ChainSignal } from "../intelligence/scoring.ts";
import type { DataFreshness } from "../avalanche/metrics.ts";

export type DashboardViewModel = {
  rankedSignals: ChainSignal[];
  withholdRanking: boolean;
};

export function prepareDashboardViewModel(
  signals: ChainSignal[],
  freshness: DataFreshness,
): DashboardViewModel {
  const withholdRanking = freshness.state === "UNCERTAIN";
  return {
    rankedSignals: withholdRanking ? [] : rankSignals(signals),
    withholdRanking,
  };
}

export function freshnessSummary(freshness: DataFreshness): {
  primary: string;
  secondary: string;
} {
  if (freshness.state === "UNCERTAIN") {
    return {
      primary: "Current data freshness is uncertain",
      secondary: "Ranking is temporarily withheld.",
    };
  }
  if (freshness.usedFallbackBucket) {
    return {
      primary: "Latest stable data",
      secondary: `${freshness.latestAvailableTimestamp} available · provisional`,
    };
  }
  return {
    primary: "Latest stable data",
    secondary: freshness.selectedTimestamp,
  };
}
