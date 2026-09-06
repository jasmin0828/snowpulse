import {
  buildComparableWindow,
  selectStableDailyBucket,
  type AvalancheChain,
  type CoreMetricSeries,
  type CoreRollingMetricSeries,
  type DataFreshness,
  type StableBucketSelection,
} from "../avalanche/metrics.ts";
import { buildChainSignal, comparisonsFromWindow, type ChainSignal } from "./scoring.ts";
import { generateExplanation } from "./explain.ts";

export type IntelligenceSignalOptions = {
  selectedTimestamp?: number | null;
  freshness?: DataFreshness;
};

export function buildIntelligenceSignal(
  chain: AvalancheChain,
  series: CoreMetricSeries,
  nowMs = Date.now(),
  options: IntelligenceSignalOptions = {},
): ChainSignal {
  const window = buildComparableWindow(series, nowMs, options.selectedTimestamp);
  const narrative = generateExplanation(comparisonsFromWindow(window));
  return buildChainSignal(chain, window, narrative, options.freshness);
}

export function buildIntelligenceSignals(
  chains: AvalancheChain[],
  seriesByChain: Record<number, CoreMetricSeries>,
  rollingByChain: Record<number, CoreRollingMetricSeries> | undefined,
  nowMs = Date.now(),
): { signals: ChainSignal[]; selection: StableBucketSelection } {
  const selection = selectStableDailyBucket(chains, seriesByChain, rollingByChain, nowMs);
  const signals = chains.map((chain) => buildIntelligenceSignal(
    chain,
    seriesByChain[chain.evmChainId],
    nowMs,
    {
      selectedTimestamp: selection.selectedTimestamp,
      freshness: selection.freshness,
    },
  ));
  return { signals, selection };
}
