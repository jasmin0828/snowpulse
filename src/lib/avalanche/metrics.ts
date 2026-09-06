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

export type RollingMetricSeries = {
  lastDay: number | null;
  request: RequestEvidence;
};

export type CoreRollingMetricSeries = Record<CoreMetricName, RollingMetricSeries>;

export type DataFreshnessState = "STABLE" | "PROVISIONAL" | "UNCERTAIN";
export type DailyBucketState = "AVAILABLE" | "PROVISIONAL" | "STABLE";

export type DataFreshness = {
  selectedTimestamp: string;
  latestAvailableTimestamp: string;
  state: DataFreshnessState;
  usedFallbackBucket: boolean;
  latestAvailableState: DailyBucketState | null;
  reason?: string;
};

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

function parseRollingLastDay(value: unknown): number | null {
  if (!isJsonRecord(value)) return null;
  const result = isJsonRecord(value.result) ? value.result : value;
  return parseNumber(result.lastDay);
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

export function rollingWindowMetricsUrl(chainId: number, metric: CoreMetricName): string {
  return `${AVALANCHE_METRICS_BASE_URL}/v2/chains/${chainId}/rollingWindowMetrics/${metric}`;
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

export async function fetchRollingMetricSeries(
  chainId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CoreRollingMetricSeries> {
  const entries = await Promise.all(CORE_METRICS.map(async (metric) => {
    const url = rollingWindowMetricsUrl(chainId, metric);
    const response = await requestJson(url, 15_000, fetchImpl);
    return [metric, { lastDay: parseRollingLastDay(response.body), request: response.evidence }] as const;
  }));
  return Object.fromEntries(entries) as CoreRollingMetricSeries;
}

function pointsByTimestamp(series: MetricSeries, beforeTimestamp: number): Map<number, number> {
  return new Map(
    series.points
      .filter((point) => point.timestamp < beforeTimestamp)
      .map((point) => [point.timestamp, point.value]),
  );
}

function commonDailyTimestamps(
  chains: AvalancheChain[],
  seriesByChain: Record<number, CoreMetricSeries>,
  beforeTimestamp: number,
): number[] {
  const timestampSets = chains.flatMap((chain) => CORE_METRICS.map((metric) => {
    const series = seriesByChain[chain.evmChainId]?.[metric];
    return new Set(series ? pointsByTimestamp(series, beforeTimestamp).keys() : []);
  }));
  if (timestampSets.length === 0 || timestampSets.some((set) => set.size === 0)) return [];
  return [...timestampSets[0]]
    .filter((timestamp) => timestampSets.every((set) => set.has(timestamp)))
    .sort((left, right) => right - left);
}

function rollingLastDay(
  rollingByChain: Record<number, CoreRollingMetricSeries> | undefined,
  chainId: number,
): number | null {
  return rollingByChain?.[chainId]?.txCount.lastDay ?? null;
}

export type StableBucketSelection = {
  selectedTimestamp: number | null;
  latestAvailableTimestamp: number | null;
  freshness: DataFreshness;
  severeDropChainIds: number[];
  rollingInconsistentChainIds: number[];
  rollingEvidenceComplete: boolean;
};

function makeFreshness(
  selectedTimestamp: number | null,
  latestAvailableTimestamp: number | null,
  state: DataFreshnessState,
  usedFallbackBucket: boolean,
  latestAvailableState: DailyBucketState | null,
  reason?: string,
): DataFreshness {
  return {
    selectedTimestamp: formatUtcTimestamp(selectedTimestamp),
    latestAvailableTimestamp: formatUtcTimestamp(latestAvailableTimestamp),
    state,
    usedFallbackBucket,
    latestAvailableState,
    ...(reason ? { reason } : {}),
  };
}

/**
 * Select the newest common daily bucket that is safe to use for cross-chain scoring.
 * The freshness heuristic is intentionally limited to the newest bucket and txCount:
 * participant metrics remain available for scoring, but are not required to flag
 * an underfilled historical bucket.
 */
export function selectStableDailyBucket(
  chains: AvalancheChain[],
  seriesByChain: Record<number, CoreMetricSeries>,
  rollingByChain: Record<number, CoreRollingMetricSeries> | undefined,
  nowMs = Date.now(),
): StableBucketSelection {
  const currentDayStart = utcDayStartSeconds(nowMs);
  const commonTimestamps = commonDailyTimestamps(chains, seriesByChain, currentDayStart);
  const latestAvailableTimestamp = commonTimestamps[0] ?? null;
  if (latestAvailableTimestamp === null) {
    return {
      selectedTimestamp: null,
      latestAvailableTimestamp,
      freshness: makeFreshness(
        null,
        null,
        "UNCERTAIN",
        false,
        null,
        "No common non-null daily bucket exists across all frozen chains and required metrics.",
      ),
      severeDropChainIds: [],
      rollingInconsistentChainIds: [],
      rollingEvidenceComplete: false,
    };
  }

  const severeDropChainIds: number[] = [];
  const rollingInconsistentChainIds: number[] = [];
  let rollingEvidenceCount = 0;
  for (const chain of chains) {
    const txSeries = seriesByChain[chain.evmChainId]?.txCount;
    const points = txSeries ? pointsByTimestamp(txSeries, currentDayStart) : new Map<number, number>();
    const current = points.get(latestAvailableTimestamp);
    const previous = points.get(latestAvailableTimestamp - DAY_SECONDS);
    if (current !== undefined && previous !== undefined && previous > 0 && current < previous * 0.5) {
      severeDropChainIds.push(chain.evmChainId);
    }

    const rolling = rollingLastDay(rollingByChain, chain.evmChainId);
    if (rolling !== null && current !== undefined) {
      rollingEvidenceCount += 1;
      if (rolling > current * 2) rollingInconsistentChainIds.push(chain.evmChainId);
    }
  }

  const evidenceThreshold = Math.min(3, chains.length);
  const synchronizedCollapse = severeDropChainIds.length >= evidenceThreshold;
  const rollingInconsistency = rollingInconsistentChainIds.length >= evidenceThreshold;
  const rollingEvidenceComplete = chains.length > 0 && rollingEvidenceCount === chains.length;
  const successorExists = commonTimestamps.includes(latestAvailableTimestamp + DAY_SECONDS);
  const fallbackTimestamp = commonTimestamps.find((timestamp) => timestamp < latestAvailableTimestamp) ?? null;

  if (!successorExists && synchronizedCollapse && (rollingInconsistency || !rollingEvidenceComplete)) {
    if (fallbackTimestamp === null) {
      return {
        selectedTimestamp: null,
        latestAvailableTimestamp,
        freshness: makeFreshness(
          null,
          latestAvailableTimestamp,
          "UNCERTAIN",
          false,
          "PROVISIONAL",
          "The newest bucket is provisional, but no previous common bucket is available for a safe fallback.",
        ),
        severeDropChainIds,
        rollingInconsistentChainIds,
        rollingEvidenceComplete,
      };
    }
    const evidenceReason = rollingEvidenceComplete
      ? `Newest bucket ${formatUtcTimestamp(latestAvailableTimestamp)} is provisional: ${severeDropChainIds.length}/${chains.length} chains dropped below 50% of the previous daily txCount and ${rollingInconsistentChainIds.length}/${chains.length} rolling lastDay values exceed 2x historical txCount.`
      : `Newest bucket ${formatUtcTimestamp(latestAvailableTimestamp)} is provisional: ${severeDropChainIds.length}/${chains.length} chains dropped below 50% of the previous daily txCount while rolling txCount evidence is incomplete.`;
    return {
      selectedTimestamp: fallbackTimestamp,
      latestAvailableTimestamp,
      freshness: makeFreshness(
        fallbackTimestamp,
        latestAvailableTimestamp,
        "STABLE",
        true,
        "PROVISIONAL",
        evidenceReason,
      ),
      severeDropChainIds,
      rollingInconsistentChainIds,
      rollingEvidenceComplete,
    };
  }

  if (!rollingEvidenceComplete && !synchronizedCollapse) {
    return {
      selectedTimestamp: null,
      latestAvailableTimestamp,
      freshness: makeFreshness(
        null,
        latestAvailableTimestamp,
        "UNCERTAIN",
        false,
        "AVAILABLE",
        "Rolling txCount evidence is incomplete and historical data does not establish that the newest bucket is stable.",
      ),
      severeDropChainIds,
      rollingInconsistentChainIds,
      rollingEvidenceComplete,
    };
  }

  return {
    selectedTimestamp: latestAvailableTimestamp,
    latestAvailableTimestamp,
    freshness: makeFreshness(
      latestAvailableTimestamp,
      latestAvailableTimestamp,
      "STABLE",
      false,
      "STABLE",
      "Newest common daily bucket passed the cross-chain freshness checks.",
    ),
    severeDropChainIds,
    rollingInconsistentChainIds,
    rollingEvidenceComplete,
  };
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
  selectedTimestampOverride?: number | null,
): ComparableWindow {
  const currentTimestamp = selectedTimestampOverride === undefined
    ? selectLatestComparableBucket(series, nowMs)
    : selectedTimestampOverride;
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
