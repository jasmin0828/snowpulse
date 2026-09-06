# SnowPulse

**Avalanche L1 Activity Intelligence**

*Discover where activity is heating up across Avalanche.*

## Problem

Avalanche activity is distributed across multiple sovereign L1s. The problem
is not a lack of data; it is fragmented information and limited attention.
Researchers should not need to inspect every chain manually before discovering
which activity changes deserve a closer look.

## Solution

SnowPulse automatically:

1. Reads real Avalanche L1 metrics.
2. Determines the latest stable data window.
3. Compares current activity with a prior 7-day baseline.
4. Computes a deterministic Activity Score.
5. Surfaces notable L1 activity signals.
6. Explains the evidence and proposes the next research question.

## Key Insight

> Explorers help you inspect something you already know to look for. SnowPulse
> helps you discover what deserves attention first.

## Avalanche Integration

SnowPulse uses the official Avalanche Metrics API and currently monitors a
frozen demo universe of four Avalanche L1s:

- Beam
- Dexalot
- Blaze
- Gunzilla

The MVP uses `txCount`, `activeAddresses`, and `activeSenders`.

## Stable Data Window

The newest available daily bucket is not automatically treated as trustworthy.
SnowPulse can mark a bucket provisional when cross-chain freshness evidence
suggests incomplete backfill, then use the latest stable completed bucket for
comparison. In one hackathon capture, Sep 4 was provisional and Sep 3 was
selected as stable; these dates are an example, not a permanent API lag rule.

## Activity Score

The transparent score weights activity change as:

- 40% transaction growth
- 40% active-address growth
- 20% active-sender growth

It uses the previous 7 valid daily buckets as baseline and includes small-
sample protection, growth caps, confidence levels, and explicit missing-data
handling. Missing values are never converted to zero.

Activity Score is an attention signal, not an investment score. It does not
predict price or represent financial advice.

## Intelligence

Ranking and scoring are deterministic. The current MVP does not depend on an
LLM. Structured evidence is converted into two research-oriented outputs:

- Why This Matters
- Next Question

## Resilience

SnowPulse has three explicit source states:

- `LIVE DATA` — a usable current Avalanche API result
- `SNAPSHOT DATA` — a previously captured real API result used during live failure
- `UNAVAILABLE` — no usable live result and no valid real snapshot

The snapshot is generated from real Avalanche API output and is never fabricated.

## Tech Stack

- Next.js
- TypeScript
- React
- Node.js
- Avalanche Metrics API
- Vercel

## Live Demo

https://snowpulse.vercel.app

## Repository

https://github.com/jasmin0828/snowpulse

## Run Locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Limitations

- Avalanche daily metrics are not tick-by-tick real-time.
- Activity does not imply economic quality.
- Activity Score does not predict price.
- Small or missing datasets reduce confidence.
- The MVP currently monitors four selected Avalanche L1s.

## Future

- Broader Avalanche L1 coverage
- Deeper contract and application attribution
- Richer signal explanations
- Historical trend views
