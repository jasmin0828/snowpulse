# SnowPulse Post-Hackathon Core Freeze

## A. Freeze Identity

- Project: SnowPulse
- Date: 2026-09-06
- Event: Avalanche Builder Day Chengdu
- Result: Second Prize
- Product baseline commit: `21febb9c7df5958a7e8754ebdd8c50ca0614ed68`
- Freeze tag: `snowpulse-builder-day-2026-v1`
- Production: https://snowpulse.vercel.app

The tag identifies the exact Builder Day production product commit. The
administrative freeze record is maintained in the documentation commit that
follows; the tag is intentionally not moved to that later commit.

## B. Current Product Scope

The frozen Builder Day product implements:

- Avalanche L1 Activity Intelligence
- the official Avalanche Metrics API as the data source
- four frozen Mainnet L1s: Beam, Dexalot, Blaze, and Gunzilla
- daily activity intelligence
- one trusted day compared with the prior seven valid days
- a deterministic Activity Score
- a freshness and stable-window layer
- confidence and data-quality protections
- deterministic explanations
- a live scan interaction using the existing runtime pipeline
- `LIVE DATA`, `SNAPSHOT DATA`, and `UNAVAILABLE` resilience states

The core metrics are Transactions, Active Addresses, and Active Senders. The
score uses the frozen 40% / 40% / 20% weighting for those metrics and retains
the existing growth caps, small-base protection, missing-data semantics, and
confidence handling.

## C. Product Boundary

This freeze does not include future roadmap items such as:

- broader L1 coverage
- 1H / 24H / 7D multi-timeframe intelligence
- contract or application attribution
- activity-signal alerts
- ecosystem validation workflow

Grant roadmap work is not part of the frozen Builder Day baseline.

## D. Grant Status

- Team1 Mini Grant application: Submitted
- Requested amount: USD 5,000
- Application status: Submitted / awaiting review

Grant roadmap milestones:

- M1 — Expand Avalanche L1 Coverage
- M2 — Multi-Timeframe Activity Intelligence
- M3 — Signal Attribution
- M4 — Alerts & Ecosystem Validation

## E. Allowed Pre-Grant Changes

Before an explicit roadmap decision, changes are limited to work necessary for:

- production-blocking bug fixes
- security fixes
- Avalanche upstream API compatibility fixes
- deployment or runtime recovery
- documentation-only updates
- user research or validation notes

## F. Prohibited Pre-Grant Scope Expansion

The following must not be implemented before an explicit future decision:

- new L1 expansion
- new score models
- new timeframes
- attribution engine
- alerts
- LLM integration
- wallet features
- trading or investment signals
- price prediction
- new contracts
- architecture rewrites

## G. Validation Record

Validation was performed against the production deployment on 2026-09-06.

- Existing test suite: PASS, 23 tests passed and 0 failed
- TypeScript check: PASS, `npx tsc --noEmit`
- Production build: PASS, `npm run build`
- `git diff --check`: PASS
- HTTP smoke test: PASS, production returned HTTP 200 without authentication
- Public UI: PASS, scan button and four-L1 dashboard rendered
- Live scan: PASS, returned `LIVE DATA` and completed ranking
- Chain switching: PASS, Dexalot selection updated the signal detail and evidence
- Refresh: PASS, page returned to ready-to-scan state and a subsequent live scan completed
- Runtime error overlay: NOT OBSERVED; browser error log was empty

Observed production data at validation time:

- Stable scoring date: 2026-09-03 UTC
- Latest available date: 2026-09-04 UTC, marked `PROVISIONAL`
- Beam: 61.8, `ACTIVE`, `HIGH`, Transactions +55.7%
- Dexalot: 53.1, `STABLE`, `HIGH`, Transactions +29.2%
- Blaze: 44.3, `COOLING`, `HIGH`, Transactions -15.8%
- Gunzilla: 39.5, `COOLING`, `HIGH`, Transactions -18.9%

These values are validation-time observations and are not hard-coded product
guarantees; upstream Avalanche data may change.

## H. Freeze Administration

The pre-existing modified `.gitignore` and untracked
`docs/gate2_1_sanity_check.md` were preserved. No product source files were
changed for this freeze. The freeze tag remains on the exact product baseline;
the documentation commit is an administrative record only.

SnowPulse is now in Post-Hackathon / Pre-Grant Validation Phase. No feature
development is recommended until a new roadmap decision is made.
