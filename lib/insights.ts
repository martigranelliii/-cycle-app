import type { DailyLog } from "@/types";
import { addDays, diffDays, formatLong, formatShort } from "./dates";
import { cycleDayFor, type CycleStats } from "./cycle";
import { MOODS, SYMPTOMS } from "./labels";

/**
 * Insights are strictly descriptive: they repeat what the person recorded.
 * No diagnosis, no claims about what causes what, and never any correlation
 * involving sexual activity — that data is tracking only.
 */

export interface StatCard {
  label: string;
  value: string;
  note: string;
}

export interface RecentCycle {
  label: string;
  value: string;
  estimated: boolean;
}

export interface CycleComparison {
  start: string;
  label: string;
  length: number;
  periodLength: number | null;
}

/** A descriptive observation with its own evidence, never a diagnosis. */
export interface PatternInsight {
  text: string;
  evidence?: string;
}

export interface Insights {
  averageCycle: StatCard;
  averagePeriod: StatCard;
  cycleRange: { shortest: number; longest: number } | null;
  recentCycles: RecentCycle[];
  comparison: CycleComparison[];
  patterns: PatternInsight[];
  hasEnoughForPatterns: boolean;
}

interface PatternCandidate extends PatternInsight {
  score: number;
  symptomId?: string;
}

const PREMENSTRUAL_WINDOW = 5;
const MAX_PATTERNS = 3;

/**
 * The two consecutive cycle days where a symptom was logged most often.
 * Used only to make an observation concrete ("più spesso nei giorni 1–2").
 */
function mostCommonWindow(
  days: number[]
): { start: number; end: number } | null {
  if (days.length < 2) return null;
  const counts = new Map<number, number>();
  for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
  const maxDay = Math.max(...days);
  let best: { start: number; end: number; total: number } | null = null;
  for (let start = 1; start < maxDay; start += 1) {
    const total = (counts.get(start) ?? 0) + (counts.get(start + 1) ?? 0);
    if (total >= 2 && (!best || total > best.total)) {
      best = { start, end: start + 1, total };
    }
  }
  return best ? { start: best.start, end: best.end } : null;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function premenstrualDays(stats: CycleStats): string[] {
  const days: string[] = [];
  for (const start of stats.cycleStarts) {
    for (let offset = 1; offset <= PREMENSTRUAL_WINDOW; offset += 1) {
      days.push(addDays(start, -offset));
    }
  }
  return days;
}

interface CycleInterval {
  start: string;
  end: string;
  length: number;
}

/** Completed cycles (a start with a known next start), oldest first. */
function completedIntervals(stats: CycleStats): CycleInterval[] {
  const starts = stats.cycleStarts;
  const intervals: CycleInterval[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const length = diffDays(starts[index], starts[index - 1]);
    if (length >= 15 && length <= 60) {
      intervals.push({
        start: starts[index - 1],
        end: starts[index],
        length,
      });
    }
  }
  return intervals;
}

export function buildInsights(
  stats: CycleStats,
  logs: Record<string, DailyLog>
): Insights {
  const allLogs = Object.values(logs);
  const totalLogs = Math.max(1, allLogs.length);
  const hasEnoughForPatterns =
    allLogs.length >= 7 && stats.cycleStarts.length >= 2;

  const averageCycle: StatCard = {
    label: "Durata media del ciclo",
    value: `${stats.averageCycleLength} ${plural(
      stats.averageCycleLength,
      "giorno",
      "giorni"
    )}`,
    note: stats.cycleLengthIsEstimate
      ? "Stima iniziale: si aggiornerà con i tuoi cicli."
      : stats.cycleLengthsUsed === 1
        ? "Calcolata sul tuo ultimo ciclo."
        : `Calcolata sui tuoi ultimi ${stats.cycleLengthsUsed} cicli.`,
  };

  const averagePeriod: StatCard = {
    label: "Durata media delle mestruazioni",
    value: `${stats.averagePeriodLength} ${plural(
      stats.averagePeriodLength,
      "giorno",
      "giorni"
    )}`,
    note: stats.periodLengthIsEstimate
      ? "Stima iniziale: si aggiornerà con i tuoi dati."
      : stats.periods.length === 1
        ? "Dal tuo periodo registrato."
        : `Dai tuoi ${stats.periods.length} periodi registrati.`,
  };

  const cycleRange = stats.cycleLengths.length
    ? {
        shortest: Math.min(...stats.cycleLengths),
        longest: Math.max(...stats.cycleLengths),
      }
    : null;

  const recentCycles: RecentCycle[] = stats.cycleStarts
    .slice(-4)
    .reverse()
    .map((start, index, list) => {
      const next = list[index - 1];
      const length = next ? diffDays(next, start) : null;
      return {
        label: formatLong(start),
        value: length
          ? `${length} ${plural(length, "giorno", "giorni")}`
          : "in corso",
        estimated: length === null,
      };
    });

  const comparison: CycleComparison[] = completedIntervals(stats)
    .slice(-5)
    .reverse()
    .map((interval) => {
      const period = stats.periods.find(
        (candidate) => candidate.start === interval.start
      );
      return {
        start: interval.start,
        label: formatShort(interval.start),
        length: interval.length,
        periodLength: period ? period.length : null,
      };
    });

  /* ----------------------------- patterns ----------------------------- */

  const candidates: PatternCandidate[] = [];

  if (hasEnoughForPatterns) {
    // Only days where the person actually checked in with a mood or a symptom
    // count as evidence: a day with just flow or sexual activity is not a
    // "no symptoms" report, it simply says nothing about symptoms.
    const isCheckIn = (log: DailyLog | undefined) =>
      Boolean(log && (log.moods.length > 0 || log.symptoms.length > 0));
    const windowDays = premenstrualDays(stats).filter((day) =>
      isCheckIn(logs[day])
    );

    // 1. Something that shows up in the days before the period.
    if (windowDays.length >= 6) {
      const addPremenstrual = (
        id: string,
        label: string,
        kind: "symptom" | "mood",
        inWindow: number,
        base: number
      ) => {
        const baseRate = base / totalLogs;
        const rate = inWindow / windowDays.length;
        if (
          inWindow >= 3 &&
          rate >= 0.5 &&
          (base === 0 || rate >= baseRate * 2)
        ) {
          candidates.push({
            score: rate - baseRate,
            symptomId: kind === "symptom" ? id : undefined,
            text: `Hai registrato “${label}” più spesso nei giorni prima delle mestruazioni.`,
            evidence: `Registrato in ${inWindow} delle ${windowDays.length} giornate di check-in prima delle mestruazioni.`,
          });
        }
      };

      for (const symptom of SYMPTOMS) {
        addPremenstrual(
          symptom.id,
          symptom.label,
          "symptom",
          windowDays.filter((day) => logs[day].symptoms.includes(symptom.id))
            .length,
          allLogs.filter((log) => log.symptoms.includes(symptom.id)).length
        );
      }

      for (const mood of MOODS) {
        addPremenstrual(
          mood.id,
          mood.label,
          "mood",
          windowDays.filter((day) => logs[day].moods.includes(mood.id)).length,
          allLogs.filter((log) => log.moods.includes(mood.id)).length
        );
      }
    }

    // 2. A symptom that comes back cycle after cycle, with the most common days.
    const intervals = completedIntervals(stats).slice(-5);
    if (intervals.length >= 3) {
      const recurring = SYMPTOMS.map((symptom) => {
        const cycleDays: number[] = [];
        let count = 0;
        for (const interval of intervals) {
          const matched = allLogs.filter(
            (log) =>
              log.symptoms.includes(symptom.id) &&
              diffDays(log.date, interval.start) >= 0 &&
              diffDays(log.date, interval.end) < 0
          );
          if (matched.length > 0) count += 1;
          for (const log of matched) {
            cycleDays.push(diffDays(log.date, interval.start) + 1);
          }
        }
        return { symptom, count, cycleDays };
      })
        .filter(
          ({ count }) =>
            count >= 3 && count >= Math.ceil(intervals.length * 0.6)
        )
        .sort((a, b) => b.count - a.count);

      const best = recurring[0];
      if (best) {
        const common = mostCommonWindow(best.cycleDays);
        candidates.push({
          score: 0.5 + best.count / intervals.length,
          symptomId: best.symptom.id,
          text: `Hai registrato “${best.symptom.label}” in ${best.count} degli ultimi ${intervals.length} ${
            intervals.length === 1 ? "ciclo" : "cicli"
          }.`,
          evidence: common
            ? `Più spesso nei giorni ${common.start}–${common.end} del ciclo.`
            : `Presente in ${best.count} dei ${intervals.length} cicli completati.`,
        });
      }
    }

    // 3. Where energy tends to be lower (before the period) or higher.
    const energyObservations = allLogs.filter((log) => log.energy !== null);
    if (energyObservations.length >= 7) {
      const overall = average(
        energyObservations.map((log) => log.energy as number)
      );

      const premenstrualEnergy = premenstrualDays(stats)
        .map((day) => logs[day])
        .filter((log): log is DailyLog => Boolean(log && log.energy !== null))
        .map((log) => log.energy as number);

      let energyCandidate: PatternCandidate | null = null;
      if (premenstrualEnergy.length >= 4) {
        const premenstrualAverage = average(premenstrualEnergy);
        if (premenstrualAverage <= overall - 0.5) {
          energyCandidate = {
            score: (overall - premenstrualAverage) / 5 + 0.3,
            text: "Hai registrato energia più bassa nei giorni prima delle mestruazioni.",
            evidence: `Media ${premenstrualAverage.toFixed(
              1
            )} su ${premenstrualEnergy.length} giorni, contro ${overall.toFixed(
              1
            )} nel resto del tuo storico.`,
          };
        }
      }

      if (!energyCandidate) {
        const energyByDay = new Map<number, number[]>();
        for (const log of allLogs) {
          if (log.energy === null) continue;
          const day = cycleDayFor(log.date, stats);
          if (day === null) continue;
          const list = energyByDay.get(day) ?? [];
          list.push(log.energy);
          energyByDay.set(day, list);
        }

        const maxDay = Math.max(...energyByDay.keys());
        const span = Math.min(
          maxDay,
          Math.max(10, stats.averageCycleLength)
        );

        let best: { start: number; end: number; avg: number; n: number } | null =
          null;
        for (let start = 1; start + 5 <= span; start += 1) {
          const values: number[] = [];
          for (let day = start; day < start + 6; day += 1) {
            values.push(...(energyByDay.get(day) ?? []));
          }
          if (values.length < 4) continue;
          const windowAverage = average(values);
          if (!best || windowAverage > best.avg) {
            best = {
              start,
              end: start + 5,
              avg: windowAverage,
              n: values.length,
            };
          }
        }

        if (best && best.avg >= overall + 0.5) {
          energyCandidate = {
            score: (best.avg - overall) / 5,
            text: `Nel tuo storico l'energia tende a essere più alta tra i giorni ${best.start} e ${best.end} del ciclo.`,
            evidence: `Media ${best.avg.toFixed(1)} su ${
              best.n
            } registrazioni in quella finestra.`,
          };
        }
      }

      if (energyCandidate) candidates.push(energyCandidate);
    }
  }

  // Keep at most three, avoid repeating the same symptom twice, and make each
  // observation carry its own evidence.
  const patterns: PatternInsight[] = [];
  const seenSymptoms = new Set<string>();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (candidate.symptomId && seenSymptoms.has(candidate.symptomId)) continue;
    patterns.push({ text: candidate.text, evidence: candidate.evidence });
    if (candidate.symptomId) seenSymptoms.add(candidate.symptomId);
    if (patterns.length >= MAX_PATTERNS) break;
  }

  return {
    averageCycle,
    averagePeriod,
    cycleRange,
    recentCycles,
    comparison,
    patterns,
    hasEnoughForPatterns,
  };
}

export const PATTERN_EMPTY_MESSAGE =
  "Continua a registrare come ti senti. Cycle inizierà a mostrarti i tuoi pattern.";
