// All dates and observations in this suite are synthetic.
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeCycle, makeLog, logsFrom } = require("./helpers.cjs");
const storage = require("../.test-build/lib/storage.js");
const {
  buildBackup,
  parseBackup,
  mergeBackup,
} = require("../.test-build/lib/backup.js");
const { buildInsights } = require("../.test-build/lib/insights.js");
function browser(initial = null) {
  let raw = initial;
  global.window = {
    localStorage: {
      getItem: () => raw,
      setItem: (k, v) => {
        raw = v;
      },
      removeItem: () => {
        raw = null;
      },
    },
  };
  return () => raw;
}
test("legacy v1 preserves observations and leaves negative answers unknown", () => {
  const d = storage.sanitizeData({
    version: 1,
    logs: {
      "2000-01-01": makeLog("2000-01-01", { sexualActivity: "recorded" }),
    },
  });
  assert.equal(d.logs["2000-01-01"].sexualActivity, "recorded");
  assert.equal(d.logs["2000-01-01"].flowRecorded, undefined);
  assert.equal(d.logs["2000-01-01"].symptomsRecorded, undefined);
});
test("successful persistence is verified", () => {
  const raw = browser();
  assert.equal(storage.saveData(storage.emptyData()).ok, true);
  assert.ok(raw());
});
test("failed persistence never reports success", () => {
  browser();
  window.localStorage.setItem = () => {
    throw Error("blocked");
  };
  assert.equal(storage.saveData(storage.emptyData()).ok, false);
});
test("corrupt storage remains untouched and is recoverable", () => {
  const raw = browser("{broken");
  const r = storage.readStorage();
  assert.equal(r.status, "corrupt");
  assert.equal(r.raw, "{broken");
  assert.equal(raw(), "{broken");
});
test("unsupported storage version is not silently downgraded", () => {
  browser(JSON.stringify({ version: 99, logs: {} }));
  assert.equal(storage.readStorage().status, "corrupt");
});
test("explicit negative observations round trip", () => {
  const d = storage.sanitizeData({
    logs: {
      "2000-01-01": makeLog("2000-01-01", {
        flowRecorded: true,
        symptomsRecorded: true,
      }),
    },
  });
  const r = parseBackup(JSON.stringify(buildBackup(d)));
  assert.ok(r.ok);
  assert.equal(r.data.logs["2000-01-01"].symptomsRecorded, true);
});
test("import reports conflicts and preserves both versions", () => {
  const a = storage.emptyData(),
    b = storage.emptyData();
  a.logs["2000-01-01"] = makeLog("2000-01-01", { notes: "synthetic A" });
  b.logs["2000-01-01"] = makeLog("2000-01-01", {
    notes: "synthetic B",
    energy: 4,
  });
  const r = mergeBackup(a, b);
  assert.equal(r.data.logs["2000-01-01"].notes, "synthetic A");
  assert.equal(r.report.conflicts, 1);
  assert.equal(r.data.backupConflicts["2000-01-01"][0].notes, "synthetic B");
});
test("current first flow day is not a completed period", () => {
  const s = computeCycle({
    today: "2000-01-01",
    logs: logsFrom([makeLog("2000-01-01", { periodFlow: "medium" })]),
  });
  assert.equal(s.periods[0].status, "ongoing");
  assert.equal(s.periodLengthIsEstimate, true);
  assert.equal(s.averagePeriodLength, 5);
});
test("explicit no-flow closes a contiguous period", () => {
  const s = computeCycle({
    today: "2000-01-04",
    logs: logsFrom([
      makeLog("2000-01-01", { periodFlow: "light" }),
      makeLog("2000-01-02", { periodFlow: "medium" }),
      makeLog("2000-01-03", { flowRecorded: true }),
    ]),
  });
  assert.equal(s.periods[0].status, "complete");
  assert.equal(s.averagePeriodLength, 2);
});
test("historical unclosed and missing days remain incomplete", () => {
  const s = computeCycle({
    today: "2000-02-01",
    logs: logsFrom([
      makeLog("2000-01-01", { periodFlow: "light" }),
      makeLog("2000-01-03", { periodFlow: "light" }),
      makeLog("2000-01-04", { flowRecorded: true }),
    ]),
  });
  assert.equal(s.periods[0].status, "incomplete");
  assert.equal(s.periodLengthIsEstimate, true);
});
test("spotting never starts a period", () => {
  assert.equal(
    computeCycle({
      today: "2000-01-01",
      logs: logsFrom([makeLog("2000-01-01", { spotting: true })]),
    }).hasPeriodData,
    false,
  );
});
test("long absence suspends arithmetic day and estimates", () => {
  const s = computeCycle({
    today: "2000-12-01",
    lastPeriodStart: "2000-01-01",
    logs: {},
  });
  assert.equal(s.currentCycleDay, null);
  assert.equal(s.prediction, null);
  assert.equal(s.phase, null);
});
test("zero or little history has no calendar prediction", () => {
  for (const lastPeriodStart of [null, "2000-01-01"])
    assert.equal(
      computeCycle({ today: "2000-01-02", lastPeriodStart, logs: {} })
        .prediction,
      null,
    );
});
test("excluded long intervals are disclosed", () => {
  const s = computeCycle({
    today: "2000-05-02",
    logs: logsFrom(
      ["2000-01-01", "2000-05-01"].map((date) =>
        makeLog(date, { periodFlow: "light" }),
      ),
    ),
  });
  assert.equal(s.excludedIntervals, 1);
  assert.equal(s.prediction, null);
});
test("regular history predicts only one uncertain upcoming start", () => {
  const s = computeCycle({
    today: "2000-03-01",
    logs: logsFrom(
      ["2000-01-01", "2000-01-29", "2000-02-26"].map((date) =>
        makeLog(date, { periodFlow: "light" }),
      ),
    ),
  });
  assert.ok(s.prediction);
  assert.equal(s.predicted.length, 0);
  assert.equal(s.ovulation.confidence.level, "low");
});
test("variable history is not capped to a narrow six-day margin", () => {
  const s = computeCycle({
    today: "2000-04-01",
    logs: logsFrom(
      ["2000-01-01", "2000-01-21", "2000-03-11"].map((date) =>
        makeLog(date, { periodFlow: "light" }),
      ),
    ),
  });
  assert.equal(s.prediction, null);
});
test("insights distinguish insufficient data", () => {
  assert.equal(
    buildInsights(computeCycle({ today: "2000-01-01", logs: {} }), {}).status,
    "insufficient",
  );
});
test("stale tab compare-before-write refuses to overwrite newer data", () => {
  browser("newer");
  const r = storage.saveData(storage.emptyData(), "older");
  assert.deepEqual(r, { ok: false, reason: "conflict" });
  assert.equal(window.localStorage.getItem("cycle.v1"), "newer");
});
test("unverified no-op write does not claim success", () => {
  browser();
  window.localStorage.setItem = () => {};
  assert.equal(storage.saveData(storage.emptyData()).ok, false);
});
test("fresh restore adopts profile even after onboarding", () => {
  const a = storage.emptyData(),
    b = storage.emptyData();
  a.onboarding.completed = true;
  b.onboarding.completed = true;
  b.settings.averageCycleLength = 33;
  assert.equal(mergeBackup(a, b).data.settings.averageCycleLength, 33);
});
test("alternative backup versions survive another export/import", () => {
  const a = storage.emptyData(),
    b = storage.emptyData();
  a.logs["2000-01-01"] = makeLog("2000-01-01", { notes: "synthetic A" });
  b.logs["2000-01-01"] = makeLog("2000-01-01", { notes: "synthetic B" });
  const r = parseBackup(JSON.stringify(buildBackup(mergeBackup(a, b).data)));
  assert.ok(r.ok);
  assert.equal(r.data.backupConflicts["2000-01-01"][0].notes, "synthetic B");
});
test("explicitly preferring backup retains overwritten local version", () => {
  const a = storage.emptyData(),
    b = storage.emptyData();
  a.logs["2000-01-01"] = makeLog("2000-01-01", { notes: "synthetic A" });
  b.logs["2000-01-01"] = makeLog("2000-01-01", { notes: "synthetic B" });
  const r = mergeBackup(a, b, true);
  assert.equal(r.data.logs["2000-01-01"].notes, "synthetic B");
  assert.equal(r.data.backupConflicts["2000-01-01"][0].notes, "synthetic A");
});
test("partially corrupt observations cannot be silently sanitized on read", () => {
  browser(
    JSON.stringify({
      version: 1,
      logs: { "2000-01-01": makeLog("2000-01-01", { energy: 9 }) },
    }),
  );
  assert.equal(storage.readStorage().status, "corrupt");
});
test("backup rejects invalid supported observations instead of replacing them", () => {
  assert.equal(
    parseBackup(
      JSON.stringify({
        version: 1,
        logs: {
          "2000-01-01": makeLog("2000-01-01", { periodFlow: "invalid" }),
        },
      }),
    ).ok,
    false,
  );
});
