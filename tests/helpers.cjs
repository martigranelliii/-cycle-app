const { computeCycle } = require("../.test-build/lib/cycle.js");
const {
  addDays,
  diffDays,
} = require("../.test-build/lib/dates.js");

const ISO = "2026-01-01T00:00:00.000Z";

function makeLog(date, patch = {}) {
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

function logsFrom(entries) {
  return Object.fromEntries(entries.map((log) => [log.date, log]));
}

module.exports = { computeCycle, addDays, diffDays, makeLog, logsFrom };
