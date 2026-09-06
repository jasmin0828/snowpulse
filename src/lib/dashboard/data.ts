import {
  DAY_SECONDS,
  fetchDailyMetricSeries,
  fetchMainnetChains,
  fetchRollingMetricSeries,
  utcDayStartSeconds,
  type AvalancheChain,
  type CoreMetricSeries,
  type CoreRollingMetricSeries,
  type DataFreshness,
} from "../avalanche/metrics.ts";
import { buildIntelligenceSignals } from "../intelligence/engine.ts";
import type { ChainSignal } from "../intelligence/scoring.ts";

export const FROZEN_DEMO_CHAIN_IDS = [4337, 432204, 46975, 43419] as const;

export type DashboardData = {
  sourceState: "LIVE DATA" | "SNAPSHOT DATA";
  monitoredL1Count: number;
  signals: ChainSignal[];
  freshness: DataFreshness;
};

function frozenChainsFrom(
  chains: AvalancheChain[],
): AvalancheChain[] {
  return FROZEN_DEMO_CHAIN_IDS.map((chainId) => chains.find(
    (chain) => chain.evmChainId === chainId && chain.network === "mainnet",
  )).filter((chain): chain is NonNullable<typeof chain> => Boolean(chain));
}

export async function loadDashboardData(nowMs = Date.now()): Promise<DashboardData> {
  const chainList = await fetchMainnetChains();
  const frozenChains = frozenChainsFrom(chainList.chains);
  if (chainList.evidence.status !== 200 || frozenChains.length !== FROZEN_DEMO_CHAIN_IDS.length) {
    throw new Error("The official Avalanche Mainnet chain list is unavailable or incomplete.");
  }

  const endTimestamp = utcDayStartSeconds(nowMs);
  const startTimestamp = endTimestamp - 14 * DAY_SECONDS;
  const seriesByChain: Record<number, CoreMetricSeries> = {};
  const rollingByChain: Record<number, CoreRollingMetricSeries> = {};

  await Promise.all(frozenChains.map(async (chain) => {
    const [series, rolling] = await Promise.all([
      fetchDailyMetricSeries(chain.evmChainId, startTimestamp, endTimestamp),
      fetchRollingMetricSeries(chain.evmChainId),
    ]);
    seriesByChain[chain.evmChainId] = series;
    rollingByChain[chain.evmChainId] = rolling;
  }));

  const { signals, selection } = buildIntelligenceSignals(
    frozenChains,
    seriesByChain,
    rollingByChain,
    nowMs,
  );

  return {
    sourceState: "LIVE DATA",
    monitoredL1Count: frozenChains.length,
    signals,
    freshness: selection.freshness,
  };
}
