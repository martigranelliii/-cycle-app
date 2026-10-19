const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getDailyWellnessSuggestions,
} = require("../.test-build/lib/wellness.js");

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

function baseInput(patch = {}) {
  return {
    phase: "follicolare",
    cycleDay: 9,
    averageCycleLength: 28,
    energy: null,
    symptoms: [],
    moods: [],
    periodFlow: "none",
    spotting: false,
    recentLogs: [],
    hasLogToday: true,
    ...patch,
  };
}

const FORBIDDEN =
  /ormon|fertilit|contraccez|integra(tor|zione)|prescri|regola(re)? il ciclo|bilancia|diagnos|sicur/i;

test("case A: high energy and no symptoms allows a more active idea", () => {
  const result = getDailyWellnessSuggestions(
    baseInput({ energy: 5, hasLogToday: true })
  );
  assert.match(result.move.text, /camminata|bici|forza/i);
  assert.doesNotMatch(result.move.text, /riposo/i);
});

test("case B: very low energy with cramps and headache stays gentle", () => {
  const result = getDailyWellnessSuggestions(
    baseInput({
      energy: 1,
      symptoms: ["crampi", "mal-di-testa"],
      hasLogToday: true,
    })
  );
  assert.match(result.move.text, /passeggiata/i);
  assert.match(result.move.text, /stretching/i);
  assert.doesNotMatch(
    result.move.text,
    /forza|corsa|bici|svelta|intensa|allenamento/i
  );
});

test("case C: no log today falls back to a gentle phase/default idea", () => {
  for (const phase of ["mestruale", "follicolare", "ovulatoria", "luteale"]) {
    const result = getDailyWellnessSuggestions(
      baseInput({ phase, hasLogToday: false })
    );
    assert.doesNotMatch(
      result.move.text,
      /forza|corsa|bici|svelta|intensa|allenamento/i
    );
  }
  const result = getDailyWellnessSuggestions(
    baseInput({ phase: null, hasLogToday: false })
  );
  assert.equal(result.basis, "default");
});

test("case D: menstruation with fatigue gets supportive low-intensity ideas", () => {
  const result = getDailyWellnessSuggestions(
    baseInput({
      periodFlow: "medium",
      energy: 2,
      symptoms: ["stanchezza"],
      hasLogToday: true,
    })
  );
  assert.match(result.move.text, /passeggiata|stretching/i);
  assert.match(result.care.text, /pausa|riposo|rallenta|riduci/i);
  assert.match(result.eat.text, /ferro|legumi|verdure/i);
});

test("history takes over when there is no today log, before the phase guess", () => {
  const result = getDailyWellnessSuggestions(
    baseInput({
      hasLogToday: false,
      recentLogs: [
        log("2026-01-01", { energy: 1 }),
        log("2026-01-02", { energy: 2 }),
        log("2026-01-03", { energy: 1 }),
      ],
    })
  );
  assert.equal(result.basis, "history");
});

test("output is deterministic and never makes medical or certainty claims", () => {
  const input = baseInput({
    energy: 2,
    symptoms: ["voglie", "gonfiore"],
    moods: ["stressata"],
  });
  const first = getDailyWellnessSuggestions(input);
  const second = getDailyWellnessSuggestions(input);
  assert.deepEqual(first, second);

  const text = `${first.eat.text} ${first.move.text} ${first.care.text}`;
  assert.doesNotMatch(text, FORBIDDEN);
});
