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
    raw.sexualActivity as SexualActivity
  )
    ? (raw.sexualActivity as SexualActivity)
    : undefined;

  const ovulationTest = OVULATION_TEST_IDS.includes(
    raw.ovulationTest as OvulationTestResult
  )
    ? (raw.ovulationTest as OvulationTestResult)
    : undefined;

  const cervicalMucus = CERVICAL_MUCUS_IDS.includes(
    raw.cervicalMucus as CervicalMucus
  )
    ? (raw.cervicalMucus as CervicalMucus)
    : undefined;

  return {
    date,
    periodFlow: flow,
    moods: uniqueIds<MoodId>(raw.moods, MOOD_IDS),
    symptoms: uniqueIds<SymptomId>(raw.symptoms, SYMPTOM_IDS),
    energy,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 600) : "",
    ...(sexualActivity ? { sexualActivity } : {}),
    ...(raw.spotting === true ? { spotting: true } : {}),
    ...(ovulationTest ? { ovulationTest } : {}),
    ...(cervicalMucus ? { cervicalMucus } : {}),
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
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
        ? asNumber(raw.cycleLength, 28, 20, 45)
        : null,
    periodLength:
      typeof raw.periodLength === "number"
        ? asNumber(raw.periodLength, 5, 1, 10)
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
    averageCycleLength: asNumber(settings.averageCycleLength, 28, 20, 45),
    averagePeriodLength: asNumber(settings.averagePeriodLength, 5, 1, 10),
  };

  data.imports = sanitizeImports(raw.imports);

  if (raw.logs && typeof raw.logs === "object") {
    for (const [date, log] of Object.entries(
      raw.logs as Record<string, unknown>
    )) {
      if (!isValidKey(date)) continue;
      const clean = sanitizeLog(log, date);
      if (clean) data.logs[date] = clean;
    }
  }

  return data;
}

/** Never throws: a broken payload falls back to a clean, empty state. */
export function loadData(): CycleData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return sanitizeData(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data: CycleData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

export function clearData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do
  }
}

export { DEFAULT_SETTINGS };
