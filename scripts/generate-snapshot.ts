import { mkdir, writeFile } from "node:fs/promises";
import { loadLiveDashboardData } from "../src/lib/dashboard/live.ts";
import { prepareDashboardViewModel } from "../src/lib/dashboard/view-model.ts";

const liveData = await loadLiveDashboardData();
const viewModel = prepareDashboardViewModel(liveData.signals, liveData.freshness);
const snapshot = {
  schemaVersion: 1 as const,
  generatedAt: new Date().toISOString(),
  source: "AVALANCHE_METRICS_API" as const,
  dashboard: {
    monitoredL1Count: liveData.monitoredL1Count,
    signals: liveData.signals,
    freshness: liveData.freshness,
    rankedSignals: viewModel.rankedSignals,
    withholdRanking: viewModel.withholdRanking,
  },
};

await mkdir("data", { recursive: true });
await writeFile("data/snapshot.json", `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(`Wrote real Avalanche API snapshot generated at ${snapshot.generatedAt}.`);
