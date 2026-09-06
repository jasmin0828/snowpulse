# Project Name

SnowPulse

# Tagline

Avalanche L1 Activity Intelligence

# Short Description

SnowPulse is a deterministic activity-intelligence layer for Avalanche L1s.
It reads real Avalanche Metrics API data, selects the latest stable comparable
window, and ranks where activity deserves attention across a focused universe
of Beam, Dexalot, Blaze, and Gunzilla.

The product turns fragmented chain data into an evidence-backed signal: an
Activity Score, confidence level, plain-language explanation, and the next
research question. It is built for discovery, not trading or investment advice.

# Full Description

Avalanche 已经不只是 C-Chain，而是由多个相互独立的 L1 组成的生态。数据并不缺少，真正稀缺的是注意力：研究人员不应该先手动打开每一条链的工具，再自己判断哪一个变化值得关注。

SnowPulse 面向这个问题建立了一层轻量的 Avalanche L1 Activity Intelligence。它从官方 Avalanche Metrics API 读取真实链上活动数据，先判断最新可用的 daily bucket 是否稳定，再用选定的稳定数据与之前 7 个有效日进行比较。系统随后用透明、确定性的 Activity Score 对 Beam、Dexalot、Blaze 和 Gunzilla 排序，并展示交易量、活跃地址、活跃发送者的证据。

SnowPulse 的核心不是替用户预测价格，而是帮助用户发现下一步应该研究什么。每个 signal 都包含 confidence、Why This Matters 和 Next Question，让“发现变化”自然连接到“解释证据”和“继续调查”。

Explorer 告诉你已经知道要查的东西；SnowPulse 帮你发现原本不知道应该优先关注的变化。

# How It's Made / Technical Details

- Next.js + TypeScript + React application deployed on Vercel
- Server-side loading from the official Avalanche Metrics API
- Frozen demo universe: Beam, Dexalot, Blaze, and Gunzilla
- Core metrics: `txCount`, `activeAddresses`, `activeSenders`
- Stable-window selector that distinguishes latest available from latest trusted data
- Deterministic Activity Score with 40% transaction growth, 40% active-address growth, and 20% active-sender growth
- Previous 7 valid daily buckets as baseline
- Small-sample protection, growth caps, confidence levels, and `missing != zero` handling
- Deterministic explanation layer for Why This Matters and Next Question
- Real API snapshot fallback for live-data failure, with explicit LIVE DATA / SNAPSHOT DATA / UNAVAILABLE states

No smart contracts were required for this MVP. No LLM is required for current
runtime intelligence.

# What Was Built During Hackathon

SnowPulse was created from scratch during Avalanche Builder Day Chengdu. The
completed work includes:

- Product definition and focused L1 discovery thesis
- New public GitHub repository
- Real Avalanche Metrics API integration
- Stable freshness and data-window layer
- Deterministic intelligence engine
- Production dashboard
- Resilience and real snapshot fallback
- Vercel production deployment

# Avalanche Integration

SnowPulse uses the official Avalanche Metrics API to compare activity across
Beam, Dexalot, Blaze, and Gunzilla. The current MVP uses transaction count,
active addresses, and active senders, with a stable completed daily bucket and
the previous seven valid daily buckets as baseline.

# Demo URL

https://snowpulse.vercel.app

# GitHub

https://github.com/jasmin0828/snowpulse
