import type { CycleData, DailyLog } from "@/types";
import { isValidKey } from "./dates";

/**
 * One-time migration of real recorded history from a previous tracker.
 *
 * Only days the person actually recorded are imported:
 * - menstrual days, with no intensity attached
 * - days with recorded sexual activity
 *
 * No predictions, no moods, no symptoms, no energy, no notes, and no
 * protected/unprotected detail (we simply do not know it).
 */

export const IMPORT_ID = "floManualHistoryV1";

/** Real recorded menstrual days — 7 periods, 33 days in total. */
export const PERIOD_HISTORY: string[] = [
  // 2026-04-23 → 2026-04-28
  "2026-04-23",
  "2026-04-24",
  "2026-04-25",
  "2026-04-26",
  "2026-04-27",
  "2026-04-28",
  // 2026-05-19 → 2026-05-22
  "2026-05-19",
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  // 2026-06-07 → 2026-06-11
  "2026-06-07",
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
  "2026-06-11",
  // 2026-06-29 → 2026-07-01
  "2026-06-29",
  "2026-06-30",
  "2026-07-01",
  // 2026-08-03 → 2026-08-07
  "2026-08-03",
  "2026-08-04",
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  // 2026-08-31 → 2026-09-03
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  // 2026-09-27 → 2026-10-02
  "2026-09-27",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  "2026-10-02",
];

/** Real recorded days with sexual activity (53 dates). */
export const SEXUAL_ACTIVITY_HISTORY: string[] = [
  "2026-05-31",
  // June
  "2026-06-02",
  "2026-06-03",
  "2026-06-06",
  "2026-06-09",
  "2026-06-14",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-06-24",
  "2026-06-26",
  "2026-06-27",
  // July
  "2026-07-04",
  "2026-07-05",
  "2026-07-06",
  "2026-07-09",
  "2026-07-10",
  "2026-07-12",
  "2026-07-15",
  "2026-07-17",
  // August
  "2026-08-01",
  "2026-08-02",
  "2026-08-04",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-23",
  "2026-08-26",
  "2026-08-28",
  "2026-08-29",
  "2026-08-30",
  // September
  "2026-09-03",
  "2026-09-10",
  "2026-09-12",
  "2026-09-13",
  "2026-09-17",
  "2026-09-19",
  "2026-09-20",
  "2026-09-22",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  // October
  "2026-10-01",
  "2026-10-02",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];

const EXPECTED_PERIOD_DAYS = 33;
const EXPECTED_SEXUAL_ACTIVITY_DAYS = 53;

export interface ImportReport {
  id: string;
  alreadyImported: boolean;
  /** Dates that did not exist before and were created. */
  created: number;
  /** Existing dates that received one or more missing fields. */
  merged: number;
  periodDays: number;
  sexualActivityDays: number;
}

export interface ImportResult {
  ok: boolean;
  /** A new object; the input is never mutated. */
  data: CycleData;
  report: ImportReport;
  error?: string;
}

export function hasImportedHistory(data: CycleData): boolean {
  return Boolean(data.imports?.[IMPORT_ID]);
}

export function importedAt(data: CycleData): string | null {
  return data.imports?.[IMPORT_ID] ?? null;
}

function assertDataset(): string | null {
  const all = [...PERIOD_HISTORY, ...SEXUAL_ACTIVITY_HISTORY];
  if (all.some((date) => !isValidKey(date))) return "invalid dates";
  if (new Set(PERIOD_HISTORY).size !== PERIOD_HISTORY.length) {
    return "duplicate period days";
  }
  if (new Set(SEXUAL_ACTIVITY_HISTORY).size !== SEXUAL_ACTIVITY_HISTORY.length) {
    return "duplicate sexual activity days";
  }
  if (PERIOD_HISTORY.length !== EXPECTED_PERIOD_DAYS) {
    return `unexpected period history size: ${PERIOD_HISTORY.length}`;
  }
  if (SEXUAL_ACTIVITY_HISTORY.length !== EXPECTED_SEXUAL_ACTIVITY_DAYS) {
    return `unexpected sexual activity history size: ${SEXUAL_ACTIVITY_HISTORY.length}`;
  }
  return null;
}

function blankLog(date: string, now: string): DailyLog {
  // Only the date itself is created: nothing else is invented.
  return {
    date,
    periodFlow: "none",
    moods: [],
    symptoms: [],
    energy: null,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies the historical dataset, filling only missing fields.
 *
 * Idempotent by construction: the marker short-circuits a second run, and even
 * without the marker the merge rules leave already-filled days untouched.
 */
export function applyHistoricalImport(data: CycleData, now = new Date().toISOString()): ImportResult {
  const baseReport: ImportReport = {
    id: IMPORT_ID,
    alreadyImported: false,
    created: 0,
    merged: 0,
    periodDays: PERIOD_HISTORY.length,
    sexualActivityDays: SEXUAL_ACTIVITY_HISTORY.length,
  };

  if (hasImportedHistory(data)) {
    return {
      ok: true,
      data,
      report: { ...baseReport, alreadyImported: true, created: 0, merged: 0 },
    };
  }

  const invalid = assertDataset();
  if (invalid) {
    return {
      ok: false,
      data,
      report: baseReport,
      error: invalid,
    };
  }

  const logs: Record<string, DailyLog> = { ...data.logs };
  const existingDates = new Set(Object.keys(data.logs));
  const counted = new Set<string>();

  /** Counts a day once, as created when it is new to the dataset. */
  const countChange = (date: string) => {
    if (existingDates.has(date)) {
      baseReport.merged += 1;
      return;
    }
    if (!counted.has(date)) {
      counted.add(date);
      baseReport.created += 1;
    }
  };

  /** Returns the day's log, creating a minimal one when the day is new. */
  const dayLog = (date: string): DailyLog => {
    const existing = logs[date];
    if (existing) return existing;
    const created = blankLog(date, now);
    logs[date] = created;
    return created;
  };

  for (const date of PERIOD_HISTORY) {
    const log = dayLog(date);
    if (log.periodFlow === "none") {
      logs[date] = { ...log, periodFlow: "recorded", updatedAt: now };
      countChange(date);
    }
  }

  for (const date of SEXUAL_ACTIVITY_HISTORY) {
    const log = dayLog(date);
    if (!log.sexualActivity) {
      logs[date] = { ...log, sexualActivity: "recorded", updatedAt: now };
      countChange(date);
    }
  }

  return {
    ok: true,
    data: {
      ...data,
      logs,
      imports: { ...(data.imports ?? {}), [IMPORT_ID]: now },
    },
    report: baseReport,
  };
}
