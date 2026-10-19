import type { DailyLog, PhaseId } from "@/types";
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
  expected: string;
  /** Cycle day of the point estimate, when a current cycle start is known. */
  cycleDay: number | null;
  /** Days from today to the point estimate (negative = passed). */
  daysUntil: number | null;
  basis: PredictionWindow["basis"];
  confidence: EstimateConfidence;
}

/** The fertile-window estimate derived from the ovulation range. */
export interface FertileWindow {
  start: string;
  end: string;
  expectedOvulation: string;
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

export interface CycleStats {
  /** Periods built from recorded days, oldest first. */
  periods: CyclePeriod[];
  /** All known cycle start dates, oldest first. */
  cycleStarts: string[];
  cycleLengths: number[];
  cyclesTracked: number;
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
  /** Ovulation ranges for the next three expected cycles. */
  ovulationWindows: OvulationWindow[];
  /** Fertile windows for the next three expected cycles. */
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
  /** Upcoming expected period windows (next three cycles). */
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
  periods: [],
  cycleStarts: [],
  cycleLengths: [],
  cyclesTracked: 0,
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
/** A soft, non-medical assumption used only to draw a broader window. */
const FERTILE_DAYS_BEFORE = 5;

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function confidenceFor(
  cyclesUsed: number,
  variability: number
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
  periodLength: number
): PhaseId {
  if (cycleDay <= periodLength) return "mestruale";

  const ovulationDay = Math.max(periodLength + 1, cycleLength - 14);
  if (cycleDay <= ovulationDay - 2) return "follicolare";
  if (cycleDay <= ovulationDay + 1) return "ovulatoria";
  return "luteale";
}

/** Group logged period days, tolerating a single skipped day in between. */
function groupDays(days: string[]): string[][] {
  const sorted = [...days].sort();
  const groups: string[][] = [];

  for (const day of sorted) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    if (current && previous && diffDays(day, previous) <= 2) {
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
    .filter((log) => log.periodFlow !== "none")
    .map((log) => log.date)
    .filter(isValidKey);

  const periods: CyclePeriod[] = groupDays(periodDays).map((group) => {
    const start = group[0];
    const end = group[group.length - 1];
    return {
      start,
      end,
      length: diffDays(end, start) + 1,
      source: "log" as const,
    };
  });

  const cycleStarts = new Set(periods.map((period) => period.start));

  let reportedStart: string | null = null;
  if (isValidKey(input.lastPeriodStart)) {
    // The onboarding date is the same period only if it lands on (or within a
    // couple of days of) a logged start. A start reported a week or more away
    // is a separate period the person knows about and must not be swallowed.
    const alreadyTracked = periods.some(
      (period) => Math.abs(diffDays(input.lastPeriodStart!, period.start)) <= 3
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
        length >= PLAUSIBLE_CYCLE.min && length <= PLAUSIBLE_CYCLE.max
    );

  const measuredPeriods = periods.filter(
    (period) => period.source === "log" && period.length <= 12
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
          recentCycleLengths.map((length) =>
            Math.abs(length - recentAverage)
          )
        )
      : 0;
  const confidence = confidenceFor(
    recentCycleLengths.length,
    cycleLengthVariability
  );

  const currentCycleStart = starts.length ? starts[starts.length - 1] : null;

  let currentCycleDay: number | null = null;
  if (currentCycleStart) {
    const day = diffDays(today, currentCycleStart) + 1;
    if (day >= 1) currentCycleDay = day;
  }

  const nextPeriodStart = currentCycleStart
    ? addDays(currentCycleStart, averageCycleLength)
    : null;

  const daysUntilNextPeriod =
    nextPeriodStart === null ? null : diffDays(nextPeriodStart, today);

  /**
   * The uncertainty range around the expected start.
   *
   * With at least two completed cycles we use how irregular the most recent
   * ones actually were: the average distance from their mean, rounded and
   * capped so the range stays meaningful (a single outlier widens it without
   * stretching it to absurdity). With less history there is nothing honest to
   * measure, so the range stays deliberately wide and is labelled as an
   * initial estimate.
   */
  let prediction: PredictionWindow | null = null;
  if (nextPeriodStart) {
    const basis: PredictionWindow["basis"] =
      recentCycleLengths.length >= 2 ? "recent" : "initial";
    const spread = basis === "recent" ? cycleLengthVariability : 2;
    const slack = Math.min(6, Math.max(1, Math.round(spread)));
    prediction = {
      start: addDays(nextPeriodStart, -slack),
      end: addDays(nextPeriodStart, slack),
      expected: nextPeriodStart,
      cyclesUsed: recentCycleLengths.length,
      basis,
    };
  }

  const predicted: PredictedWindow[] = [];
  if (nextPeriodStart) {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const start = addDays(nextPeriodStart, cycle * averageCycleLength);
      predicted.push({
        start,
        end: addDays(start, Math.max(1, averagePeriodLength) - 1),
      });
    }
  }

  /**
   * Ovulation is estimated backwards from the expected period, never as a
   * fixed day 14. The 12–16 day luteal range gives a small, honest window.
   * The fertile window adds a few days before that range: it is a soft
   * estimate for the calendar, not a contraceptive calculation.
   */
  const ovulationWindows: OvulationWindow[] = [];
  const fertileWindows: FertileWindow[] = [];

  if (prediction) {
    ovulationWindows.push({
      start: addDays(prediction.start, -OVULATION_EARLY),
      end: addDays(prediction.end, -OVULATION_LATE),
      expected: addDays(prediction.expected, -LUTEAL_DAYS),
      periodStart: prediction.expected,
    });
    fertileWindows.push({
      start: addDays(
        prediction.start,
        -(OVULATION_EARLY + FERTILE_DAYS_BEFORE)
      ),
      end: addDays(prediction.end, -(OVULATION_LATE - 1)),
      expectedOvulation: addDays(prediction.expected, -LUTEAL_DAYS),
      periodStart: prediction.expected,
    });
  }

  for (const window of predicted.slice(1)) {
    const expected = addDays(window.start, -LUTEAL_DAYS);
    ovulationWindows.push({
      start: addDays(window.start, -OVULATION_EARLY),
      end: addDays(window.start, -OVULATION_LATE),
      expected,
      periodStart: window.start,
    });
    fertileWindows.push({
      start: addDays(
        window.start,
        -(OVULATION_EARLY + FERTILE_DAYS_BEFORE)
      ),
      end: addDays(window.start, -(OVULATION_LATE - 1)),
      expectedOvulation: expected,
      periodStart: window.start,
    });
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
          confidence,
        }
      : null;

  const latestPositiveLhTest = currentCycleStart
    ? Object.values(input.logs)
        .filter(
          (log) =>
            log.ovulationTest === "positive" &&
            isValidKey(log.date) &&
            diffDays(log.date, currentCycleStart) >= 0 &&
            diffDays(today, log.date) >= 0
        )
        .map((log) => log.date)
        .sort()
        .pop() ?? null
    : null;

  return {
    periods,
    cycleStarts: starts,
    cycleLengths,
    cyclesTracked: cycleLengths.length,
    averageCycleLength,
    averagePeriodLength,
    cycleLengthIsEstimate: cycleLengths.length === 0,
    periodLengthIsEstimate: measuredPeriods.length === 0,
    currentCycleStart,
    currentCycleDay,
    phase:
      currentCycleDay === null
        ? null
        : estimatePhase(
            currentCycleDay,
            averageCycleLength,
            averagePeriodLength
          ),
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
  if (day > stats.averageCycleLength + 14) return null;
  return day;
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
  return Math.min(1, Math.max(0.02, stats.currentCycleDay / stats.averageCycleLength));
}

export function describeNextPeriod(stats: CycleStats): string {
  if (stats.daysUntilNextPeriod === null) return "Non ci sono ancora stime";
  const days = stats.daysUntilNextPeriod;
  if (days > 1) return `Previsto tra circa ${days} giorni`;
  if (days === 1) return "Previsto domani, più o meno";
  if (days === 0) return "Previsto oggi, più o meno";
  if (stats.isLateWindow) return "Il ciclo non è ancora iniziato";
  return "La stima è stata superata, ma la finestra non è ancora chiusa";
}

/**
 * Plain-language ovulation copy. It never presents the estimate as confirmed
 * and never interprets a late period.
 */
export function describeOvulation(
  estimate: OvulationEstimate,
  today: string
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
