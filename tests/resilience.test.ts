import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboardData, unavailableDashboardData } from "../src/lib/dashboard/data.ts";
import { parseSnowPulseSnapshot, readSnowPulseSnapshot } from "../src/lib/dashboard/snapshot.ts";

test("the checked-in snapshot is a valid real-source schema", () => {
  const snapshot = readSnowPulseSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.source, "AVALANCHE_METRICS_API");
  assert.equal(snapshot.dashboard.monitoredL1Count, 4);
  assert.equal(snapshot.dashboard.signals.length, 4);
  assert.equal(snapshot.dashboard.rankedSignals.length, 4);
});

test("snapshot parser rejects a changed source", () => {
  const snapshot = readSnowPulseSnapshot();
  assert.ok(snapshot);
  assert.equal(parseSnowPulseSnapshot({ ...snapshot, source: "MOCK" }), null);
});

test("live failure falls back to snapshot data", async () => {
  const snapshot = readSnowPulseSnapshot();
  assert.ok(snapshot);
  const data = await loadDashboardData(0, {
    liveLoader: async () => { throw new Error("simulated API outage"); },
    snapshotLoader: () => snapshot,
  });
  assert.equal(data.sourceState, "SNAPSHOT DATA");
  assert.equal(data.monitoredL1Count, 4);
  assert.equal(data.signals.length, 4);
});

test("live failure without a valid snapshot is unavailable", async () => {
  const data = await loadDashboardData(0, {
    liveLoader: async () => { throw new Error("simulated API outage"); },
    snapshotLoader: () => null,
  });
  assert.deepEqual(data, unavailableDashboardData());
  assert.equal(data.sourceState, "UNAVAILABLE");
  assert.equal(data.signals.length, 0);
});
