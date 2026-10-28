// Entirely synthetic history. No personal data or storage mutation.
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeCycle, makeLog, addDays, logsFrom } = require("./helpers.cjs");
const {
  getCycleDayState,
  cycleProgress,
} = require("../.test-build/lib/cycle.js");
const { buildInsights } = require("../.test-build/lib/insights.js");
const { sanitizeData } = require("../.test-build/lib/storage.js");
const TODAY = "2000-05-01";
function history(lastOffset = 18) {
  const logs = {};
  for (const offset of [
    lastOffset + 84,
    lastOffset + 56,
    lastOffset + 28,
    lastOffset,
  ]) {
    const start = addDays(TODAY, -offset);
    for (let d = 0; d < 5; d++) {
      const date = addDays(start, d);
      logs[date] = makeLog(date, { periodFlow: "medium" });
    }
    const end = addDays(start, 5);
    if (end <= TODAY) logs[end] = makeLog(end, { flowRecorded: true });
  }
  return logs;
}
const stats = (logs, today = TODAY) =>
  computeCycle({ logs, today, averagePeriodLength: 5 });
const record = (logs, date = TODAY, patch = {}) => ({
  ...logs,
  [date]: makeLog(date, { periodFlow: "medium", ...patch }),
});
test("A: a real new start replaces a fertile estimate with menstruation, day 1", () => {
  const logs = history();
  const before = stats(logs);
  assert.equal(getCycleDayState(TODAY, before, logs).kind, "fertile-estimated");
  const next = record(logs);
  const after = stats(next);
  assert.equal(after.currentState.kind, "menstruation-recorded");
  assert.equal(after.currentState.label, "Mestruazioni");
  assert.equal(after.currentState.cycleDay, 1);
  assert.equal(after.currentCycleStart, TODAY);
  assert.equal(after.phase, "mestruale");
  assert.ok(after.fertileWindow.start > TODAY);
  assert.ok(after.ovulation.start > TODAY);
  assert.ok(cycleProgress(after) < 0.1);
});
test("B: five-day duration projects remaining days without inventing observations", () => {
  const logs = record(history());
  const original = structuredClone(logs);
  const s = stats(logs);
  assert.equal(s.currentPeriodWindow.end, addDays(TODAY, 4));
  assert.equal(getCycleDayState(TODAY, s, logs).source, "recorded");
  for (let d = 1; d < 5; d++) {
    const date = addDays(TODAY, d);
    const day = getCycleDayState(date, s, logs);
    assert.equal(day.kind, "menstruation-estimated");
    assert.equal(day.source, "estimated");
    assert.ok(!s.periodDays.includes(date));
    assert.equal(logs[date], undefined);
  }
  assert.deepEqual(logs, original);
});
test("C: first current flow day never enters completed duration or corrupts insights", () => {
  const before = stats(history());
  const logs = record(history());
  const after = stats(logs);
  assert.equal(before.averagePeriodLength, 5);
  assert.equal(after.averagePeriodLength, 5);
  assert.equal(after.periodLengthIsEstimate, false);
  assert.equal(after.periods.at(-1).status, "ongoing");
  assert.equal(buildInsights(after, logs).averagePeriod.value, "5 giorni");
  assert.equal(after.cycleLengths.at(-1), 18);
});
test("D: spotting alone cannot start a cycle or turn into menstruation", () => {
  const logs = { ...history(), [TODAY]: makeLog(TODAY, { spotting: true }) };
  const s = stats(logs);
  assert.equal(s.currentCycleStart, addDays(TODAY, -18));
  assert.notEqual(s.currentState.kind, "menstruation-recorded");
});
for (const [name, offset] of [
  ["E early", 18],
  ["F late", 45],
  ["F long excluded interval", 70],
])
  test(`${name}: real start anchors every future estimate`, () => {
    const logs = record(history(offset));
    const s = stats(logs);
    assert.equal(s.currentState.cycleDay, 1);
    assert.equal(s.currentCycleStart, TODAY);
    assert.equal(s.prediction.expected, addDays(TODAY, s.averageCycleLength));
    assert.ok(s.ovulation.start >= addDays(TODAY, 5));
    assert.ok(s.fertileWindow.start >= addDays(TODAY, 5));
    assert.ok(s.fertileWindow.end < s.prediction.start);
    if (offset === 70) {
      assert.equal(s.excludedIntervals, 1);
      assert.equal(s.confidence.level, "low");
    }
  });
test("G: the current state is exactly the calendar evaluator result", () => {
  const logs = record(history());
  const s = stats(logs);
  assert.deepEqual(s.currentState, getCycleDayState(TODAY, s, logs));
});
test("H: legacy v1 round trip retains recorded menstruation, day 1", () => {
  const data = sanitizeData({
    version: 1,
    logs: record(history(), TODAY, {
      sexualActivity: "recorded",
      notes: "Synthetic regression note",
    }),
  });
  const loaded = sanitizeData(JSON.parse(JSON.stringify(data)));
  const s = stats(loaded.logs);
  assert.equal(s.currentState.label, "Mestruazioni");
  assert.equal(s.currentState.cycleDay, 1);
  assert.equal(loaded.logs[TODAY].sexualActivity, "recorded");
  assert.equal(loaded.logs[TODAY].notes, "Synthetic regression note");
  assert.equal(loaded.version, 1);
});
test("real flow always wins even past average duration, including imported intensity-unknown flow", () => {
  for (const flow of ["recorded", "light", "medium", "heavy"]) {
    let logs = record(history());
    for (let d = 1; d < 9; d++)
      logs = record(logs, addDays(TODAY, d), { periodFlow: flow });
    const today = addDays(TODAY, 8);
    const s = stats(logs, today);
    assert.equal(s.currentState.kind, "menstruation-recorded");
    assert.equal(s.phase, "mestruale");
    assert.equal(s.currentState.cycleDay, 9);
    assert.equal(s.averagePeriodLength, 5);
    assert.ok(!s.fertileWindow || s.fertileWindow.start > today);
  }
});
test("explicit no-flow closes projections and permits a coherent following phase", () => {
  const logs = {
    ...record(history()),
    [addDays(TODAY, 1)]: makeLog(addDays(TODAY, 1), { flowRecorded: true }),
  };
  const s = stats(logs, addDays(TODAY, 1));
  assert.notEqual(s.currentState.kind, "menstruation-estimated");
  assert.equal(s.phase, "follicolare");
  assert.notEqual(
    getCycleDayState(addDays(TODAY, 2), s, logs).kind,
    "menstruation-estimated",
  );
});
test("a future imported no-flow answer cannot prematurely complete the current episode", () => {
  const logs = {
    ...record(history()),
    [addDays(TODAY, 1)]: makeLog(addDays(TODAY, 1), { flowRecorded: true }),
  };
  assert.equal(stats(logs).periods.at(-1).status, "ongoing");
  assert.equal(stats(logs).averagePeriodLength, 5);
});
test("two menstrual episodes separated by explicit no-flow are not joined", () => {
  const logs = logsFrom([
    makeLog(addDays(TODAY, -2), { periodFlow: "medium" }),
    makeLog(addDays(TODAY, -1), { flowRecorded: true }),
    makeLog(TODAY, { periodFlow: "medium" }),
  ]);
  const s = stats(logs);
  assert.equal(s.currentCycleStart, TODAY);
  assert.equal(s.currentState.cycleDay, 1);
});
test("early new start with an excluded interval keeps prior usable history, never the old origin", () => {
  const logs = record(history(10));
  const s = stats(logs);
  assert.equal(s.currentState.cycleDay, 1);
  assert.equal(s.excludedIntervals, 1);
  assert.equal(s.prediction.expected, addDays(TODAY, 28));
  assert.ok(s.fertileWindow.start > TODAY);
});
