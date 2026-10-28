// Synthetic fixtures: four 28-day cycles beginning in 2000.
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeCycle, makeLog, addDays } = require("./helpers.cjs");
const { buildInsights } = require("../.test-build/lib/insights.js");
function fixture(make) {
  const logs = {};
  for (let cycle = 0; cycle < 5; cycle++) {
    const start = addDays("2000-01-01", 28 * cycle);
    logs[start] = makeLog(start, { periodFlow: "light" });
    if (cycle < 4)
      for (let day = 1; day < 28; day++) {
        const date = addDays(start, day);
        const patch = make(cycle, day);
        if (patch) logs[date] = makeLog(date, patch);
      }
  }
  return logs;
}
function insights(logs) {
  return buildInsights(computeCycle({ today: "2000-05-01", logs }), logs);
}
test("insufficient relevant observations despite many flow-only logs", () => {
  assert.equal(insights(fixture(() => ({}))).status, "insufficient");
});
test("explicit no symptoms distributed across cycles gives no pattern", () => {
  assert.equal(
    insights(fixture(() => ({ symptomsRecorded: true }))).status,
    "none",
  );
});
test("recurrence requires multiple independently observed cycles and supplies dates", () => {
  const r = insights(
    fixture((c, d) => ({
      symptomsRecorded: true,
      symptoms: d === 2 ? ["crampi"] : [],
    })),
  );
  assert.equal(r.status, "observation");
  assert.match(r.patterns[0].text, /4 degli ultimi 4/);
  assert.equal(r.patterns[0].dates.length, 4);
  assert.match(r.patterns[0].evidence, /4 cicli/);
});
test("dense symptom burst in only one cycle never becomes a recurring pattern", () => {
  const r = insights(
    fixture((c) => ({
      symptomsRecorded: true,
      symptoms: c === 0 ? ["crampi"] : [],
    })),
  );
  assert.equal(r.status, "none");
});
test("flow-only days cannot dilute symptom comparison denominators", () => {
  const logs = fixture((c, d) =>
    d >= 23 ? { symptoms: ["crampi"] } : { periodFlow: "none" },
  );
  const r = insights(logs);
  assert.ok(!r.patterns.some((p) => /più spesso/.test(p.text)));
});
test("energy compares premenstrual days with disjoint other days", () => {
  const r = insights(fixture((c, d) => ({ energy: d >= 23 ? 1 : 4 })));
  const p = r.patterns.find((p) => p.text.includes("energia"));
  assert.ok(p);
  assert.match(p.evidence, /Media 1.0/);
  assert.match(p.evidence, /rispetto a 4.0/);
  assert.equal(p.dates.length, 20);
});
test("energy concentration in one cycle cannot establish a pattern", () => {
  const r = insights(
    fixture((c, d) => ({ energy: c === 0 && d >= 23 ? 1 : 4 })),
  );
  assert.ok(!r.patterns.some((p) => p.text.includes("energia")));
});
test("constant energy yields enough data but no pattern", () => {
  assert.equal(insights(fixture(() => ({ energy: 3 }))).status, "none");
});
test("missing symptom answers never become explicit negatives", () => {
  const r = insights(
    fixture((c, d) => (d === 2 ? { symptoms: ["crampi"] } : { energy: 3 })),
  );
  assert.ok(!r.patterns.some((p) => p.text.includes("crampi")));
});
