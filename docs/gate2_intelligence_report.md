# SnowPulse Gate 2 — Deterministic Intelligence Engine

**Capture:** `2026-09-06T06:46:41Z`
**Universe:** Beam `4337`, Dexalot `432204`, Gunzilla `43419`, Blaze `46975`
**Data source:** official Avalanche Metrics API only; no LLM, mock data, or new data source

## Gate 2 scope

This gate implements the deterministic intelligence layer only:

- latest completed comparable UTC daily bucket
- previous seven complete daily buckets as baseline
- raw and capped growth
- volume-confidence protection
- 0–100 Activity Score, status, and confidence
- evidence-grounded rule explanation
- one deterministic next research question per chain

No final dashboard, AI integration, Vercel update, or screenshot work is included.

## Current data window

The CLI queried:

`GET https://metrics.avax.network/v2/chains/{chainId}/metrics/{metric}?startTimestamp=1787443200&endTimestamp=1788652800&timeInterval=day&pageSize=20`

The chain list was discovered from:

`GET https://metrics.avax.network/v2/chains?network=mainnet`

The engine filters the frozen IDs against the returned `network=mainnet` records
and never adds dynamic chains. `endTimestamp` is the current UTC day boundary,
so a partial current UTC day cannot be selected. It then intersects timestamps
across `txCount`, `activeAddresses`, and `activeSenders` and selects the newest
common timestamp.

- Current completed comparable bucket:
  `2026-09-04T00:00:00Z` through `2026-09-05T00:00:00Z`
- Baseline range:
  `2026-08-28T00:00:00Z` through `2026-09-04T00:00:00Z`
- Baseline buckets: `2026-08-28` through `2026-09-03` UTC, seven points
- Actual current API point selected: `2026-09-04T00:00:00Z`
- Freshness is represented by `dataTimestamp`; this capture does not claim a
  fixed API lag. The latest returned bucket may change as the API updates.

Every frozen chain had `7/7` valid baseline observations for every core metric.
No missing baseline day was converted to zero.

## Deterministic model

For each metric:

```text
rawGrowthPct = (current - baseline) / baseline * 100
scoringGrowthPct = clamp(rawGrowthPct, -100, +200)
normalizedGrowth = scoringGrowthPct / 100       when scoringGrowthPct < 0
                   scoringGrowthPct / 200       otherwise
```

The raw growth is retained for evidence. A baseline of zero is never rendered
as infinite growth: `0 -> 0` is `ZERO_BASELINE_NEUTRAL`, and `0 -> positive` is
`NEW_ACTIVITY`; both reduce confidence and contribute a conservative neutral
signal to scoring. A null baseline leaves the metric unavailable.

The current-activity sample floors are the requested first-pass floors:

| Metric | WEAK | MEDIUM | STRONG |
| ------ | ----: | ------: | ------: |
| txCount | `< 100` | `100–999` | `>= 1000` |
| activeAddresses | `< 25` | `25–99` | `>= 100` |
| activeSenders | `< 20` | `20–74` | `>= 75` |

The volume-confidence factors are explicit and intentionally conservative:

```text
STRONG = 1.00
MEDIUM = 0.60
WEAK = 0.25
UNAVAILABLE = 0.00
```

The score uses the requested metric weights after applying each metric's
volume factor:

```text
weightedAggregate =
    0.40 * normalizedTxGrowth      * txVolumeFactor
  + 0.40 * normalizedAddressGrowth * addressVolumeFactor
  + 0.20 * normalizedSenderGrowth  * senderVolumeFactor

scoreBeforeConfidencePenalty = 50 + 50 * weightedAggregate
Activity Score = clamp(scoreBeforeConfidencePenalty - penalty, 0, 100)

HIGH penalty = 0
MEDIUM penalty = 5
LOW penalty = 10
```

Thus neutral strong activity remains approximately `50`, and a weak `5 -> 20`
sample cannot win solely because of a large percentage increase.

Confidence is deterministic:

- `HIGH`: all metrics normal, seven valid baseline points, and all current
  samples strong
- `MEDIUM`: all core metrics usable, no zero-baseline anomaly, and either a
  medium sample or 4–6 valid baseline points
- `LOW`: weak sample, missing metric, zero-baseline anomaly, or fewer than four
  valid baseline points
- `INSUFFICIENT_DATA` status: no score can be responsibly calculated, or a low
  confidence score would otherwise qualify for `HEATING`

Status thresholds remain frozen at `HEATING >= 70`, `ACTIVE 55–69.9`,
`STABLE 45–54.9`, and `COOLING < 45`.

## Actual intelligence output

| Chain | Score | Status | Confidence | Tx Growth | Address Growth | Sender Growth |
| ----- | ----: | ------ | ---------- | --------: | -------------: | -------------: |
| Beam | 9.0 | COOLING | HIGH | -81.8% | -81.5% | -83.1% |
| Dexalot | 23.6 | COOLING | HIGH | -90.3% | -27.5% | -28.2% |
| Gunzilla | 6.0 | COOLING | HIGH | -94.7% | -82.5% | -85.8% |
| Blaze | 11.1 | COOLING | MEDIUM | -92.0% | -75.9% | -76.3% |

The result is not visually manipulated: the selected current bucket is lower
than its seven-day baseline for all four chains, so all four are cooling under
the frozen rules.

## Raw evidence

| Chain | Metric | Current | 7-day baseline mean | Valid / missing baseline days | Sample / factor | Raw growth |
| ----- | ------ | ------: | ------------------: | ---------------------------: | --------------- | ---------: |
| Beam | txCount | 1,192 | 6,555.286 | 7 / 0 | STRONG / 1.00 | -81.8% |
| Beam | activeAddresses | 1,368 | 7,383.143 | 7 / 0 | STRONG / 1.00 | -81.5% |
| Beam | activeSenders | 943 | 5,571.571 | 7 / 0 | STRONG / 1.00 | -83.1% |
| Dexalot | txCount | 17,496 | 181,123.143 | 7 / 0 | STRONG / 1.00 | -90.3% |
| Dexalot | activeAddresses | 120 | 165.429 | 7 / 0 | STRONG / 1.00 | -27.5% |
| Dexalot | activeSenders | 97 | 135.143 | 7 / 0 | STRONG / 1.00 | -28.2% |
| Gunzilla | txCount | 21,067 | 396,262.714 | 7 / 0 | STRONG / 1.00 | -94.7% |
| Gunzilla | activeAddresses | 6,521 | 37,214.857 | 7 / 0 | STRONG / 1.00 | -82.5% |
| Gunzilla | activeSenders | 4,222 | 29,802.286 | 7 / 0 | STRONG / 1.00 | -85.8% |
| Blaze | txCount | 193 | 2,417.429 | 7 / 0 | MEDIUM / 0.60 | -92.0% |
| Blaze | activeAddresses | 148 | 613.286 | 7 / 0 | STRONG / 1.00 | -75.9% |
| Blaze | activeSenders | 136 | 575.000 | 7 / 0 | STRONG / 1.00 | -76.3% |

## Ranking

1. Dexalot — `23.6`
2. Blaze — `11.1`
3. Beam — `9.0`
4. Gunzilla — `6.0`

Only score-bearing, non-`INSUFFICIENT_DATA` signals are rankable. Tie breaks,
if needed, are deterministic by ascending EVM chain ID.

## Explanation quality

### Beam — Broad activity cooling

- Explanation: “Transactions and participant activity declined together,
  indicating broad cooling during the measured period.”
- Next question: “Which contracts or metrics contributed most to the activity
  decline?”

### Dexalot — Broad activity cooling

- Explanation: “Transactions and participant activity declined together,
  indicating broad cooling during the measured period.”
- Next question: “Which contracts or metrics contributed most to the activity
  decline?”

### Gunzilla — Broad activity cooling

- Explanation: “Transactions and participant activity declined together,
  indicating broad cooling during the measured period.”
- Next question: “Which contracts or metrics contributed most to the activity
  decline?”

### Blaze — Broad activity cooling

- Explanation: “Transactions and participant activity declined together,
  indicating broad cooling during the measured period.”
- Next question: “Which contracts or metrics contributed most to the activity
  decline?”

The explanation generator uses only metric direction and relative magnitude.
It does not claim causality or infer user acquisition, whales, bots, or token
speculation.

## Edge-case evidence

- **Zero baselines:** handled explicitly as `ZERO_BASELINE_NEUTRAL` or
  `NEW_ACTIVITY`; never infinite growth. No zero-baseline case occurred in the
  four-chain live run.
- **Missing days:** missing points remain missing. The live frozen universe had
  no missing baseline days; tests cover a six-valid/one-missing baseline.
- **Small samples:** Blaze `txCount=193` is MEDIUM and receives factor `0.60`;
  its address and sender samples are STRONG. The live frozen universe has no
  WEAK metric, while the tests cover weak samples.
- **Growth caps:** tests verify `+500% -> +200%` for scoring while raw `+500%`
  remains visible. The live four-chain growth values are all within the cap.
- **Metric semantics:** the engine consumes the official API values without
  redefining `activeAddresses` or `activeSenders`; those upstream semantics
  include the documented transaction and ERC20/ERC721/ERC1155 transfer-log
  address fields.

## Validation

- Focused tests: `11 passed, 0 failed`
- Covered: positive/negative growth, zero baseline, missing baseline day, weak
  sample, +500% cap, HEATING, STABLE, COOLING, explanation patterns, and
  deterministic ranking
- Real CLI: all four frozen chains processed without crash; 12/12 core metric
  requests returned HTTP `200`
- `npm run build`: PASS
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS before commit

## Gate 2 verdict

`PASS`

The deterministic engine meets the Gate 2 acceptance conditions. The current
real data produces a cooling ranking; that is the evidence-grounded result.
Stop here for review. Gate 3 work has not started.
