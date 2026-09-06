import {
  fetchDailyMetricSeries,
  fetchMainnetChains,
  formatUtcTimestamp,
  utcDayStartSeconds,
} from "../src/lib/avalanche/metrics.ts";
import { buildIntelligenceSignal } from "../src/lib/intelligence/engine.ts";
import { rankSignals, type ChainSignal } from "../src/lib/intelligence/scoring.ts";

const FROZEN_CHAIN_IDS = [4337, 432204, 43419, 46975];

function formatPercent(value: number | null): string {
  return value === null ? "MISSING" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function printDetail(signal: ChainSignal): void {
  console.log(`\n${signal.chainName} (${signal.chainId})`);
  console.log(`  data bucket: ${signal.dataTimestamp}`);
  console.log(`  baseline: ${signal.baselineRange}`);
  for (const [label, comparison] of [
    ["txCount", signal.txCount],
    ["activeAddresses", signal.activeAddresses],
    ["activeSenders", signal.activeSenders],
  ] as const) {
    console.log(
      `  ${label}: current=${comparison.current ?? "MISSING"} baseline=${comparison.baseline?.toFixed(3) ?? "MISSING"}`
      + ` raw=${formatPercent(comparison.rawGrowthPct)} capped=${formatPercent(comparison.cappedGrowthPct)}`
      + ` sample=${comparison.sampleQuality} factor=${comparison.volumeConfidenceFactor}`
      + ` baseline_days=${comparison.validBaselineDays}/7 missing=${comparison.missingBaselineDays}`,
    );
  }
  console.log(`  headline: ${signal.headline}`);
  console.log(`  explanation: ${signal.explanation}`);
  console.log(`  next question: ${signal.nextQuestion}`);
}

async function main(): Promise<void> {
  const nowMs = Date.now();
  const endTimestamp = utcDayStartSeconds(nowMs);
  const startTimestamp = endTimestamp - 14 * 86_400;
  const chainList = await fetchMainnetChains();
  const selectedChains = FROZEN_CHAIN_IDS.map((chainId) => chainList.chains.find(
    (chain) => chain.evmChainId === chainId && chain.network === "mainnet" && chainId !== 43114,
  )).filter((chain): chain is NonNullable<typeof chain> => Boolean(chain));

  console.log(`capture_utc\t${new Date(nowMs).toISOString()}`);
  console.log(`chain_list\t${chainList.evidence.status ?? "NETWORK"}\t${chainList.evidence.latencyMs}ms`);
  console.log(`frozen_universe\t${selectedChains.map((chain) => `${chain.chainName}:${chain.evmChainId}`).join(", ")}`);
  console.log(`query_range\t${formatUtcTimestamp(startTimestamp)} to ${formatUtcTimestamp(endTimestamp)}\tend exclusive`);

  const signals: ChainSignal[] = [];
  const requestEvidence = [];
  for (const chain of selectedChains) {
    const series = await fetchDailyMetricSeries(chain.evmChainId, startTimestamp, endTimestamp);
    requestEvidence.push(...Object.values(series).map((metric) => metric.request));
    signals.push(buildIntelligenceSignal(chain, series, nowMs));
  }

  const successfulRequests = requestEvidence.filter((request) => request.status === 200).length;
  const latencyValues = requestEvidence.map((request) => request.latencyMs).filter(Number.isFinite);
  console.log(`core_metric_requests\t${successfulRequests}/${requestEvidence.length}\tHTTP 200`);
  console.log(`core_metric_latency_ms\t${latencyValues.length ? `${Math.min(...latencyValues)}-${Math.max(...latencyValues)}` : "MISSING"}`);

  console.log("\nINTELLIGENCE_OUTPUT");
  console.log("Chain\tScore\tStatus\tConfidence\tTx Growth\tAddress Growth\tSender Growth");
  for (const signal of signals) {
    console.log([
      signal.chainName,
      signal.activityScore ?? "MISSING",
      signal.status,
      signal.confidence,
      formatPercent(signal.txCount.rawGrowthPct),
      formatPercent(signal.activeAddresses.rawGrowthPct),
      formatPercent(signal.activeSenders.rawGrowthPct),
    ].join("\t"));
  }
  console.log("\nRANKING");
  for (const [index, signal] of rankSignals(signals).entries()) {
    console.log(`${index + 1}. ${signal.chainName} (${signal.activityScore})`);
  }
  for (const signal of signals) printDetail(signal);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
