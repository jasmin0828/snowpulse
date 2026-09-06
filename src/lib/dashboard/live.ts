import {
  DAY_SECONDS,
  fetchDailyMetricSeries,
  fetchMainnetChains,
  fetchRollingMetricSeries,
  utcDayStartSeconds,
  type AvalancheChain,
  type CoreMetricSeries,
  type CoreRollingMetricSeries,
} from "../avalanche/metrics.ts";
import { buildIntelligenceSignals } from "../intelligence/engine.ts";
import type { ChainSignal } from "../intelligence/scoring.ts";
import { FROZEN_DEMO_CHAIN_IDS, type DashboardData } from "./types.ts";

export { FROZEN_DEMO_CHAIN_IDS } from "./types.ts";

function frozenChainsFrom(chains: AvalancheChain[]): AvalancheChain[] {
  return FROZEN_DEMO_CHAIN_IDS.map((chainId) => chains.find(
    (chain) => chain.evmChainId === chainId && chain.network === "mainnet",
  )).filter((chain): chain is NonNullable<typeof chain> => Boolean(chain));
}

function hasComparableSignal(signal: ChainSignal): boolean {
  const metrics = [signal.txCount, signal.activeAddresses, signal.activeSenders];
  return signal.activityScore !== null
    && signal.status !== "INSUFFICIENT_DATA"
    && metrics.every((metric) => metric.current !== null && metric.baseline !== null);
}

function isUsableLiveResult(
  signals: ChainSignal[],
  monitoredL1Count: number,
): boolean {
  return monitoredL1Count === FROZEN_DEMO_CHAIN_IDS.length
    && signals.length === FROZEN_DEMO_CHAIN_IDS.length
    && signals.every(hasComparableSignal)
    && signals[0]?.freshness.state !== "UNCERTAIN";
}

export async function loadLiveDashboardData(nowMs = Date.now()): Promise<DashboardData> {
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

  if (!isUsableLiveResult(signals, frozenChains.length)) {
    throw new Error(selection.freshness.reason ?? "Live Avalanche metrics are not sufficient for a comparable dashboard result.");
  }

  return {
    sourceState: "LIVE DATA",
    monitoredL1Count: frozenChains.length,
    signals,
    freshness: selection.freshness,
  };
}
