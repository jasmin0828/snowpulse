import type { DataFreshness } from "../avalanche/metrics.ts";
import { loadLiveDashboardData } from "./live.ts";
import { readSnowPulseSnapshot, snapshotToDashboardData, type SnowPulseSnapshot } from "./snapshot.ts";
import { FROZEN_DEMO_CHAIN_IDS, type DashboardData } from "./types.ts";

export { FROZEN_DEMO_CHAIN_IDS } from "./types.ts";

export type DashboardLoaderDependencies = {
  liveLoader?: (nowMs: number) => Promise<DashboardData>;
  snapshotLoader?: () => SnowPulseSnapshot | null;
};

function unavailableFreshness(): DataFreshness {
  return {
    selectedTimestamp: "MISSING",
    latestAvailableTimestamp: "MISSING",
    state: "UNCERTAIN",
    usedFallbackBucket: false,
    latestAvailableState: null,
    reason: "Live Avalanche metrics were unusable and no valid real snapshot was available.",
  };
}

export function unavailableDashboardData(): DashboardData {
  return {
    sourceState: "UNAVAILABLE",
    monitoredL1Count: FROZEN_DEMO_CHAIN_IDS.length,
    signals: [],
    freshness: unavailableFreshness(),
  };
}

export async function loadDashboardData(
  nowMs = Date.now(),
  dependencies: DashboardLoaderDependencies = {},
): Promise<DashboardData> {
  try {
    return await (dependencies.liveLoader ?? loadLiveDashboardData)(nowMs);
  } catch {
    const snapshot = (dependencies.snapshotLoader ?? readSnowPulseSnapshot)();
    return snapshot ? snapshotToDashboardData(snapshot) : unavailableDashboardData();
  }
}
