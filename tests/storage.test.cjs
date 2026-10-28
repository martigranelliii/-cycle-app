// All fixtures are synthetic and do not represent a person.
const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeData } = require("../.test-build/lib/storage.js");
const {
  buildBackup,
  parseBackup,
  mergeBackup,
} = require("../.test-build/lib/backup.js");
const ISO = "2026-01-01T00:00:00.000Z";

function log(date, patch = {}) {
  return {
    date,
    periodFlow: "none",
    moods: [],
    symptoms: [],
    energy: null,
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    ...patch,
  };
}

test("sanitizer keeps historical recorded values untouched", () => {
  const data = sanitizeData({
    version: 1,
    onboarding: {
      completed: true,
      lastPeriodStart: "2026-10-10",
      cycleLength: 28,
      periodLength: 5,
    },
    settings: { averageCycleLength: 26, averagePeriodLength: 5 },
    logs: {
      "2026-10-10": log("2026-10-10", {
        periodFlow: "recorded",
        sexualActivity: "recorded",
      }),
    },
    imports: { floManualHistoryV1: ISO },
  });

  assert.equal(data.logs["2026-10-10"].periodFlow, "recorded");
  assert.equal(data.logs["2026-10-10"].sexualActivity, "recorded");
  assert.equal(data.imports.floManualHistoryV1, ISO);
});

test("sanitizer keeps the new optional fields and drops unknown ids", () => {
  const data = sanitizeData({
    logs: {
      "2026-10-11": log("2026-10-11", {
        moods: ["serena", "bogus"],
        symptoms: ["fame", "libido", "crampi", "bogus"],
        energy: 3,
        sexualActivity: "protected",
        spotting: true,
        ovulationTest: "positive",
        cervicalMucus: "egg-white",
      }),
    },
  });

  const entry = data.logs["2026-10-11"];
  assert.deepEqual(entry.moods, ["serena"]);
  assert.deepEqual(entry.symptoms.sort(), ["crampi", "fame", "libido"]);
  assert.equal(entry.sexualActivity, "protected");
  assert.equal(entry.spotting, true);
  assert.equal(entry.ovulationTest, "positive");
  assert.equal(entry.cervicalMucus, "egg-white");
});

test("birthday-compatible: an old payload with no new fields loads", () => {
  const data = sanitizeData({
    logs: {
      "2026-01-02": {
        date: "2026-01-02",
        periodFlow: "light",
        moods: ["felice"],
        symptoms: ["gonfiore"],
        energy: 2,
        notes: "ok",
      },
    },
  });
  const entry = data.logs["2026-01-02"];
  assert.equal(entry.sexualActivity, undefined);
  assert.equal(entry.spotting, undefined);
  assert.equal(entry.ovulationTest, undefined);
  assert.equal(entry.cervicalMucus, undefined);
});

test("backup carries the new fields and never rewrites old recorded data", () => {
  const data = sanitizeData({
    onboarding: {
      completed: true,
      lastPeriodStart: "2026-10-10",
      cycleLength: 28,
      periodLength: 5,
    },
    logs: {
      "2026-10-10": log("2026-10-10", {
        periodFlow: "recorded",
        sexualActivity: "recorded",
      }),
      "2026-10-11": log("2026-10-11", {
        sexualActivity: "unprotected",
        spotting: true,
        ovulationTest: "negative",
        cervicalMucus: "creamy",
      }),
    },
  });

  const parsed = parseBackup(JSON.stringify(buildBackup(data)));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.logs["2026-10-10"].sexualActivity, "recorded");
  assert.equal(parsed.data.logs["2026-10-11"].sexualActivity, "unprotected");
  assert.equal(parsed.data.logs["2026-10-11"].spotting, true);
  assert.equal(parsed.data.logs["2026-10-11"].ovulationTest, "negative");
  assert.equal(parsed.data.logs["2026-10-11"].cervicalMucus, "creamy");

  const current = sanitizeData({
    onboarding: {
      completed: true,
      lastPeriodStart: null,
      cycleLength: null,
      periodLength: null,
    },
    logs: { "2026-10-11": log("2026-10-11", { notes: "qui" }) },
  });
  const { data: merged, report } = mergeBackup(current, parsed.data);
  assert.equal(merged.logs["2026-10-11"].notes, "qui", "existing day is kept");
  assert.equal(merged.logs["2026-10-11"].sexualActivity, undefined);
  assert.equal(merged.logs["2026-10-10"].sexualActivity, "recorded");
  assert.equal(report.added, 1);
  assert.equal(report.kept, 1);
});

test("parseBackup accepts a raw old payload and rejects malformed files", () => {
  const raw = parseBackup(
    JSON.stringify({ logs: { "2026-01-01": log("2026-01-01") } }),
  );
  assert.equal(raw.ok, true);

  const malformed = parseBackup("{ nope");
  assert.equal(malformed.ok, false);

  const wrong = parseBackup(JSON.stringify({ hello: "world" }));
  assert.equal(wrong.ok, false);
});
