# SnowPulse Gate 2.2 — Stable Data Window Report

## Gate status

Gate 2.2 converts the Gate 2.1 freshness finding into deterministic runtime
behavior. The scoring formula is unchanged; only the selected data bucket and
freshness metadata are now controlled by a cross-chain stability check.

## Validated live behavior

- Frozen Mainnet L1 universe: Beam `4337`, Dexalot `432204`, Gunzilla `43419`,
  Blaze `46975`
- Latest available historical bucket: `2026-09-04T00:00:00Z`
- Latest available state: `PROVISIONAL`
- Selected stable bucket: `2026-09-03T00:00:00Z`
- Historical requests: `12/12` HTTP 200
- Rolling requests: `12/12` HTTP 200
- Latest available bucket is excluded from ranking; the previous common bucket
  is used instead

The current validated ranking order is:

1. Beam
2. Dexalot
3. Blaze
4. Gunzilla

## Provisional detection reason

The newest common historical bucket is marked provisional when both freshness
signals are present:

1. At least three frozen chains have daily `txCount < 50%` of their previous
   daily bucket.
2. At least three frozen chains have rolling `lastDay > 2x` the newest
   historical daily `txCount`.

`txCount` is the primary detector. Participant metrics remain in the
intelligence score and are not required for the freshness heuristic, matching
the Gate 2.1 finding that participant ratios can behave differently on
Dexalot.

If rolling txCount evidence is incomplete, the conservative fallback uses a
historical synchronized-collapse signal. If neither rolling nor historical
evidence establishes a safe bucket, the selector returns `UNCERTAIN` and the
runtime suppresses ranking.

## Baseline rule

The production rule is:

```text
selected stable bucket + previous 7 valid daily buckets
```

Dates are derived from timestamps and are never hard-coded. For the selected
Sep 3 bucket, the unchanged seven-bucket Gate 2 baseline is Aug 27–Sep 2 UTC.
Missing values remain missing and are never converted to zero.

## Freshness metadata

Each intelligence signal exposes:

```ts
type DataFreshness = {
  selectedTimestamp: string;
  latestAvailableTimestamp: string;
  state: "STABLE" | "PROVISIONAL" | "UNCERTAIN";
  usedFallbackBucket: boolean;
  latestAvailableState: "AVAILABLE" | "PROVISIONAL" | "STABLE" | null;
  reason?: string;
};
```

When fallback is used, the selected bucket is `STABLE`, while
`latestAvailableState` remains `PROVISIONAL` and the reason records why the
newest bucket was excluded. The provisional raw observations remain in the
fetched series for diagnostics; they are not overwritten by the fallback.

When freshness is `UNCERTAIN`, the engine returns no selected bucket and the
signal status becomes `INSUFFICIENT_DATA`; ranking therefore cannot silently
present an unverified leaderboard.

## Implementation boundary

Gate 2.2 adds rolling-window retrieval, cross-chain stable-bucket selection,
freshness metadata, CLI evidence, and focused tests. It does not add UI, AI,
deployment, or a new data source.

Official source endpoints:

- `https://metrics.avax.network/v2/chains?network=mainnet`
- `https://metrics.avax.network/v2/chains/{chainId}/metrics/{metric}`
- `https://metrics.avax.network/v2/chains/{chainId}/rollingWindowMetrics/{metric}`
