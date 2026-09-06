# SnowPulse Gate 1 — Avalanche Real Data Spike

**Capture date:** 2026-09-06 14:31 CST / 2026-09-06 06:31 UTC
**Decision:** `GO` for Gate 1 only. Gate 2 work is intentionally not started.

## Scope and evidence boundary

This spike validates only whether SnowPulse can obtain comparable real activity
data for at least three non-C-Chain Avalanche Mainnet EVM L1s. It does not add a
dashboard, Activity Score, AI, or Vercel deployment. All values below came from
live HTTP requests to the public official Avalanche Metrics API; no mock data or
API key was used.

The primary capture used:

- `now_utc`: `2026-09-06T06:29:34Z`
- Mainnet daily query start: `2026-08-23T00:00:00Z`
- Mainnet daily query end (exclusive): `2026-09-06T00:00:00Z`
- Latest common daily metric timestamp returned for the selected universe:
  `2026-09-04T00:00:00Z`, representing the UTC day
  `[2026-09-04T00:00:00Z, 2026-09-05T00:00:00Z)`.

The daily query returned 13 points for each fully populated metric. The API did
not return a point beginning `2026-09-05`, so the latest returned daily window
is approximately 30 hours behind capture time. That freshness limitation is
explicitly retained in the recommendation; it is not hidden by calling the
point “live”.

## A. Mainnet chain list evidence

Exact request:

`GET https://metrics.avax.network/v2/chains?network=mainnet`

Observed response: HTTP `200`, total latency `1.218s`, capture response body
contained `198` records. Each relevant record included `chainName`,
`evmChainId`, `network`, `blockchainId`, and `subnetId`. The response included
`c_chain` / `43114` with `network=mainnet`; the spike excludes that chain.
No Fuji chain was selected or queried: discovery was explicitly bound to
`network=mainnet`, and every selected record was checked for that literal
network value before requesting metrics.

Selected non-C-Chain records from the same response:

| Chain | EVM Chain ID | blockchainId | subnetId | Network |
| ----- | -----------: | ------------ | -------- | ------- |
| Beam | 4337 | `2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn` | `eYwmVU67LmSfZb1RwqCMhBYkFyG8ftxn6jAwqzFmxC9STBWLC` | mainnet |
| Dexalot | 432204 | `21Ths5Afqi5r4PaoV8r8cruGZWhN11y5rxvy89K8px7pKy3P8E` | `wenKDikJWAYQs3f2v9JhV86fC6kHZwkFZsuUBftnmgZ4QXPnu` | mainnet |
| Gunzilla | 43419 | `2M47TxWHGnhNtq6pM5zPXdATBtuqubxn5EPFgFmEawCQr9WFML` | `2MbQjnTg3yxEtZBfnamboi7K9AajwNq7WExiwReBQSBtwbBVer` | mainnet |
| Blaze | 46975 | `2SfshBPqRJexmqdWBY2xYSTq2Rp2dDisuax7nQB6GyNqPjSWWY` | `j6HXQWdpRhX7yHMWLehUyYDjypHa455vP5tuiXZ81nkPgveFV` | mainnet |

## B. Real Avalanche L1 metrics

The table uses the same historical daily endpoint, the same UTC window, and
the same returned timestamp for all three core metrics. Values are the actual
API `value` fields for `2026-09-04T00:00:00Z`, not normalized or filled in.

| Chain | EVM Chain ID | txCount | Active Addresses | Active Senders | Time Window | Data Status |
| ----- | -----------: | ------: | ---------------: | -------------: | ----------- | ----------- |
| Beam | 4337 | 1,192 | 1,368 | 943 | 2026-09-04 UTC day | READY; 13/13/13 points |
| Dexalot | 432204 | 17,496 | 120 | 97 | 2026-09-04 UTC day | READY; 13/13/13 points |
| Gunzilla | 43419 | 21,067 | 6,521 | 4,222 | 2026-09-04 UTC day | READY; 13/13/13 points |
| Blaze | 46975 | 193 | 148 | 136 | 2026-09-04 UTC day | READY; 13/13/13 points |

This satisfies the minimum universe requirement with four non-C-Chain Mainnet
L1s. Two additional live candidates were also tested: FIFA (13322) returned
all three metrics but at a small sample size on the latest day (`5 / 14 / 10`),
while Titan (84358) returned a real zero for `txCount` on the latest day and is
not included in the recommended demo universe.

Representative exact metric request pattern:

`GET https://metrics.avax.network/v2/chains/{chainId}/metrics/{metric}?startTimestamp=1787443200&endTimestamp=1788652800&timeInterval=day&pageSize=20`

The selected rows were backed by these exact endpoint combinations:

- Beam: `/v2/chains/4337/metrics/{txCount|activeAddresses|activeSenders}`
- Dexalot: `/v2/chains/432204/metrics/{txCount|activeAddresses|activeSenders}`
- Gunzilla: `/v2/chains/43419/metrics/{txCount|activeAddresses|activeSenders}`
- Blaze: `/v2/chains/46975/metrics/{txCount|activeAddresses|activeSenders}`

## C. API semantics

### Chain list

`GET /v2/chains?network=mainnet` is the authoritative discovery request used
by the spike. The returned `network` field was checked for the literal
`mainnet`; the C-Chain was excluded by EVM chain ID `43114` before metrics
queries.

### Historical metrics

`GET /v2/chains/{chainId}/metrics/{metric}` accepts `startTimestamp`,
`endTimestamp`, `timeInterval`, and pagination parameters. The spike used
`timeInterval=day`, identical UTC boundaries, and `endTimestamp` as the
exclusive upper bound in its report convention. The API returned Unix-second
timestamps fixed at `00:00:00Z` for daily points, newest first.

- `txCount`: number of transactions in the requested interval.
- `activeAddresses`: distinct addresses appearing in `from` or `to` of a
  transaction or supported token-transfer event in the interval.
- `activeSenders`: the same population rule restricted to addresses in the
  `from` field.

The three metrics are therefore directly comparable when selected at the same
returned daily timestamp. `null`/missing results were not converted to zero.
A numeric zero remains a real returned zero and is reported as such.

### Rolling-window metrics

Exact request pattern:

`GET https://metrics.avax.network/v2/chains/{chainId}/rollingWindowMetrics/{metric}`

This returns a `result` object such as `lastHour`, `lastDay`, `lastWeek`,
`lastMonth`, and longer windows for `txCount`; active addresses and active
senders support `lastHour`, `lastDay`, and `lastWeek`.

Observed `lastDay` evidence for the four recommended L1s:

| Chain | txCount lastDay | Active Addresses lastDay | Active Senders lastDay | Request status |
| ----- | --------------: | -----------------------: | ----------------------: | -------------- |
| Beam | 11,845 | 10,903 | 8,597 | 200 for all 3 |
| Dexalot | 232,858 | 168 | 137 | 200 for all 3 |
| Gunzilla | 321,110 | 30,499 | 23,285 | 200 for all 3 |
| Blaze | 2,013 | 547 | 515 | 200 for all 3 |

Rolling values have no per-point timestamp in the response, so they are
current-at-request-time snapshots rather than historical timestamped daily
points. `lastDay` and `lastWeek` must not be presented as a raw growth
comparison; the windows have different durations and, for unique-address
metrics, the weekly distinct-address set cannot be divided into a true daily
average without additional assumptions.

### Optional metrics

The low-cost optional checks also returned HTTP `200` for all four recommended
chains over the same daily request family. `feesPaid`, `avgTps`, and
`contracts` are available, but `avgTps` was rounded to `0` for Beam and Blaze
on the sampled day, so these are not needed for the Gate 1 decision.

## D. Data quality and reliability

### Missing metrics and zero values

All four recommended chains returned non-empty, non-null values for all three
core metrics at the common timestamp. In the wider 11-chain probe (33 daily
core requests), every HTTP response was `200`, but six metric responses had an
empty `results` array: Gunzilla `43512` active addresses/senders, Delaunch
`96786` active addresses/senders, and XANA `8888` active addresses/senders.
Those empty results remain missing; they were not rendered as zero.

Real numeric zeros were also observed. DFK `53935` and Coqnet `42069` returned
all three daily core metrics as zero in the sampled range. XANA `8888` returned
zero `txCount` plus empty address/sender results. Titan `84358` returned
`0 / 0 / 0` for the latest daily point, while its rolling `lastDay` snapshot was
`138 / 99 / 71`; these chains are not treated as equivalent to the four READY
rows.

### Small samples and anomalies

FIFA `13322` was fully populated but small on the latest returned day (`5`
transactions, `14` active addresses, `10` active senders). Blaze is active but
lower volume (`193 / 148 / 136`) and should be retained only if the demo can
show low-volume chains clearly. Beam, Dexalot, and Gunzilla show materially
larger real activity, although all have large day-to-day changes in the sample.

### Freshness

At the `2026-09-06T06:29:34Z` capture, the newest daily point was
`2026-09-04T00:00:00Z`; no `2026-09-05` point was returned. Official API
documentation states metrics update several times per hour and that the latest
data point may change on each update. The API is therefore available, but the
historical daily feed showed an approximately 30-hour data freshness gap in
this capture. The report calls this out as a demo caveat.

### Latency and HTTP reliability

For the 11-chain probe:

- Historical core metrics: 33/33 HTTP `200`; observed request latency range
  `0.533s–1.220s`.
- Rolling core metrics: 33/33 HTTP `200`; observed request latency range
  `0.536s–1.256s`.
- No `4xx`, `5xx`, timeout, or rate-limit response was observed in the probe.
- The chain-list request was HTTP `200` in `1.218s`.

This is acceptable for a small sequential or bounded-concurrency Hackathon
demo, but the selected chain universe must be curated and the UI should expose
the metric timestamp/freshness rather than imply wall-clock real-time data.

## E. Gate 1 answers

1. **At least three non-C-Chain Mainnet L1s?** Yes: Beam, Dexalot, Gunzilla,
   and Blaze; the chain list marks all four `network=mainnet`.
2. **Real metrics?** Yes: all three core metrics returned live HTTP `200`
   responses and nonzero values for all four recommended rows at a common
   daily timestamp.
3. **Same comparison window?** Yes for the historical endpoint: all rows use
   the same daily interval and the same returned `2026-09-04T00:00:00Z`
   timestamp. A previous day or prior 7-day daily baseline can be computed
   from the same endpoint.
4. **Timestamp/rolling semantics?** Daily points represent the interval
   starting at the timestamp; rolling results are current snapshots with named
   durations and no per-point timestamp.
5. **Stable enough for a field demo?** Availability and latency were stable in
   this bounded probe; daily freshness is not wall-clock current and must be
   labeled.
6. **Missing/small/abnormal data?** Yes, several API-supported chains have
   empty or zero results, and FIFA is small. The spike preserves and reports
   those conditions.
7. **Best strategy today?** Use the historical daily endpoint for comparable
   activity and a curated four-chain universe; optionally show rolling `lastDay`
   as a separate current snapshot, never as an unstandardized `lastDay` vs
   `lastWeek` growth rate.

## F. Recommended MVP data strategy

For the next gate, use these four L1s as the initial demo universe:

- Beam `4337`
- Dexalot `432204`
- Gunzilla `43419`
- Blaze `46975`

Use `txCount`, `activeAddresses`, and `activeSenders` from the historical daily
endpoint. The baseline should be the previous daily point or, preferably for a
less noisy demo, the prior seven daily points averaged independently per
metric. The baseline must use the same metric, same duration, and same daily
timestamp convention. Display the returned data timestamp and a freshness
warning when it lags the current UTC day.

Use the rolling endpoint only as a separately labeled current snapshot. For
`txCount`, a normalized `lastWeek / 7` can be described as a rough weekly
transactions-per-day reference, but do not apply that arithmetic to distinct
active-address or active-sender counts and call it an average.

## G. Reproduction

The minimal spike runner is:

```bash
node scripts/avalanche-metrics-spike.mjs
```

It discovers the Mainnet chain list, excludes EVM chain ID `43114`, selects
eight known candidates for quality comparison, queries all three core metrics
from both endpoint families, uses a 15-second per-request timeout, prints a
tabular result, and continues when an individual request fails.

## H. Gate 1 verdict

`GO`

The minimum real-data condition is met, with a freshness caveat and a curated
universe requirement. Stop here pending review; no Gate 2 implementation is
included in this spike.

## I. Official documentation consulted

- [Avalanche Metrics API — Get metrics for EVM chains](https://build.avax.network/docs/api-reference/metrics-api/chain-metrics/getEvmChainMetrics)
- [Avalanche Metrics API — Get rolling window metrics for EVM chains](https://build.avax.network/docs/api-reference/metrics-api/chain-metrics/getEvmChainRollingWindowMetrics)
- [Avalanche Metrics API — Getting Started](https://build.avax.network/docs/api-reference/metrics-api/getting-started)
