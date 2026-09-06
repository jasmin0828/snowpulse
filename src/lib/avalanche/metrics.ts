export const AVALANCHE_METRICS_BASE_URL = "https://metrics.avax.network";
export const MAINNET_CHAIN_LIST_URL = `${AVALANCHE_METRICS_BASE_URL}/v2/chains?network=mainnet`;
export const CORE_METRICS = ["txCount", "activeAddresses", "activeSenders"] as const;
export type CoreMetricName = (typeof CORE_METRICS)[number];

export const DAY_SECONDS = 86_400;

export type AvalancheChain = {
  chainName: string;
  evmChainId: number;
  network: string;
  blockchainId: string;
  subnetId: string;
};

export type DailyMetricPoint = {
  value: number;
  timestamp: number;
};

export type RequestEvidence = {
  url: string;
  status: number | null;
  latencyMs: number;
  error: string | null;
};

export type MetricSeries = {
  points: DailyMetricPoint[];
  request: RequestEvidence;
};

export type CoreMetricSeries = Record<CoreMetricName, MetricSeries>;

export type ComparableWindow = {
  currentTimestamp: number | null;
  baselineTimestamps: number[];
  baselineRangeStart: number | null;
  baselineRangeEnd: number | null;
  currentByMetric: Record<CoreMetricName, number | null>;
  baselineByMetric: Record<CoreMetricName, number | null>;
  validBaselineDays: Record<CoreMetricName, number>;
  missingBaselineDays: Record<CoreMetricName, number>;
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseChain(value: unknown): AvalancheChain | null {
  if (!isJsonRecord(value)) return null;
  const chainName = typeof value.chainName === "string" ? value.chainName : null;
  const evmChainId = parseNumber(value.evmChainId);
  const network = typeof value.network === "string" ? value.network : null;
  const blockchainId = typeof value.blockchainId === "string" ? value.blockchainId : null;
  const subnetId = typeof value.subnetId === "string" ? value.subnetId : null;
  if (!chainName || evmChainId === null || !network || !blockchainId || !subnetId) return null;
  return { chainName, evmChainId, network, blockchainId, subnetId };
}

function parsePoints(value: unknown): DailyMetricPoint[] {
  if (!isJsonRecord(value) || !Array.isArray(value.results)) return [];
  return value.results.flatMap((item) => {
    if (!isJsonRecord(item)) return [];
    const metricValue = parseNumber(item.value);
    const timestamp = parseNumber(item.timestamp);
    if (metricValue === null || timestamp === null) return [];
    return [{ value: metricValue, timestamp }];
  });
}

export function utcDayStartSeconds(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / DAY_SECONDS) * DAY_SECONDS;
}

export function formatUtcTimestamp(timestamp: number | null): string {
  return timestamp === null ? "MISSING" : new Date(timestamp * 1000).toISOString();
}

export function dailyMetricsUrl(
  chainId: number,
  metric: CoreMetricName,
  startTimestamp: number,
  endTimestamp: number,
): string {
  return `${AVALANCHE_METRICS_BASE_URL}/v2/chains/${chainId}/metrics/${metric}?startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}&timeInterval=day&pageSize=20`;
}

export async function requestJson(
  url: string,
  timeoutMs = 15_000,
  fetchImpl: typeof fetch = fetch,
): Promise<{ body: unknown; evidence: RequestEvidence }> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: "non-JSON response" };
    }
    const error = response.ok
      ? null
      : isJsonRecord(body) && typeof body.message === "string"
        ? body.message
        : `HTTP ${response.status}`;
    return {
      body,
      evidence: {
        url,
        status: response.status,
        latencyMs: Math.round(performance.now() - startedAt),
        error,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      body: null,
      evidence: {
        url,
        status: null,
        latencyMs: Math.round(performance.now() - startedAt),
        error: message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMainnetChains(
  fetchImpl: typeof fetch = fetch,
): Promise<{ chains: AvalancheChain[]; evidence: RequestEvidence }> {
  const response = await requestJson(MAINNET_CHAIN_LIST_URL, 15_000, fetchImpl);
  const chains = isJsonRecord(response.body) && Array.isArray(response.body.chains)
    ? response.body.chains.flatMap((chain) => {
      const parsed = parseChain(chain);
      return parsed?.network === "mainnet" ? [parsed] : [];
    })
    : [];
  return { chains, evidence: response.evidence };
}

export async function fetchDailyMetricSeries(
  chainId: number,
  startTimestamp: number,
  endTimestamp: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CoreMetricSeries> {
  const entries = await Promise.all(CORE_METRICS.map(async (metric) => {
    const url = dailyMetricsUrl(chainId, metric, startTimestamp, endTimestamp);
    const response = await requestJson(url, 15_000, fetchImpl);
    return [metric, { points: parsePoints(response.body), request: response.evidence }] as const;
  }));
  return Object.fromEntries(entries) as CoreMetricSeries;
}

function pointsByTimestamp(series: MetricSeries, beforeTimestamp: number): Map<number, number> {
  return new Map(
    series.points
      .filter((point) => point.timestamp < beforeTimestamp)
      .map((point) => [point.timestamp, point.value]),
  );
}

export function selectLatestComparableBucket(
  series: CoreMetricSeries,
  nowMs = Date.now(),
): number | null {
  const currentDayStart = utcDayStartSeconds(nowMs);
  const timestamps = CORE_METRICS.map((metric) => new Set(
    pointsByTimestamp(series[metric], currentDayStart).keys(),
  ));
  if (timestamps.some((set) => set.size === 0)) return null;
  const common = [...timestamps[0]].filter((timestamp) => timestamps.every((set) => set.has(timestamp)));
  return common.sort((left, right) => right - left)[0] ?? null;
}

export function buildComparableWindow(
  series: CoreMetricSeries,
  nowMs = Date.now(),
): ComparableWindow {
  const currentTimestamp = selectLatestComparableBucket(series, nowMs);
  const currentByMetric = Object.fromEntries(
    CORE_METRICS.map((metric) => [metric, null]),
  ) as Record<CoreMetricName, number | null>;
  const baselineByMetric = Object.fromEntries(
    CORE_METRICS.map((metric) => [metric, null]),
  ) as Record<CoreMetricName, number | null>;
  const validBaselineDays = Object.fromEntries(
    CORE_METRICS.map((metric) => [metric, 0]),
  ) as Record<CoreMetricName, number>;
  const missingBaselineDays = Object.fromEntries(
    CORE_METRICS.map((metric) => [metric, 0]),
  ) as Record<CoreMetricName, number>;

  if (currentTimestamp === null) {
    return {
      currentTimestamp,
      baselineTimestamps: [],
      baselineRangeStart: null,
      baselineRangeEnd: null,
      currentByMetric,
      baselineByMetric,
      validBaselineDays,
      missingBaselineDays,
    };
  }

  const baselineTimestamps = Array.from({ length: 7 }, (_, index) => currentTimestamp - (index + 1) * DAY_SECONDS)
    .sort((left, right) => left - right);

  for (const metric of CORE_METRICS) {
    const points = pointsByTimestamp(series[metric], utcDayStartSeconds(nowMs));
    currentByMetric[metric] = points.get(currentTimestamp) ?? null;
    const baselineValues = baselineTimestamps.flatMap((timestamp) => {
      const value = points.get(timestamp);
      return value === undefined ? [] : [value];
    });
    validBaselineDays[metric] = baselineValues.length;
    missingBaselineDays[metric] = baselineTimestamps.length - baselineValues.length;
    baselineByMetric[metric] = baselineValues.length
      ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length
      : null;
  }

  return {
    currentTimestamp,
    baselineTimestamps,
    baselineRangeStart: baselineTimestamps[0],
    baselineRangeEnd: baselineTimestamps[baselineTimestamps.length - 1],
    currentByMetric,
    baselineByMetric,
    validBaselineDays,
    missingBaselineDays,
  };
}
