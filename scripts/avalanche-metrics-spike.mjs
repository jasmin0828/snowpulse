#!/usr/bin/env node

const BASE_URL = "https://metrics.avax.network";
const CHAIN_LIST_URL = `${BASE_URL}/v2/chains?network=mainnet`;
const METRICS = ["txCount", "activeAddresses", "activeSenders"];
const PREFERRED_CHAIN_IDS = [4337, 432204, 43419, 46975, 13322, 84358, 2044, 53935];
const REQUEST_TIMEOUT_MS = 15_000;
const DAY_SECONDS = 86_400;

function utcDayStartSeconds(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / DAY_SECONDS) * DAY_SECONDS;
}

function isoTimestamp(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function formatValue(value) {
  if (value === null || value === undefined) return "MISSING";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(3);
  }
  return String(value);
}

async function requestJson(url) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: "non-JSON response" };
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      body,
      error: response.ok ? null : body?.message || body?.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      latencyMs: Math.round(performance.now() - startedAt),
      body: null,
      error: error?.name === "AbortError" ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resultPoints(response) {
  return Array.isArray(response?.body?.results) ? response.body.results : [];
}

function latestCommonTimestamp(metricResponses) {
  const timestampSets = METRICS.map((metric) =>
    new Set(resultPoints(metricResponses[metric]).map((point) => point.timestamp)),
  );
  if (timestampSets.some((set) => set.size === 0)) return null;
  const common = [...timestampSets[0]].filter((timestamp) => timestampSets.every((set) => set.has(timestamp)));
  return common.sort((a, b) => b - a)[0] ?? null;
}

function valueAt(response, timestamp) {
  return resultPoints(response).find((point) => point.timestamp === timestamp)?.value;
}

function dailyStatus(metricResponses, timestamp) {
  const errors = METRICS.flatMap((metric) => {
    const response = metricResponses[metric];
    return response.ok ? [] : [`${metric}: ${response.error}`];
  });
  if (errors.length > 0) return `FAILED (${errors.join("; ")})`;
  if (timestamp === null) return "NO COMMON WINDOW";

  const values = METRICS.map((metric) => valueAt(metricResponses[metric], timestamp));
  if (values.some((value) => value === null || value === undefined)) return "MISSING VALUE";
  if (values.some((value) => value === 0)) return "REAL ZERO PRESENT";
  if (values.some((value) => value < 20)) return "LOW SAMPLE";
  return "READY";
}

function averageLatency(responses) {
  const values = Object.values(responses).map((response) => response.latencyMs).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function printDailyRow(chain, metricResponses) {
  const timestamp = latestCommonTimestamp(metricResponses);
  const values = METRICS.map((metric) => formatValue(valueAt(metricResponses[metric], timestamp)));
  const pointCounts = METRICS.map((metric) => resultPoints(metricResponses[metric]).length).join("/");
  const window = timestamp === null ? "—" : `${isoTimestamp(timestamp)} to ${isoTimestamp(timestamp + DAY_SECONDS)}`;
  console.log([
    chain.chainName,
    chain.evmChainId,
    ...values,
    window,
    dailyStatus(metricResponses, timestamp),
    `points=${pointCounts}`,
    `avg_latency_ms=${averageLatency(metricResponses) ?? "MISSING"}`,
  ].join("\t"));
}

function printRollingRow(chain, metricResponses) {
  for (const metric of METRICS) {
    const response = metricResponses[metric];
    const result = response.body?.result;
    const value = result?.lastDay;
    console.log([
      chain.chainName,
      chain.evmChainId,
      metric,
      formatValue(value),
      response.ok ? "OK" : `FAILED (${response.error})`,
      `latency_ms=${response.latencyMs}`,
    ].join("\t"));
  }
}

async function queryMetrics(chain, kind, startBoundary, endBoundary) {
  const responses = {};
  await Promise.all(METRICS.map(async (metric) => {
    const url = kind === "daily"
      ? `${BASE_URL}/v2/chains/${chain.evmChainId}/metrics/${metric}?startTimestamp=${startBoundary}&endTimestamp=${endBoundary}&timeInterval=day&pageSize=20`
      : `${BASE_URL}/v2/chains/${chain.evmChainId}/rollingWindowMetrics/${metric}`;
    responses[metric] = await requestJson(url);
  }));
  return responses;
}

async function main() {
  const captureSeconds = Math.floor(Date.now() / 1000);
  const endBoundary = utcDayStartSeconds();
  const startBoundary = endBoundary - 14 * DAY_SECONDS;
  const chainListResponse = await requestJson(CHAIN_LIST_URL);

  if (!chainListResponse.ok) {
    console.error(`chain list failed: HTTP ${chainListResponse.status ?? "network"} (${chainListResponse.error})`);
    process.exitCode = 1;
    return;
  }

  const chains = Array.isArray(chainListResponse.body?.chains) ? chainListResponse.body.chains : [];
  const mainnetChains = chains.filter((chain) => chain.network === "mainnet");
  const cChain = mainnetChains.find((chain) => Number(chain.evmChainId) === 43114);
  const selectedChains = PREFERRED_CHAIN_IDS
    .map((chainId) => mainnetChains.find((chain) => Number(chain.evmChainId) === chainId))
    .filter(Boolean);

  console.log(`capture_utc\t${isoTimestamp(captureSeconds)}`);
  console.log(`chain_list\t${CHAIN_LIST_URL}`);
  console.log(`chain_list_http\t${chainListResponse.status}\tlatency_ms=${chainListResponse.latencyMs}`);
  console.log(`mainnet_chain_count\t${mainnetChains.length}`);
  console.log(`excluded_c_chain\t${cChain?.chainName ?? "not found"}\t${cChain?.evmChainId ?? "43114"}`);
  console.log(`daily_query_window\t${isoTimestamp(startBoundary)} to ${isoTimestamp(endBoundary)}\tend is exclusive`);
  console.log(`selected_l1_count\t${selectedChains.length}`);
  console.log("");

  const dailyResponses = new Map();
  const rollingResponses = new Map();
  for (const chain of selectedChains) {
    dailyResponses.set(chain.evmChainId, await queryMetrics(chain, "daily", startBoundary, endBoundary));
    rollingResponses.set(chain.evmChainId, await queryMetrics(chain, "rolling", startBoundary, endBoundary));
  }

  console.log("DAILY_METRICS");
  console.log("Chain\tEVM Chain ID\ttxCount\tactiveAddresses\tactiveSenders\tWindow\tStatus\tEvidence");
  for (const chain of selectedChains) printDailyRow(chain, dailyResponses.get(chain.evmChainId));
  console.log("");

  console.log("ROLLING_LAST_DAY");
  console.log("Chain\tEVM Chain ID\tMetric\tlastDay\tStatus\tEvidence");
  for (const chain of selectedChains) printRollingRow(chain, rollingResponses.get(chain.evmChainId));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
