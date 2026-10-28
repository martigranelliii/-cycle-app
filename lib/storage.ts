import type {
  CervicalMucus,
  CycleData,
  DailyLog,
  MoodId,
  Onboarding,
  OvulationTestResult,
  PeriodFlow,
  Settings,
  SexualActivity,
  SymptomId,
} from "@/types";
import { isValidKey } from "./dates";
import {
  CERVICAL_MUCUS_IDS,
  MOODS,
  PERIOD_FLOW_IDS,
  SEXUAL_ACTIVITY_IDS,
  SYMPTOMS,
} from "./labels";

export const STORAGE_KEY = "cycle.v1";

const DEFAULT_SETTINGS: Settings = {
  averageCycleLength: 28,
  averagePeriodLength: 5,
};

const MOOD_IDS = MOODS.map((mood) => mood.id);
const SYMPTOM_IDS = SYMPTOMS.map((symptom) => symptom.id);
const OVULATION_TEST_IDS: OvulationTestResult[] = ["negative", "positive"];

export function emptyData(): CycleData {
  return {
    version: 1,
    onboarding: {
      completed: false,
      lastPeriodStart: null,
      cycleLength: null,
      periodLength: null,
    },
    settings: { ...DEFAULT_SETTINGS },
    logs: {},
    imports: {},
  };
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function uniqueIds<T extends string>(value: unknown, allowed: T[]): T[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<T>();
  for (const item of value) {
    if (typeof item === "string" && allowed.includes(item as T)) {
      set.add(item as T);
    }
  }
  return [...set];
}

function sanitizeLog(value: unknown, date: string): DailyLog | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const flow = PERIOD_FLOW_IDS.includes(raw.periodFlow as PeriodFlow)
    ? (raw.periodFlow as PeriodFlow)
    : "none";

  const energy =
    typeof raw.energy === "number" && raw.energy >= 1 && raw.energy <= 5
      ? Math.round(raw.energy)
      : null;

  const sexualActivity = SEXUAL_ACTIVITY_IDS.includes(
    raw.sexualActivity as SexualActivity,
  )
    ? (raw.sexualActivity as SexualActivity)
    : undefined;

  const ovulationTest = OVULATION_TEST_IDS.includes(
    raw.ovulationTest as OvulationTestResult,
  )
    ? (raw.ovulationTest as OvulationTestResult)
    : undefined;

  const cervicalMucus = CERVICAL_MUCUS_IDS.includes(
    raw.cervicalMucus as CervicalMucus,
  )
    ? (raw.cervicalMucus as CervicalMucus)
    : undefined;

  return {
    date,
    periodFlow: flow,
    ...(raw.flowRecorded === true ? { flowRecorded: true } : {}),
    ...(raw.symptomsRecorded === true ? { symptomsRecorded: true } : {}),
    moods: uniqueIds<MoodId>(raw.moods, MOOD_IDS),
    symptoms: uniqueIds<SymptomId>(raw.symptoms, SYMPTOM_IDS),
    energy,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 600) : "",
    ...(sexualActivity ? { sexualActivity } : {}),
    ...(raw.spotting === true ? { spotting: true } : {}),
    ...(ovulationTest ? { ovulationTest } : {}),
    ...(cervicalMucus ? { cervicalMucus } : {}),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

/** Import markers are kept as an open map so new imports can be added later. */
function sanitizeImports(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const imports: Record<string, string> = {};
  for (const [id, at] of Object.entries(value as Record<string, unknown>)) {
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(id) && typeof at === "string") {
      imports[id] = at;
    }
  }
  return imports;
}

function sanitizeOnboarding(value: unknown): Onboarding {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    completed: raw.completed === true,
    lastPeriodStart: isValidKey(raw.lastPeriodStart)
      ? raw.lastPeriodStart
      : null,
    cycleLength:
      typeof raw.cycleLength === "number"
        ? asNumber(raw.cycleLength, 28, 15, 90)
        : null,
    periodLength:
      typeof raw.periodLength === "number"
        ? asNumber(raw.periodLength, 5, 1, 15)
        : null,
  };
}

/**
 * Normalises any stored or imported payload into a valid `CycleData`.
 * Unknown fields are dropped; unknown ids inside a log are ignored.
 * Exported so a backup can reuse exactly the same rules as localStorage.
 */
export function sanitizeData(value: unknown): CycleData {
  const data = emptyData();
  if (!value || typeof value !== "object") return data;
  const raw = value as Record<string, unknown>;

  data.onboarding = sanitizeOnboarding(raw.onboarding);

  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  data.settings = {
    averageCycleLength: asNumber(settings.averageCycleLength, 28, 15, 90),
    averagePeriodLength: asNumber(settings.averagePeriodLength, 5, 1, 15),
  };

  data.imports = sanitizeImports(raw.imports);

  if (raw.logs && typeof raw.logs === "object") {
    for (const [date, log] of Object.entries(
      raw.logs as Record<string, unknown>,
    )) {
      if (!isValidKey(date)) continue;
      const clean = sanitizeLog(log, date);
      if (clean) data.logs[date] = clean;
    }
  }

  if (raw.backupConflicts && typeof raw.backupConflicts === "object") {
    data.backupConflicts = {};
    for (const [date, versions] of Object.entries(
      raw.backupConflicts as Record<string, unknown>,
    )) {
      if (isValidKey(date) && Array.isArray(versions))
        data.backupConflicts[date] = versions
          .map((v) => sanitizeLog(v, date))
          .filter((v): v is DailyLog => Boolean(v));
    }
  }
  return data;
}

export type StorageRead =
  | { status: "ok" | "empty"; data: CycleData; raw: string | null }
  | { status: "corrupt" | "unavailable"; data: CycleData; raw: string | null };

/** Validation at the persistence boundary: reject corruption instead of losing fields. */
export function isReadableLog(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    PERIOD_FLOW_IDS.includes(v.periodFlow as PeriodFlow) &&
    Array.isArray(v.moods) &&
    v.moods.every((id) => MOOD_IDS.includes(id)) &&
    Array.isArray(v.symptoms) &&
    v.symptoms.every((id) => SYMPTOM_IDS.includes(id)) &&
    (v.energy === null ||
      (typeof v.energy === "number" &&
        Number.isInteger(v.energy) &&
        v.energy >= 1 &&
        v.energy <= 5)) &&
    typeof v.notes === "string" &&
    v.notes.length <= 600 &&
    (v.sexualActivity === undefined ||
      SEXUAL_ACTIVITY_IDS.includes(v.sexualActivity as SexualActivity)) &&
    (v.ovulationTest === undefined ||
      OVULATION_TEST_IDS.includes(v.ovulationTest as OvulationTestResult)) &&
    (v.cervicalMucus === undefined ||
      CERVICAL_MUCUS_IDS.includes(v.cervicalMucus as CervicalMucus))
  );
}

export function readStorage(): StorageRead {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { status: "empty", data: emptyData(), raw };
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value.version !== 1 ||
      !value.logs ||
      typeof value.logs !== "object" ||
      Array.isArray(value.logs)
    )
      throw Error();
    // Refuse lossy recovery: keep the original until the person exports or resets it.
    for (const [date, log] of Object.entries(value.logs)) {
      if (!isValidKey(date) || !isReadableLog(log)) throw Error();
    }
    if (value.backupConflicts !== undefined) {
      if (
        !value.backupConflicts ||
        typeof value.backupConflicts !== "object" ||
        Array.isArray(value.backupConflicts)
      )
        throw Error();
      for (const [date, versions] of Object.entries(value.backupConflicts)) {
        if (
          !isValidKey(date) ||
          !Array.isArray(versions) ||
          !versions.every(isReadableLog)
        )
          throw Error();
      }
    }
    return { status: "ok", data: sanitizeData(value), raw };
  } catch {
    return {
      status: raw === null ? "unavailable" : "corrupt",
      data: emptyData(),
      raw,
    };
  }
}

export function loadData(): CycleData {
  return typeof window === "undefined" ? emptyData() : readStorage().data;
}
export type WriteResult =
  { ok: true } | { ok: false; reason: "storage" | "conflict" };

/** Compare before write: a stale tab must not overwrite a newer document. */
export function saveData(
  data: CycleData,
  expectedRaw?: string | null,
): WriteResult {
  try {
    const storage = window.localStorage;
    if (
      expectedRaw !== undefined &&
      storage.getItem(STORAGE_KEY) !== expectedRaw
    )
      return { ok: false, reason: "conflict" };
    const raw = JSON.stringify(data);
    storage.setItem(STORAGE_KEY, raw);
    return storage.getItem(STORAGE_KEY) === raw
      ? { ok: true }
      : { ok: false, reason: "storage" };
  } catch {
    return { ok: false, reason: "storage" };
  }
}
export function clearData(expectedRaw?: string | null): WriteResult {
  try {
    if (
      expectedRaw !== undefined &&
      window.localStorage.getItem(STORAGE_KEY) !== expectedRaw
    )
      return { ok: false, reason: "conflict" };
    window.localStorage.removeItem(STORAGE_KEY);
    return window.localStorage.getItem(STORAGE_KEY) === null
      ? { ok: true }
      : { ok: false, reason: "storage" };
  } catch {
    return { ok: false, reason: "storage" };
  }
}
export { DEFAULT_SETTINGS };
