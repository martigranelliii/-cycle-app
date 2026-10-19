/**
 * Menstrual flow for a day.
 *
 * `recorded` means "these were menstrual days, intensity not indicated": it is
 * what imported history uses, so no intensity is ever invented. The values are
 * additive — more detail can be added later without invalidating stored data.
 */
export type PeriodFlow = "none" | "recorded" | "light" | "medium" | "heavy";

/**
 * Sexual activity of a day. Optional on a log.
 *
 * - `undefined`     → nothing recorded (the state of every pre-existing log)
 * - `"none"`        → the person recorded that nothing happened
 * - `"recorded"`    → activity recorded; imported history knows nothing more
 * - `"protected"`   → activity recorded as protected
 * - `"unprotected"` → activity recorded as unprotected
 *
 * `"recorded"` is historical data: it must never be reclassified, and the UI
 * shows it neutrally as "Rapporto registrato".
 */
export type SexualActivity =
  | "none"
  | "recorded"
  | "protected"
  | "unprotected";

/** Optional LH test result. Absence means it was not recorded. */
export type OvulationTestResult = "negative" | "positive";

/** Optional cervical mucus observation. Absence means it was not recorded. */
export type CervicalMucus = "dry" | "creamy" | "watery" | "egg-white";

/**
 * Mood ids are additive: new values can be appended at any time and older
 * stored logs keep loading untouched (unknown ids are simply ignored).
 */
export type MoodId =
  | "serena"
  | "felice"
  | "energica"
  | "sensibile"
  | "irritabile"
  | "triste"
  | "ansiosa"
  | "stressata";

/** Same additive rule as `MoodId`. */
export type SymptomId =
  | "crampi"
  | "gonfiore"
  | "mal-di-testa"
  | "mal-di-schiena"
  | "seno-sensibile"
  | "acne"
  | "nausea"
  | "voglie"
  | "fame"
  | "libido"
  | "stanchezza"
  | "sonno-disturbato";

export interface DailyLog {
  /** Local date key, `YYYY-MM-DD`. */
  date: string;
  periodFlow: PeriodFlow;
  moods: MoodId[];
  symptoms: SymptomId[];
  /** 1 to 5, or null when the user skipped it. */
  energy: number | null;
  notes: string;
  /** Optional: only present once the person records something for the day. */
  sexualActivity?: SexualActivity;
  /**
   * Spotting is deliberately separate from `periodFlow`: it is an observation,
   * not a period start. The cycle engine never counts it as menstruation.
   */
  spotting?: boolean;
  /** Optional LH test observation. Never used as a confirmed ovulation. */
  ovulationTest?: OvulationTestResult;
  /** Optional observation, shown as context only. */
  cervicalMucus?: CervicalMucus;
  createdAt: string;
  updatedAt: string;
}

export interface Onboarding {
  completed: boolean;
  /** Last period start the user reported, or null when unknown. */
  lastPeriodStart: string | null;
  /** Cycle length the user reported, or null when unknown. */
  cycleLength: number | null;
  /** Period duration the user reported, or null when unknown. */
  periodLength: number | null;
}

export interface Settings {
  averageCycleLength: number;
  averagePeriodLength: number;
}

export interface CycleData {
  version: 1;
  onboarding: Onboarding;
  settings: Settings;
  logs: Record<string, DailyLog>;
  /** One-time import markers: `id` → ISO timestamp. Missing on older data. */
  imports?: Record<string, string>;
}

export type TabId = "oggi" | "calendario" | "registra" | "insights";

export type PhaseId = "mestruale" | "follicolare" | "ovulatoria" | "luteale";
