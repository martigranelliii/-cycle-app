import type { DailyLog } from "@/types";
import { diffDays, formatLong, formatShort } from "./dates";
import { type CycleStats } from "./cycle";
import { SYMPTOMS } from "./labels";

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
  dates?: string[];
}

export interface Insights {
  averageCycle: StatCard;
  averagePeriod: StatCard;
  cycleRange: { shortest: number; longest: number } | null;
  recentCycles: RecentCycle[];
  comparison: CycleComparison[];
  patterns: PatternInsight[];
  hasEnoughForPatterns: boolean;
  status: "insufficient" | "none" | "observation";
  emptyMessage: string;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
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
  logs: Record<string, DailyLog>,
): Insights {
  const allLogs = Object.values(logs);

  const averageCycle: StatCard = {
    label: "Durata media del ciclo",
    value: stats.cycleLengthIsEstimate
      ? "—"
      : `${stats.averageCycleLength} ${plural(
          stats.averageCycleLength,
          "giorno",
          "giorni",
        )}`,
    note: stats.cycleLengthIsEstimate
      ? "La media arriva con almeno un ciclo completato."
      : stats.cycleLengthsUsed === 1
        ? "Calcolata sul tuo ultimo ciclo."
        : `Calcolata sui tuoi ultimi ${stats.cycleLengthsUsed} cicli.`,
  };

  const averagePeriod: StatCard = {
    label: "Durata media delle mestruazioni",
    value: stats.periodLengthIsEstimate
      ? "—"
      : `${stats.averagePeriodLength} ${plural(
          stats.averagePeriodLength,
          "giorno",
          "giorni",
        )}`,
    note: stats.periodLengthIsEstimate
      ? "Servono episodi completi, con una fine esplicitamente registrata."
      : stats.periods.length === 1
        ? "Dagli episodi completati con una fine registrata."
        : `Dagli episodi completati con una fine registrata.`,
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
        (candidate) => candidate.start === interval.start,
      );
      return {
        start: interval.start,
        label: formatShort(interval.start),
        length: interval.length,
        periodLength: period?.status === "complete" ? period.length : null,
      };
    });

  // Compare the same measured signal on both sides, across completed cycles.
  // Fixed windows only: never search for the best-looking interval.
  const intervals = completedIntervals(stats).slice(-6);
  const sampled = intervals.map((interval) => ({
    ...interval,
    logs: allLogs.filter(
      (log) => log.date >= interval.start && log.date < interval.end,
    ),
  }));
  const symptomCycles = sampled.filter(
    (c) =>
      c.logs.filter((l) => l.symptomsRecorded === true || l.symptoms.length > 0)
        .length >= 4,
  );
  const energyCycles = sampled.filter(
    (c) => c.logs.filter((l) => l.energy !== null).length >= 4,
  );
  const hasEnoughForPatterns =
    symptomCycles.length >= 3 || energyCycles.length >= 3;
  const patterns: PatternInsight[] = [];
  const evidenceFor = (cycles: typeof sampled, days: number) =>
    `${cycles.length} cicli, ${days} giornate pertinenti · ${formatShort(cycles[0].start)} – ${formatLong(cycles[cycles.length - 1].end)}.`;
  if (symptomCycles.length >= 3) {
    const observed = symptomCycles.flatMap((c) =>
      c.logs.filter(
        (l) => l.symptomsRecorded === true || l.symptoms.length > 0,
      ),
    );
    for (const symptom of SYMPTOMS) {
      const matches = observed.filter((l) => l.symptoms.includes(symptom.id));
      const count = symptomCycles.filter((c) =>
        c.logs.some((l) => l.symptoms.includes(symptom.id)),
      ).length;
      if (count >= 3 && count / symptomCycles.length >= 0.6) {
        const earlyCycles = symptomCycles.filter((c) =>
          c.logs.some(
            (l) =>
              l.symptoms.includes(symptom.id) && diffDays(l.date, c.start) < 3,
          ),
        ).length;
        patterns.push({
          text: `Hai registrato “${symptom.label}” in ${count} degli ultimi ${symptomCycles.length} cicli${earlyCycles >= 3 ? ", anche nei primi tre giorni" : ""}.`,
          evidence: evidenceFor(symptomCycles, observed.length),
          dates: matches.map((l) => l.date),
        });
      }
      // Premenstrual vs other days: each cycle must supply BOTH denominators.
      const paired = symptomCycles
        .map((c) => {
          const days = c.logs.filter(
            (l) => l.symptomsRecorded === true || l.symptoms.length > 0,
          );
          return {
            c,
            pre: days.filter((l) => diffDays(c.end, l.date) <= 5),
            rest: days.filter((l) => diffDays(c.end, l.date) > 5),
          };
        })
        .filter((p) => p.pre.length >= 2 && p.rest.length >= 2);
      if (
        paired.length >= 3 &&
        !patterns.some((p) => p.text.includes(`“${symptom.label}”`))
      ) {
        const higher = paired.filter(
          (p) =>
            p.pre.filter((l) => l.symptoms.includes(symptom.id)).length /
              p.pre.length >
            p.rest.filter((l) => l.symptoms.includes(symptom.id)).length /
              p.rest.length,
        );
        const pre = paired.flatMap((p) => p.pre),
          rest = paired.flatMap((p) => p.rest);
        const hits = pre.filter((l) => l.symptoms.includes(symptom.id));
        if (
          higher.length >= 3 &&
          higher.length / paired.length >= 0.75 &&
          hits.length / pre.length >= 0.5 &&
          hits.length / pre.length -
            rest.filter((l) => l.symptoms.includes(symptom.id)).length /
              rest.length >=
            0.25
        )
          patterns.push({
            text: `Hai registrato “${symptom.label}” più spesso nei cinque giorni prima delle mestruazioni.`,
            evidence:
              `${hits.length} di ${pre.length} giornate prima, ${rest.filter((l) => l.symptoms.includes(symptom.id)).length} di ${rest.length} negli altri giorni. ` +
              evidenceFor(
                paired.map((p) => p.c),
                pre.length + rest.length,
              ),
            dates: hits.map((l) => l.date),
          });
      }
    }
  }
  if (energyCycles.length >= 3) {
    const paired = energyCycles
      .map((c) => ({
        c,
        pre: c.logs.filter(
          (l) => l.energy !== null && diffDays(c.end, l.date) <= 5,
        ),
        rest: c.logs.filter(
          (l) => l.energy !== null && diffDays(c.end, l.date) > 5,
        ),
      }))
      .filter((p) => p.pre.length >= 2 && p.rest.length >= 2);
    const avg = (logs: DailyLog[]) =>
      logs.reduce((n, l) => n + (l.energy ?? 0), 0) / logs.length;
    if (
      paired.length >= 3 &&
      paired.filter((p) => avg(p.pre) <= avg(p.rest) - 0.5).length /
        paired.length >=
        0.75
    ) {
      const pre = paired.flatMap((p) => p.pre),
        rest = paired.flatMap((p) => p.rest);
      if (avg(pre) <= avg(rest) - 0.5)
        patterns.push({
          text: "Hai registrato energia più bassa nei cinque giorni prima delle mestruazioni.",
          evidence:
            `Media ${avg(pre).toFixed(1)} su ${pre.length} giorni, rispetto a ${avg(rest).toFixed(1)} su ${rest.length} altri giorni. ` +
            evidenceFor(
              paired.map((p) => p.c),
              pre.length + rest.length,
            ),
          dates: pre.map((l) => l.date),
        });
    }
  }
  const status = patterns.length
    ? "observation"
    : hasEnoughForPatterns
      ? "none"
      : "insufficient";
  const emptyMessage =
    status === "none"
      ? "Per ora non emerge un andamento ricorrente nei segnali registrati."
      : "Cycle sta ancora conoscendo il tuo ritmo. Servono registrazioni di sintomi o energia distribuite su più cicli.";

  return {
    averageCycle,
    averagePeriod,
    cycleRange,
    recentCycles,
    comparison,
    patterns: patterns.slice(0, 3),
    status,
    emptyMessage,
    hasEnoughForPatterns,
  };
}

export const PATTERN_EMPTY_MESSAGE =
  "Continua a registrare come ti senti. Cycle inizierà a mostrarti i tuoi pattern.";
