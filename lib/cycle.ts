import type { DailyLog, PhaseId, PeriodFlow } from "@/types";
import { addDays, diffDays, formatDayMonth, isValidKey } from "./dates";

/**
 * A small, deterministic cycle engine.
 *
 * It only uses what the person actually recorded (plus the one date they
 * reported during onboarding) and everything it returns is an *estimate*.
 * Nothing here is medical advice.
 */

export interface CyclePeriod {
  start: string;
  end: string;
  length: number;
  /** `log` = built from recorded days, `reported` = from onboarding. */
  source: "log" | "reported";
  status: "ongoing" | "complete" | "incomplete";
}

export interface PredictedWindow {
  start: string;
  end: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * A deliberately small confidence vocabulary. No percentages: the app only
 * knows how many cycles it has seen and how much their lengths varied.
 */
export interface EstimateConfidence {
  level: ConfidenceLevel;
  /** "Bassa", "Media" or "Alta". */
  label: string;
  /** One short, plain-language explanation. */
  note: string;
}

/** An estimated ovulation range, never a confirmed ovulation. */
export interface OvulationEstimate {
  start: string;
  end: string;
  /** The central (best) estimated ovulation day. Raw material for the window. */
  expected: string;
  /** Cycle day of the point estimate, when a current cycle start is known. */
  cycleDay: number | null;
  /** Days from today to the point estimate (negative = passed). */
  daysUntil: number | null;
  basis: PredictionWindow["basis"];
  confidence: EstimateConfidence;
}

/**
 * The estimated fertile window shown in the app.
 *
 * Extends the entire estimated ovulation interval by five days before and
 * two after. It is an optional calendar layer, never contraceptive guidance.
 */
export interface FertileWindow {
  start: string;
  end: string;
  /** The central estimated ovulation day this window is built around. */
  estimatedOvulationDay: string;
  /** Expected period start this window belongs to. */
  periodStart: string;
}

/** The ovulation range for one predicted cycle. */
export interface OvulationWindow {
  start: string;
  end: string;
  expected: string;
  periodStart: string;
}

/**
 * A range, never a promise: the start of the next period is only ever a
 * range derived from the recorded cycles. `basis` explains how weak the
 * estimate is so the UI can say so out loud.
 */
export interface PredictionWindow {
  /** Earliest plausible start. */
  start: string;
  /** Latest plausible start. */
  end: string;
  /** The point estimate (`start + average length`). */
  expected: string;
  /** Completed cycles the range was derived from. */
  cyclesUsed: number;
  basis: "recent" | "initial";
}

export type CycleDayKind =
  | "menstruation-recorded"
  | "menstruation-estimated"
  | "fertile-estimated"
  | "ovulation-estimated"
  | "follicular-estimated"
  | "luteal-estimated"
  | "unknown";

export interface CycleDayState {
  kind: CycleDayKind;
  label: string;
  source: "recorded" | "estimated" | "unknown";
  basis: "recorded" | "history" | "initial" | "unknown";
  cycleDay: number | null;
  phase: PhaseId | null;
  estimate: "current-period" | "next-start" | null;
}

const UNKNOWN_DAY: CycleDayState = {
  kind: "unknown",
  label: "Stato del ciclo non disponibile",
  source: "unknown",
  basis: "unknown",
  cycleDay: null,
  phase: null,
  estimate: null,
};

/** Only these existing v1 values represent an observed menstrual flow. */
export function isMenstrualFlow(flow: PeriodFlow | undefined): boolean {
  return (
    flow === "recorded" ||
    flow === "light" ||
    flow === "medium" ||
    flow === "heavy"
  );
}

export interface CycleStats {
  today: string;
  currentState: CycleDayState;
  /** Expected duration from the current observed/reported start, never saved flow. */
  currentPeriodWindow: PredictedWindow | null;
  /** Periods built from recorded days, oldest first. */
  periods: CyclePeriod[];
  /** All known cycle start dates, oldest first. */
  cycleStarts: string[];
  cycleLengths: number[];
  cyclesTracked: number;
  excludedIntervals: number;
  estimateNote: string;
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleLengthIsEstimate: boolean;
  periodLengthIsEstimate: boolean;
  currentCycleStart: string | null;
  currentCycleDay: number | null;
  phase: PhaseId | null;
  nextPeriodStart: string | null;
  /** Where the next period is likely to start. Always an estimate. */
  prediction: PredictionWindow | null;
  /** Plain-language confidence for the period and ovulation estimates. */
  confidence: EstimateConfidence;
  /** Average absolute deviation of the recent cycle lengths. */
  cycleLengthVariability: number;
  /** Estimated ovulation for the next expected cycle. */
  ovulation: OvulationEstimate | null;
  /** Estimated fertile window for the next expected cycle. */
  fertileWindow: FertileWindow | null;
  /** Optional ovulation interval for the current estimate only. */
  ovulationWindows: OvulationWindow[];
  /** Optional fertile interval for the current estimate only. */
  fertileWindows: FertileWindow[];
  /** Latest positive LH test inside the current cycle, if one was recorded. */
  latestPositiveLhTest: string | null;
  /** Completed cycle lengths the average and the range are based on. */
  cycleLengthsUsed: number;
  recentCycleLengths: number[];
  daysUntilNextPeriod: number | null;
  /** The point estimate is in the past. */
  isLate: boolean;
  /** The whole expected window is in the past. */
  isLateWindow: boolean;
  /** Retained API: no fixed-duration future period blocks are generated. */
  predicted: PredictedWindow[];
  /** Days the person actually recorded as period days. */
  periodDays: string[];
  /** Onboarding date when the last period started, if it is not a logged day. */
  reportedStart: string | null;
  hasPeriodData: boolean;
}

export interface CycleInput {
  logs: Record<string, DailyLog>;
  lastPeriodStart?: string | null;
  averageCycleLength?: number;
  averagePeriodLength?: number;
  /** Passed explicitly so the engine never reads the clock on its own in a render. */
  today: string;
}

/** Safe default used before the client knows the current date. */
export const EMPTY_STATS: CycleStats = {
  today: "",
  currentState: UNKNOWN_DAY,
  currentPeriodWindow: null,
  periods: [],
  cycleStarts: [],
  cycleLengths: [],
  cyclesTracked: 0,
  excludedIntervals: 0,
  estimateNote: "Servono almeno due cicli completati per una stima.",
  averageCycleLength: 28,
  averagePeriodLength: 5,
  cycleLengthIsEstimate: true,
  periodLengthIsEstimate: true,
  currentCycleStart: null,
  currentCycleDay: null,
  phase: null,
  nextPeriodStart: null,
  prediction: null,
  confidence: {
    level: "low",
    label: "Bassa",
    note: "Pochi cicli completati: è una stima indicativa.",
  },
  cycleLengthVariability: 0,
  ovulation: null,
  fertileWindow: null,
  ovulationWindows: [],
  fertileWindows: [],
  latestPositiveLhTest: null,
  cycleLengthsUsed: 0,
  recentCycleLengths: [],
  daysUntilNextPeriod: null,
  isLate: false,
  isLateWindow: false,
  predicted: [],
  periodDays: [],
  reportedStart: null,
  hasPeriodData: false,
};

const PLAUSIBLE_CYCLE = { min: 15, max: 60 };

/** The average and the prediction range use the most recent cycles. */
const RECENT_CYCLES = 6;

/**
 * The luteal phase is assumed to last around 14 days. The range around it
 * (12–16 days) is what keeps this an estimate rather than a fixed day-14 rule.
 */
const LUTEAL_DAYS = 14;
const OVULATION_EARLY = 16;
const OVULATION_LATE = 12;
/**
 * The app's convention for the displayed estimated fertile window: it is drawn
 * around the central estimated ovulation day. Five calendar days before, the
 * day itself, and two calendar days after — eight days inclusive. It stays a
 * soft estimate for the calendar, not a contraceptive calculation.
 */
const FERTILE_DAYS_BEFORE_OVULATION = 5;
const FERTILE_DAYS_AFTER_OVULATION = 2;

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function confidenceFor(
  cyclesUsed: number,
  variability: number,
): EstimateConfidence {
  const spread = Math.max(1, Math.round(variability));
  if (cyclesUsed >= 4 && variability <= 2) {
    return {
      level: "high",
      label: "Alta",
      note: `Basata su ${cyclesUsed} cicli recenti con durate simili.`,
    };
  }
  if (cyclesUsed >= 2 && variability <= 5) {
    return {
      level: "medium",
      label: "Media",
      note: `Basata su ${cyclesUsed} cicli; la durata varia di circa ${spread} ${
        spread === 1 ? "giorno" : "giorni"
      }.`,
    };
  }
  return {
    level: "low",
    label: "Bassa",
    note:
      cyclesUsed < 2
        ? "Pochi cicli completati: è una stima indicativa."
        : `Durate variabili (circa ${spread} giorni di scarto): è una stima indicativa.`,
  };
}

function mean(values: number[]): number {
  return Math.round(average(values));
}

export function estimatePhase(
  cycleDay: number,
  cycleLength: number,
  periodLength: number,
): PhaseId {
  if (cycleDay <= periodLength) return "mestruale";

  const ovulationDay = Math.max(periodLength + 1, cycleLength - 14);
  if (cycleDay <= ovulationDay - 2) return "follicolare";
  if (cycleDay <= ovulationDay + 1) return "ovulatoria";
  return "luteale";
}

/**
 * Point-estimate helper retained for compatibility. computeCycle carries
 * uncertainty and clips its ranges against the current menstrual episode;
 * screens resolve the actual day state through getCycleDayState.
 */
export function getEstimatedFertileWindow(estimatedOvulationDay: string): {
  start: string;
  end: string;
  estimatedOvulationDay: string;
} {
  return {
    start: addDays(estimatedOvulationDay, -FERTILE_DAYS_BEFORE_OVULATION),
    end: addDays(estimatedOvulationDay, FERTILE_DAYS_AFTER_OVULATION),
    estimatedOvulationDay,
  };
}

/** Group logged period days, tolerating a single skipped day in between. */
function groupDays(days: string[], logs: Record<string, DailyLog>): string[][] {
  const sorted = [...days].sort();
  const groups: string[][] = [];

  for (const day of sorted) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    const closedBetween =
      previous &&
      logs[addDays(previous, 1)]?.flowRecorded === true &&
      logs[addDays(previous, 1)]?.periodFlow === "none";
    if (current && previous && diffDays(day, previous) <= 2 && !closedBetween) {
      current.push(day);
    } else {
      groups.push([day]);
    }
  }

  return groups;
}

export function computeCycle(input: CycleInput): CycleStats {
  const today = input.today;
  const fallbackCycle = input.averageCycleLength ?? 28;
  const fallbackPeriod = input.averagePeriodLength ?? 5;

  const periodDays = Object.values(input.logs)
    .filter((log) => isMenstrualFlow(log.periodFlow))
    .map((log) => log.date)
    .filter((date) => isValidKey(date) && date <= today);

  const periods: CyclePeriod[] = groupDays(periodDays, input.logs).map(
    (group) => {
      const start = group[0];
      const end = group[group.length - 1];
      return {
        start,
        end,
        length: diffDays(end, start) + 1,
        source: "log" as const,
        status: (addDays(end, 1) <= today &&
        group.length === diffDays(end, start) + 1 &&
        input.logs[addDays(end, 1)]?.flowRecorded === true &&
        input.logs[addDays(end, 1)]?.periodFlow === "none"
          ? "complete"
          : diffDays(today, end) <= 1
            ? "ongoing"
            : "incomplete") as CyclePeriod["status"],
      };
    },
  );

  const cycleStarts = new Set(periods.map((period) => period.start));

  let reportedStart: string | null = null;
  if (isValidKey(input.lastPeriodStart) && input.lastPeriodStart <= today) {
    // The onboarding date is the same period only if it lands on (or within a
    // couple of days of) a logged start. A start reported a week or more away
    // is a separate period the person knows about and must not be swallowed.
    const alreadyTracked = periods.some(
      (period) =>
        (input.lastPeriodStart! >= period.start &&
          input.lastPeriodStart! <= period.end) ||
        Math.abs(diffDays(input.lastPeriodStart!, period.start)) <= 3,
    );
    if (!alreadyTracked) {
      reportedStart = input.lastPeriodStart;
      cycleStarts.add(reportedStart);
    }
  }

  const starts = [...cycleStarts].sort();

  const cycleLengths = starts
    .slice(1)
    .map((start, index) => diffDays(start, starts[index]))
    .filter(
      (length) =>
        length >= PLAUSIBLE_CYCLE.min && length <= PLAUSIBLE_CYCLE.max,
    );

  const measuredPeriods = periods.filter(
    (period) =>
      period.source === "log" &&
      period.status === "complete" &&
      period.length <= 12,
  );

  const recentCycleLengths = cycleLengths.slice(-RECENT_CYCLES);
  const averageCycleLength = recentCycleLengths.length
    ? mean(recentCycleLengths)
    : fallbackCycle;
  const averagePeriodLength = measuredPeriods.length
    ? mean(measuredPeriods.map((period) => period.length))
    : fallbackPeriod;

  const recentAverage = recentCycleLengths.length
    ? average(recentCycleLengths)
    : 0;
  const cycleLengthVariability =
    recentCycleLengths.length >= 2
      ? average(
          recentCycleLengths.map((length) => Math.abs(length - recentAverage)),
        )
      : 0;
  let confidence = confidenceFor(
    recentCycleLengths.length,
    cycleLengthVariability,
  );

  const excludedIntervals = Math.max(
    0,
    starts.length - 1 - cycleLengths.length,
  );
  const currentCycleStart = starts.length ? starts[starts.length - 1] : null;
  const lastInterval =
    starts.length >= 2
      ? diffDays(starts[starts.length - 1], starts[starts.length - 2])
      : null;
  if (
    lastInterval !== null &&
    (lastInterval < PLAUSIBLE_CYCLE.min || lastInterval > PLAUSIBLE_CYCLE.max)
  ) {
    confidence = {
      level: "low",
      label: "Bassa",
      note: "L’ultimo intervallo è atipico o incompleto: la stima usa soltanto i cicli utilizzabili.",
    };
  }
  const currentEpisode = periods.find(
    (period) => period.start === currentCycleStart,
  );
  let currentPeriodWindow: PredictedWindow | null = null;
  if (currentCycleStart) {
    let end = addDays(currentCycleStart, averagePeriodLength - 1);
    if (currentEpisode && currentEpisode.end > end) end = currentEpisode.end;
    const firstNoFlow = Object.values(input.logs)
      .filter(
        (log) =>
          log.date >= currentCycleStart &&
          log.date <= today &&
          log.date <= end &&
          log.flowRecorded === true &&
          log.periodFlow === "none",
      )
      .map((log) => log.date)
      .sort()[0];
    if (firstNoFlow) end = addDays(firstNoFlow, -1);
    if (end >= currentCycleStart)
      currentPeriodWindow = { start: currentCycleStart, end };
  }

  let currentCycleDay: number | null = null;
  if (currentCycleStart) {
    const day = diffDays(today, currentCycleStart) + 1;
    if (
      day >= 1 &&
      (isMenstrualFlow(input.logs[today]?.periodFlow) ||
        day <= Math.min(90, averageCycleLength + 14))
    )
      currentCycleDay = day;
  }

  const nextPeriodStart = currentCycleStart
    ? addDays(currentCycleStart, averageCycleLength)
    : null;

  const daysUntilNextPeriod =
    nextPeriodStart === null ? null : diffDays(nextPeriodStart, today);

  // A descriptive range, not a calibrated probability. Suppress sparse,
  // discontinuous or highly variable histories instead of inventing precision.
  let prediction: PredictionWindow | null = null;
  if (
    nextPeriodStart &&
    currentCycleDay !== null &&
    recentCycleLengths.length >= 2 &&
    cycleLengthVariability <= 7
  ) {
    const basis: PredictionWindow["basis"] =
      recentCycleLengths.length >= 2 ? "recent" : "initial";
    const spread = basis === "recent" ? cycleLengthVariability : 2;
    const slack = Math.max(3, Math.ceil(spread * 2));
    prediction = {
      start: addDays(nextPeriodStart, -slack),
      end: addDays(nextPeriodStart, slack),
      expected: nextPeriodStart,
      cyclesUsed: recentCycleLengths.length,
      basis,
    };
  }

  const predicted: PredictedWindow[] = [];

  /**
   * Ovulation is estimated backwards from the expected period, never as a
   * fixed day 14. The 12–16 day luteal range gives a small, honest window.
   * The displayed fertile window is then drawn around the central estimated
   * ovulation day: it is a soft estimate for the calendar, not a contraceptive
   * calculation.
   */
  const ovulationWindows: OvulationWindow[] = [];
  const fertileWindows: FertileWindow[] = [];

  if (prediction && currentCycleStart) {
    const expectedOvulation = addDays(prediction.expected, -LUTEAL_DAYS);
    // A range must never extend back into this cycle's menstrual episode.
    const afterMenstruation = currentPeriodWindow
      ? addDays(currentPeriodWindow.end, 1)
      : addDays(currentCycleStart, averagePeriodLength);
    const beforeNextPeriod = addDays(prediction.start, -1);
    const start = [
      addDays(prediction.start, -OVULATION_EARLY),
      afterMenstruation,
    ]
      .sort()
      .at(-1)!;
    const end = [
      addDays(prediction.end, -OVULATION_LATE),
      beforeNextPeriod,
    ].sort()[0];
    // If the calendar assumptions conflict, withhold rather than move an ovulation date.
    if (start <= expectedOvulation && expectedOvulation <= end) {
      ovulationWindows.push({
        start,
        end,
        expected: expectedOvulation,
        periodStart: prediction.expected,
      });
      fertileWindows.push({
        start: [
          addDays(start, -FERTILE_DAYS_BEFORE_OVULATION),
          afterMenstruation,
        ]
          .sort()
          .at(-1)!,
        end: [
          addDays(end, FERTILE_DAYS_AFTER_OVULATION),
          beforeNextPeriod,
        ].sort()[0],
        estimatedOvulationDay: expectedOvulation,
        periodStart: prediction.expected,
      });
    }
  }

  const firstOvulation = ovulationWindows[0];
  const ovulation: OvulationEstimate | null =
    firstOvulation && prediction
      ? {
          ...firstOvulation,
          cycleDay: currentCycleStart
            ? diffDays(firstOvulation.expected, currentCycleStart) + 1
            : null,
          daysUntil: diffDays(firstOvulation.expected, today),
          basis: prediction.basis,
          confidence: {
            level: "low",
            label: "Bassa",
            note: "Intervallo ricavato dal calendario: non conferma l’ovulazione.",
          },
        }
      : null;

  const latestPositiveLhTest = currentCycleStart
    ? (Object.values(input.logs)
        .filter(
          (log) =>
            log.ovulationTest === "positive" &&
            isValidKey(log.date) &&
            diffDays(log.date, currentCycleStart) >= 0 &&
            diffDays(today, log.date) >= 0,
        )
        .map((log) => log.date)
        .sort()
        .pop() ?? null)
    : null;

  const stats: CycleStats = {
    today,
    currentState: UNKNOWN_DAY,
    currentPeriodWindow,
    periods,
    cycleStarts: starts,
    cycleLengths,
    cyclesTracked: cycleLengths.length,
    excludedIntervals,
    estimateNote: excludedIntervals
      ? `${excludedIntervals} intervalli non utilizzati (fuori da 15–60 giorni). Le stime, quando disponibili, usano i cicli utilizzabili e l’ultimo inizio registrato.`
      : currentCycleStart && currentCycleDay === null
        ? "L’ultimo inizio è lontano: aggiorna il diario prima di usare nuove stime."
        : recentCycleLengths.length < 2
          ? "Servono almeno due cicli completati per stimare un intervallo."
          : cycleLengthVariability > 7
            ? "Le durate registrate sono molto variabili: per ora non mostriamo una previsione."
            : "Intervallo indicativo dai cicli recenti, non una certezza.",
    averageCycleLength,
    averagePeriodLength,
    cycleLengthIsEstimate: cycleLengths.length === 0,
    periodLengthIsEstimate: measuredPeriods.length === 0,
    currentCycleStart,
    currentCycleDay,
    phase: null, // Filled exclusively by the shared day-state evaluator below.
    nextPeriodStart,
    prediction,
    confidence,
    cycleLengthVariability: Math.round(cycleLengthVariability * 10) / 10,
    ovulation,
    fertileWindow: fertileWindows[0] ?? null,
    ovulationWindows,
    fertileWindows,
    latestPositiveLhTest,
    cycleLengthsUsed: recentCycleLengths.length,
    recentCycleLengths,
    daysUntilNextPeriod,
    isLate: daysUntilNextPeriod !== null && daysUntilNextPeriod < 0,
    isLateWindow: prediction ? diffDays(today, prediction.end) > 0 : false,
    predicted,
    periodDays,
    reportedStart,
    hasPeriodData: starts.length > 0,
  };
  stats.currentState = getCycleDayState(today, stats, input.logs);
  stats.phase = stats.currentState.phase;
  return stats;
}

/**
 * Cycle day for any date, or null when the date is not inside a known cycle.
 * Used by the calendar day card; purely arithmetic, never reads the clock.
 */
export function cycleDayFor(date: string, stats: CycleStats): number | null {
  if (!stats.cycleStarts.length) return null;
  let start: string | null = null;
  for (const candidate of stats.cycleStarts) {
    if (diffDays(date, candidate) >= 0) start = candidate;
    else break;
  }
  if (!start) return null;
  const day = diffDays(date, start) + 1;
  // A large gap means the person simply did not record for a while: say
  // nothing rather than inventing a day number.
  if (
    day > Math.min(90, stats.averageCycleLength + 14) &&
    !stats.periodDays.includes(date)
  )
    return null;
  return day;
}

/**
 * One precedence rule for Home, Calendar, Insights and derived phase:
 * observed flow > current menstrual duration > next start estimate > fertile
 * interval (with ovulation as a more specific estimate) > other estimated phase.
 * Missing legacy answers are never treated as explicit negative observations.
 */
export function getCycleDayState(
  date: string,
  stats: CycleStats,
  logs: Record<string, DailyLog>,
): CycleDayState {
  if (!isValidKey(date)) return { ...UNKNOWN_DAY };
  const cycleDay = cycleDayFor(date, stats);
  const day = logs[date];
  const knownDay = date <= stats.today;
  const make = (
    kind: CycleDayKind,
    label: string,
    phase: PhaseId | null,
    estimate: CycleDayState["estimate"] = null,
  ): CycleDayState => ({
    kind,
    label,
    phase,
    estimate,
    cycleDay,
    source:
      kind === "menstruation-recorded"
        ? "recorded"
        : kind === "unknown"
          ? "unknown"
          : "estimated",
    basis:
      kind === "menstruation-recorded"
        ? "recorded"
        : estimate === "current-period"
          ? stats.periodLengthIsEstimate
            ? "initial"
            : "history"
          : stats.cycleLengthIsEstimate
            ? "initial"
            : "history",
  });
  if (knownDay && isMenstrualFlow(day?.periodFlow))
    return make("menstruation-recorded", "Mestruazioni", "mestruale");
  const noFlow =
    knownDay && day?.flowRecorded === true && day.periodFlow === "none";
  const contains = (range: PredictedWindow | null) =>
    Boolean(range && date >= range.start && date <= range.end);
  if (!noFlow && contains(stats.currentPeriodWindow))
    return make(
      "menstruation-estimated",
      "Mestruazioni attese",
      "mestruale",
      "current-period",
    );
  if (!noFlow && contains(stats.prediction))
    return make(
      "menstruation-estimated",
      "Possibile inizio delle mestruazioni",
      "mestruale",
      "next-start",
    );
  if (stats.ovulation?.expected === date)
    return make("ovulation-estimated", "Ovulazione stimata", "ovulatoria");
  if (contains(stats.fertileWindow))
    return make(
      "fertile-estimated",
      "Finestra fertile stimata",
      stats.ovulation && date < stats.ovulation.expected
        ? "follicolare"
        : "luteale",
    );
  if (cycleDay === null) return { ...UNKNOWN_DAY };
  const phase = estimatePhase(
    cycleDay,
    stats.averageCycleLength,
    stats.averagePeriodLength,
  );
  // A confirmed end of bleeding wins over the average duration too.
  if (phase === "follicolare" || phase === "mestruale")
    return make(
      "follicular-estimated",
      "Fase follicolare stimata",
      "follicolare",
    );
  if (phase === "luteale")
    return make("luteal-estimated", "Fase luteale stimata", "luteale");
  return { ...UNKNOWN_DAY, cycleDay };
}

/** Days covered by the expected (not recorded) period windows. */
export function predictedDays(stats: CycleStats): string[] {
  const days: string[] = [];
  for (const window of stats.predicted) {
    let day = window.start;
    while (diffDays(day, window.end) <= 0) {
      days.push(day);
      day = addDays(day, 1);
    }
  }
  return days;
}

export function cycleProgress(stats: CycleStats): number {
  if (stats.currentCycleDay === null || stats.averageCycleLength <= 0) return 0;
  return Math.min(
    1,
    Math.max(0.02, stats.currentCycleDay / stats.averageCycleLength),
  );
}

export function describeNextPeriod(stats: CycleStats): string {
  if (stats.daysUntilNextPeriod === null) return "Non ci sono ancora stime";
  const days = stats.daysUntilNextPeriod;
  if (days > 1) return `Previsto tra circa ${days} giorni`;
  if (days === 1) return "Previsto domani, più o meno";
  if (days === 0) return "Previsto oggi, più o meno";
  if (stats.isLateWindow) return "Non hai ancora registrato un nuovo inizio";
  return "La stima è stata superata, ma la finestra non è ancora chiusa";
}

/**
 * Plain-language ovulation copy. It never presents the estimate as confirmed
 * and never interprets a late period.
 */
export function describeOvulation(
  estimate: OvulationEstimate,
  today: string,
): string {
  const days = diffDays(estimate.expected, today);
  if (days > 1) {
    return `Potrebbe avvenire intorno al ${formatDayMonth(estimate.expected)}.`;
  }
  if (days === 1) return "Potrebbe avvenire domani.";
  if (days === 0) return "Potrebbe avvenire oggi.";
  const past = Math.abs(days);
  if (past <= 3) {
    return `La stima indicava circa ${past} ${
      past === 1 ? "giorno" : "giorni"
    } fa.`;
  }
  return "La finestra stimata è passata.";
}
