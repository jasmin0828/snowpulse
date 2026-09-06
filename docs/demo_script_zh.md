# SnowPulse 2 分钟中文 Demo Script

## 0:00–0:20｜Problem

Avalanche 已经不只是 C-Chain，而是多个相互独立的 L1。

问题不是没有链上数据，而是数据分散。研究人员面对多条链时，往往不知道应该先看哪一条，也不应该手动检查每一条链之后再做第一轮比较。

## 0:20–0:45｜Discovery

现在打开 SnowPulse。

这里展示的是四条冻结的 Avalanche L1：Beam、Dexalot、Blaze 和 Gunzilla。Activity Signals 会根据真实的 Avalanche Metrics API 数据动态排序，帮助我们先找到最值得关注的变化。

当前 Beam 排在第一位，Activity Score 是 61.8，状态是 ACTIVE，置信度是 HIGH。这个分数不是手写的，也不是 mock 数据。

## 0:45–1:10｜Freshness Intelligence

这里有一个重要的 freshness layer。

最新返回的数据不一定就是最新可信的数据。当前最新 available bucket 是 Sep 4，但它被标记为 provisional；SnowPulse 选择了 Sep 3 这个 latest stable completed bucket，再进行排名。

也就是说，SnowPulse 不会因为 API 返回了一个更新日期，就盲目拿它做比较。它优先保证数据窗口可比、结果更诚实。

## 1:10–1:35｜Evidence

点击 Beam 的详情。

这里可以看到 Activity Score、ACTIVE 状态和 HIGH confidence。Evidence 区域分别展示 Transactions、Active Addresses 和 Active Senders，并把当前值与之前 7 个有效日的 baseline 放在一起比较。

Activity Score 是确定性的注意力信号，不是投资评分，也不预测价格。小样本会降低权重和置信度，缺失数据也不会被偷偷当成 0。

## 1:35–1:50｜Intelligence

继续往下看 Why This Matters 和 Next Question。

SnowPulse 不只是说“哪条链分数最高”，还把结构化证据转成一条谨慎的解释，并给出下一步值得调查的问题。当前 MVP 不依赖 LLM，解释完全来自确定性的规则。

## 1:50–2:00｜Close

Explorer 告诉你已经知道要查的东西；SnowPulse 帮你发现原本不知道应该优先关注的变化。
