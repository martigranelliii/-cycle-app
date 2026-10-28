// Synthetic fixtures only; no personal history.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeCycle,
  addDays,
  diffDays,
  makeLog,
  logsFrom,
} = require("./helpers.cjs");
const {
  describeOvulation,
  getEstimatedFertileWindow,
} = require("../.test-build/lib/cycle.js");
const { range } = require("../.test-build/lib/dates.js");

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
  assert.equal(
    stats.ovulation.cycleDay,
    16,
    "expected ovulation lands on day 16",
  );
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

  assert.equal(stats.ovulationWindows.length, 1);
  assert.equal(stats.fertileWindows.length, 1);
  assert.equal(stats.ovulation.start, addDays(prediction.start, -16));
  assert.equal(stats.ovulation.end, addDays(prediction.end, -12));
  // The displayed fertile window is -5/+2 around the central ovulation day.
  assert.equal(stats.fertileWindow.start, addDays(stats.ovulation.start, -5));
  assert.equal(stats.fertileWindow.end, addDays(stats.ovulation.end, 2));
  assert.ok(diffDays(stats.fertileWindow.end, stats.fertileWindow.start) > 7);
});

test("fertile calendar interval carries ovulation uncertainty on both sides", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-30", { periodFlow: "medium" }),
    makeLog("2026-02-27", { periodFlow: "medium" }),
  ]);
  const stats = computeCycle({ logs, today: "2026-03-05" });

  assert.equal(stats.fertileWindows.length, 1);
  assert.equal(stats.ovulationWindows.length, 1);

  for (let index = 0; index < stats.fertileWindows.length; index += 1) {
    const ovulationDay = stats.ovulationWindows[index].expected;
    const canonical = {
      start: addDays(stats.ovulationWindows[index].start, -5),
      end: addDays(stats.ovulationWindows[index].end, 2),
    };
    assert.equal(stats.fertileWindows[index].start, canonical.start);
    assert.equal(stats.fertileWindows[index].end, canonical.end);
    assert.equal(
      stats.fertileWindows[index].estimatedOvulationDay,
      ovulationDay,
      "the window records the central estimated ovulation day",
    );
  }
});

test("CASE A: fertile window is 5 days before and 2 days after estimated ovulation", () => {
  const window = getEstimatedFertileWindow("2026-10-14");
  assert.equal(window.start, "2026-10-09");
  assert.equal(window.end, "2026-10-16");
  assert.equal(window.estimatedOvulationDay, "2026-10-14");
});

test("CASE B: fertile window handles a month boundary", () => {
  const window = getEstimatedFertileWindow("2026-11-03");
  assert.equal(window.start, "2026-10-29");
  assert.equal(window.end, "2026-11-05");
});

test("CASE C: fertile window handles a year boundary", () => {
  const window = getEstimatedFertileWindow("2027-01-02");
  assert.equal(window.start, "2026-12-28");
  assert.equal(window.end, "2027-01-04");
});

test("fertile window always contains exactly 8 days around the ovulation day", () => {
  const ovulationDays = [
    "2026-10-14",
    "2026-11-03",
    "2027-01-02",
    "2026-02-26",
    "2026-12-31",
    "2026-03-01",
  ];

  for (const ovulationDay of ovulationDays) {
    const window = getEstimatedFertileWindow(ovulationDay);
    const days = range(window.start, window.end);
    assert.equal(days.length, 8, `${ovulationDay}: eight calendar days`);
    assert.equal(days[0], window.start);
    assert.equal(days[days.length - 1], window.end);

    const centralIndex = days.indexOf(ovulationDay);
    assert.equal(
      centralIndex,
      5,
      `${ovulationDay}: five days precede ovulation`,
    );
    assert.equal(
      days.length - 1 - centralIndex,
      2,
      `${ovulationDay}: two days follow ovulation`,
    );
    assert.ok(
      diffDays(ovulationDay, window.start) === 5,
      "start is exactly -5 calendar days",
    );
    assert.ok(
      diffDays(window.end, ovulationDay) === 2,
      "end is exactly +2 calendar days",
    );
  }
});

test("ovulation tracks the recorded cycle length, never a fixed day 14", () => {
  const logs = logsFrom([
    makeLog("2026-01-01", { periodFlow: "medium" }),
    makeLog("2026-01-31", { periodFlow: "medium" }), // 30 days
    makeLog("2026-03-02", { periodFlow: "medium" }), // 30 days
  ]);
  const stats = computeCycle({ logs, today: "2026-03-05" });

  assert.equal(stats.averageCycleLength, 30);
  assert.ok(stats.ovulation);
  assert.equal(stats.ovulation.expected, addDays(stats.nextPeriodStart, -14));
  assert.equal(stats.ovulation.cycleDay, 17);
  assert.notEqual(stats.ovulation.cycleDay, 14, "never hardcoded to day 14");
  assert.equal(
    stats.fertileWindow.estimatedOvulationDay,
    stats.ovulation.expected,
  );
});

test("insufficient history: initial estimate and low confidence", () => {
  const stats = computeCycle({
    logs: {},
    lastPeriodStart: "2026-03-01",
    today: "2026-03-05",
  });

  assert.equal(stats.prediction, null);
  assert.equal(stats.confidence.level, "low");
  assert.equal(stats.ovulation, null);
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
  assert.equal(stats.prediction, null);
  assert.match(stats.estimateNote, /variabili/);
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
  assert.equal(
    older.latestPositiveLhTest,
    null,
    "old test outside current cycle",
  );
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
    addDays(stats.ovulation.expected, -1),
  );
  assert.match(tomorrow, /domani/i);
  assert.doesNotMatch(tomorrow, /conferm|sicur|cert/i);

  const passed = describeOvulation(
    stats.ovulation,
    addDays(stats.ovulation.expected, 9),
  );
  assert.match(passed, /stima/i);
});
