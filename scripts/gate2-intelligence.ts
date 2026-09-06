import {
  fetchDailyMetricSeries,
  fetchMainnetChains,
  fetchRollingMetricSeries,
  formatUtcTimestamp,
  utcDayStartSeconds,
  type CoreMetricSeries,
  type CoreRollingMetricSeries,
} from "../src/lib/avalanche/metrics.ts";
import { buildIntelligenceSignals } from "../src/lib/intelligence/engine.ts";
import { rankSignals, type ChainSignal } from "../src/lib/intelligence/scoring.ts";

const FROZEN_CHAIN_IDS = [4337, 432204, 43419, 46975];

function formatPercent(value: number | null): string {
  return value === null ? "MISSING" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function printDetail(signal: ChainSignal): void {
  console.log(`\n${signal.chainName} (${signal.chainId})`);
  console.log(`  data bucket: ${signal.dataTimestamp}`);
  console.log(`  baseline: ${signal.baselineRange}`);
  console.log(`  freshness: ${signal.freshness.state}`);
  console.log(`  latest available: ${signal.freshness.latestAvailableTimestamp}`);
  console.log(`  fallback bucket: ${signal.freshness.usedFallbackBucket ? "YES" : "NO"}`);
  if (signal.freshness.reason) console.log(`  freshness reason: ${signal.freshness.reason}`);
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
  const missingFrozenChainIds = FROZEN_CHAIN_IDS.filter((chainId) => !selectedChains.some(
    (chain) => chain.evmChainId === chainId,
  ));

  console.log(`capture_utc\t${new Date(nowMs).toISOString()}`);
  console.log(`chain_list\t${chainList.evidence.status ?? "NETWORK"}\t${chainList.evidence.latencyMs}ms`);
  console.log(`frozen_universe\t${selectedChains.map((chain) => `${chain.chainName}:${chain.evmChainId}`).join(", ")}`);
  console.log(`missing_frozen_chain_ids\t${missingFrozenChainIds.join(",") || "NONE"}`);
  console.log(`query_range\t${formatUtcTimestamp(startTimestamp)} to ${formatUtcTimestamp(endTimestamp)}\tend exclusive`);

  if (missingFrozenChainIds.length > 0) {
    console.log("freshness_state\tUNCERTAIN");
    console.log("used_fallback_bucket\tNO");
    console.log("freshness_reason\tOne or more frozen Mainnet L1s are missing from the official chain list; ranking is suppressed.");
    return;
  }

  const seriesByChain: Record<number, CoreMetricSeries> = {};
  const rollingByChain: Record<number, CoreRollingMetricSeries> = {};
  const dailyRequestEvidence = [];
  const rollingRequestEvidence = [];
  for (const chain of selectedChains) {
    const [series, rolling] = await Promise.all([
      fetchDailyMetricSeries(chain.evmChainId, startTimestamp, endTimestamp),
      fetchRollingMetricSeries(chain.evmChainId),
    ]);
    seriesByChain[chain.evmChainId] = series;
    rollingByChain[chain.evmChainId] = rolling;
    dailyRequestEvidence.push(...Object.values(series).map((metric) => metric.request));
    rollingRequestEvidence.push(...Object.values(rolling).map((metric) => metric.request));
  }

  const successfulDailyRequests = dailyRequestEvidence.filter((request) => request.status === 200).length;
  const dailyLatencyValues = dailyRequestEvidence.map((request) => request.latencyMs).filter(Number.isFinite);
  const successfulRollingRequests = rollingRequestEvidence.filter((request) => request.status === 200).length;
  const rollingLatencyValues = rollingRequestEvidence.map((request) => request.latencyMs).filter(Number.isFinite);
  console.log(`historical_metric_requests\t${successfulDailyRequests}/${dailyRequestEvidence.length}\tHTTP 200`);
  console.log(`historical_metric_latency_ms\t${dailyLatencyValues.length ? `${Math.min(...dailyLatencyValues)}-${Math.max(...dailyLatencyValues)}` : "MISSING"}`);
  console.log(`rolling_metric_requests\t${successfulRollingRequests}/${rollingRequestEvidence.length}\tHTTP 200`);
  console.log(`rolling_metric_latency_ms\t${rollingLatencyValues.length ? `${Math.min(...rollingLatencyValues)}-${Math.max(...rollingLatencyValues)}` : "MISSING"}`);

  const { signals, selection } = buildIntelligenceSignals(
    selectedChains,
    seriesByChain,
    rollingByChain,
    nowMs,
  );
  console.log(`freshness_state\t${selection.freshness.state}`);
  console.log(`latest_available_state\t${selection.freshness.latestAvailableState ?? "MISSING"}`);
  console.log(`selected_timestamp\t${selection.freshness.selectedTimestamp}`);
  console.log(`latest_available_timestamp\t${selection.freshness.latestAvailableTimestamp}`);
  console.log(`used_fallback_bucket\t${selection.freshness.usedFallbackBucket ? "YES" : "NO"}`);
  console.log(`severe_tx_drop_chains\t${selection.severeDropChainIds.join(",") || "NONE"}`);
  console.log(`rolling_inconsistency_chains\t${selection.rollingInconsistentChainIds.join(",") || "NONE"}`);
  console.log(`rolling_evidence_complete\t${selection.rollingEvidenceComplete ? "YES" : "NO"}`);
  if (selection.freshness.reason) console.log(`freshness_reason\t${selection.freshness.reason}`);

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
