const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeCycle,
  addDays,
  diffDays,
  makeLog,
  logsFrom,
} = require("./helpers.cjs");
const { describeOvulation } = require("../.test-build/lib/cycle.js");

test("ovulation is estimated from the expected period, not a fixed day 14", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-30", { periodFlow: "medium" }), // 29 days
    makeLog("2026-02-27", { periodFlow: "medium" }), // 28 days
  ]);
  const stats = computeCycle({ logs, today: "2026-03-05" });

  assert.equal(stats.averageCycleLength, 29);
  assert.ok(stats.ovulation);
  assert.equal(stats.ovulation.expected, addDays(stats.nextPeriodStart, -14));
  assert.equal(stats.ovulation.cycleDay, 16, "expected ovulation lands on day 16");
  assert.notEqual(stats.ovulation.cycleDay, 14, "never hardcoded to day 14");
  assert.equal(stats.ovulation.basis, "recent");
});

test("ovulation range and fertile window follow the prediction window", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-30", { periodFlow: "medium" }),
    makeLog("2026-02-27", { periodFlow: "medium" }),
  ]);
  const stats = computeCycle({ logs, today: "2026-03-05" });
  const prediction = stats.prediction;
  assert.ok(prediction);

  assert.equal(stats.ovulationWindows.length, 3);
  assert.equal(stats.fertileWindows.length, 3);
  assert.equal(stats.ovulation.start, addDays(prediction.start, -16));
  assert.equal(stats.ovulation.end, addDays(prediction.end, -12));
  assert.equal(stats.fertileWindow.start, addDays(prediction.start, -21));
  assert.equal(stats.fertileWindow.end, addDays(prediction.end, -11));
  assert.ok(diffDays(stats.fertileWindow.end, stats.fertileWindow.start) >= 5);
});

test("insufficient history: initial estimate and low confidence", () => {
  const stats = computeCycle({
    logs: {},
    lastPeriodStart: "2026-03-01",
    today: "2026-03-05",
  });

  assert.ok(stats.prediction);
  assert.equal(stats.prediction.basis, "initial");
  assert.equal(stats.confidence.level, "low");
  assert.ok(stats.ovulation);
  assert.equal(stats.ovulation.basis, "initial");
  assert.equal(stats.ovulation.confidence.level, "low");
});

test("irregular history widens the range without fake precision", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-21", { periodFlow: "medium" }), // 20
    makeLog("2026-03-07", { periodFlow: "medium" }), // 45
  ]);
  const stats = computeCycle({ logs, today: "2026-03-10" });

  assert.equal(stats.cycleLengthVariability, 12.5);
  assert.equal(stats.confidence.level, "low");
  assert.ok(stats.prediction);
  assert.equal(diffDays(stats.prediction.end, stats.prediction.start), 12);
  assert.equal(stats.prediction.end, addDays(stats.prediction.expected, 6));
});

test("confidence rises with several similar cycles", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-29", { periodFlow: "medium" }),
    makeLog("2026-02-26", { periodFlow: "medium" }),
    makeLog("2026-03-26", { periodFlow: "medium" }),
    makeLog("2026-04-23", { periodFlow: "medium" }),
    makeLog("2026-05-21", { periodFlow: "medium" }),
  ]);
  const stats = computeCycle({ logs, today: "2026-05-25" });

  assert.equal(stats.cycleLengthsUsed, 5);
  assert.equal(stats.confidence.level, "high");
  assert.match(stats.confidence.note, /cicli recenti/);
});

test("spotting is not a period start and is not counted as menstruation", () => {
  const logs = logsFrom([
    makeLog("2026-02-01", { periodFlow: "medium" }),
    makeLog("2026-03-01", { spotting: true }),
    makeLog("2026-03-05", { periodFlow: "medium" }),
  ]);
  const stats = computeCycle({ logs, today: "2026-03-06" });

  assert.deepEqual(stats.cycleStarts, ["2026-02-01", "2026-03-05"]);
  assert.ok(!stats.periodDays.includes("2026-03-01"));
  assert.equal(stats.currentCycleStart, "2026-03-05");
});

test("a positive LH test is exposed as an observed signal, not a new estimate", () => {
  const baseline = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-30", { periodFlow: "medium" }),
    makeLog("2026-02-27", { periodFlow: "medium" }),
  ]);
  const before = computeCycle({ logs: baseline, today: "2026-03-10" });

  const withTest = {
    ...baseline,
    "2026-03-02": makeLog("2026-03-02", { ovulationTest: "positive" }),
  };
  const after = computeCycle({ logs: withTest, today: "2026-03-10" });

  assert.equal(after.latestPositiveLhTest, "2026-03-02");
  assert.deepEqual(after.ovulation, before.ovulation, "estimate is unchanged");

  const older = computeCycle({
    logs: {
      ...baseline,
      "2026-01-10": makeLog("2026-01-10", { ovulationTest: "positive" }),
    },
    today: "2026-03-10",
  });
  assert.equal(older.latestPositiveLhTest, null, "old test outside current cycle");
});

test("ovulation copy always sounds like an estimate", () => {
  const stats = computeCycle({
    logs: logsFrom([
      makeLog("2026-01-01", { periodFlow: "medium" }),
      makeLog("2026-01-30", { periodFlow: "medium" }),
      makeLog("2026-02-27", { periodFlow: "medium" }),
    ]),
    today: "2026-03-05",
  });
  assert.ok(stats.ovulation);

  const tomorrow = describeOvulation(
    stats.ovulation,
    addDays(stats.ovulation.expected, -1)
  );
  assert.match(tomorrow, /domani/i);
  assert.doesNotMatch(tomorrow, /conferm|sicur|cert/i);

  const passed = describeOvulation(
    stats.ovulation,
    addDays(stats.ovulation.expected, 9)
  );
  assert.match(passed, /stima/i);
});
