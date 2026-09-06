import { buildComparableWindow, type AvalancheChain, type CoreMetricSeries } from "../avalanche/metrics.ts";
import { buildChainSignal, comparisonsFromWindow, type ChainSignal } from "./scoring.ts";
import { generateExplanation } from "./explain.ts";

export function buildIntelligenceSignal(
  chain: AvalancheChain,
  series: CoreMetricSeries,
  nowMs = Date.now(),
): ChainSignal {
  const window = buildComparableWindow(series, nowMs);
  const narrative = generateExplanation(comparisonsFromWindow(window));
  return buildChainSignal(chain, window, narrative);
}
