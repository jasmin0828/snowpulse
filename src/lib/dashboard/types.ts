import type { DataFreshness } from "../avalanche/metrics.ts";
import type { ChainSignal } from "../intelligence/scoring.ts";

export const FROZEN_DEMO_CHAIN_IDS = [4337, 432204, 46975, 43419] as const;

export type DashboardSourceState = "LIVE DATA" | "SNAPSHOT DATA" | "UNAVAILABLE";

export type DashboardData = {
  sourceState: DashboardSourceState;
  monitoredL1Count: number;
  signals: ChainSignal[];
  freshness: DataFreshness;
};
