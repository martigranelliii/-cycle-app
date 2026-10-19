"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { cycleProgress, describeOvulation } from "@/lib/cycle";
import {
  diffDays,
  formatDayMonth,
  formatRange,
  formatWithWeekday,
} from "@/lib/dates";
import { buildInsights, PATTERN_EMPTY_MESSAGE } from "@/lib/insights";
import { getDailyWellnessSuggestions } from "@/lib/wellness";
import {
  Card,
  CycleProgress,
  GhostButton,
  PhaseLine,
  Pill,
  PrimaryButton,
  Screen,
} from "./ui";
import { LogSummary } from "./LogSummary";
import { IconHeart, IconLeaf, IconLock, IconSun } from "./icons";

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function WellnessCard({
  label,
  text,
  tone,
  Icon,
}: {
  label: string;
  text: string;
  tone: "peach" | "sage" | "rose";
  Icon: (props: { className?: string }) => React.ReactNode;
}) {
  const tones = {
    peach: "bg-[rgba(249,230,214,0.6)]",
    sage: "bg-[rgba(233,235,223,0.75)]",
    rose: "bg-[rgba(245,226,230,0.65)]",
  } as const;
  return (
    <div
      className={`rounded-2xl border border-[rgba(53,24,42,0.07)] p-4 ${tones[tone]}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/85 text-plum-soft">
          <Icon className="h-4 w-4" />
        </span>
        <p className="label-xs">{label}</p>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-plum-soft">
        {text}
      </p>
    </div>
  );
}

export function TodayView({ onLog }: { onLog: (date: string) => void }) {
  const { data, stats, logCount, today, greeting } = useStore();
  const todaysLog = data.logs[today] ?? null;

  const rhythm = useMemo(() => {
    const insights = buildInsights(stats, data.logs);
    if (insights.patterns.length > 0) return insights.patterns[0].text;
    if (stats.cyclesTracked >= 1) {
      const days = stats.averageCycleLength;
      const cycles = stats.cycleLengthsUsed;
      return `Nel tuo storico il ciclo dura in media ${days} ${plural(
        days,
        "giorno",
        "giorni"
      )}, calcolata ${cycles === 1 ? "sul tuo ultimo ciclo" : `sui tuoi ultimi ${cycles} cicli`}.`;
    }
    if (logCount >= 3) {
      return `Hai registrato ${logCount} giornate. Continua così: i tuoi pattern arrivano con qualche dato in più.`;
    }
    return null;
  }, [data.logs, logCount, stats]);

  const wellness = useMemo(
    () =>
      getDailyWellnessSuggestions({
        phase: stats.phase,
        cycleDay: stats.currentCycleDay,
        averageCycleLength: stats.averageCycleLength,
        energy: todaysLog?.energy ?? null,
        symptoms: todaysLog?.symptoms ?? [],
        moods: todaysLog?.moods ?? [],
        periodFlow: todaysLog?.periodFlow ?? "none",
        spotting: Boolean(todaysLog?.spotting),
        recentLogs: Object.values(data.logs).sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
        hasLogToday: Boolean(todaysLog),
      }),
    [data.logs, stats, todaysLog]
  );

  const progress = cycleProgress(stats);
  const prediction = stats.prediction;
  // Only after the plausible window has fully passed is it honest to say
  // the estimate is late.
  const lateBy =
    prediction && diffDays(today, prediction.end) > 0
      ? diffDays(today, prediction.end)
      : 0;

  let predictionText = "Registra il primo giorno di mestruazioni per iniziare.";
  let predictionNote = "";

  if (stats.hasPeriodData && prediction) {
    if (lateBy > 0) {
      predictionText = "Il ciclo non è ancora iniziato.";
      predictionNote = `Era previsto indicativamente ${formatRange(
        prediction.start,
        prediction.end
      )}. La stima si aggiorna quando registri l'inizio.`;
    } else {
      predictionText = `Probabile ${formatRange(
        prediction.start,
        prediction.end
      )}.`;
      const basis =
        prediction.basis === "recent"
          ? prediction.cyclesUsed === 1
            ? "Stima basata sul tuo ultimo ciclo."
            : `Stima basata sui tuoi ultimi ${prediction.cyclesUsed} cicli.`
          : "Stima iniziale: diventa più precisa con i tuoi cicli.";
      predictionNote = `${basis} Confidenza ${stats.confidence.label.toLowerCase()}.`;
    }
  } else if (stats.hasPeriodData) {
    predictionText = "La stima arriva con il tuo prossimo ciclo.";
  }

  const ovulation = stats.ovulation;
  const fertile = stats.fertileWindow;

  return (
    <Screen className="pb-32">
      <section className="hero mt-8 px-6 pb-6 pt-7">
        <div>
          <p className="label-xs">{formatWithWeekday(today)}</p>
          <p className="display mt-2 text-[25px] leading-none text-plum">
            {greeting || "Ciao"}{" "}
            <span aria-hidden className="text-[18px] text-rose-deep">
              ✦
            </span>
          </p>
        </div>

        <div className="mt-2">
          <CycleProgress day={stats.currentCycleDay} progress={progress} />
        </div>

        <PhaseLine phase={stats.phase} />

        <div className="mt-5 border-t border-[rgba(53,24,42,0.10)] pt-4 text-center">
          <p className="label-xs">Prossimo ciclo</p>
          <p className="display mx-auto mt-1.5 max-w-[300px] text-[19px] leading-snug text-plum">
            {predictionText}
          </p>
          {predictionNote ? (
            <p className="mx-auto mt-1.5 max-w-[290px] text-[12px] leading-relaxed text-muted">
              {predictionNote}
            </p>
          ) : null}
        </div>
      </section>

      {ovulation ? (
        <section className="mt-8">
          <div className="rounded-3xl border border-[rgba(92,102,83,0.18)] bg-[rgba(233,235,223,0.5)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-xs">Ovulazione stimata</p>
                <p className="display-sm mt-1.5 text-[17px] leading-snug text-plum">
                  {describeOvulation(ovulation, today)}
                </p>
              </div>
              <Pill tone="sage">
                Confidenza {ovulation.confidence.label.toLowerCase()}
              </Pill>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              {ovulation.confidence.note}
            </p>
            {fertile ? (
              <p className="mt-3.5 border-t border-[rgba(92,102,83,0.18)] pt-3.5 text-[12.5px] leading-relaxed text-plum-soft">
                Finestra fertile stimata:{" "}
                <span className="text-plum">
                  {formatRange(fertile.start, fertile.end)}
                </span>
                . È una stima e non va usata come metodo contraccettivo.
              </p>
            ) : null}
            {stats.latestPositiveLhTest ? (
              <p className="mt-2.5 text-[12px] leading-relaxed text-sage">
                Test di ovulazione positivo registrato il{" "}
                {formatDayMonth(stats.latestPositiveLhTest)}. È
                un&apos;osservazione, non una conferma del giorno esatto.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="display-sm text-[21px] leading-tight text-plum">
            Come ti senti oggi?
          </h2>
          {todaysLog ? (
            <span className="shrink-0 pb-0.5 text-[12px] text-muted">
              registrata
            </span>
          ) : null}
        </div>

        <Card>
          {todaysLog ? (
            <div className="flex flex-col gap-6">
              <LogSummary log={todaysLog} />
              <GhostButton className="w-full" onClick={() => onLog(today)}>
                Modifica
              </GhostButton>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-[14px] leading-relaxed text-plum-soft">
                Bastano dieci secondi. Registra umore, sintomi ed energia: è
                così che Cycle impara il tuo ritmo.
              </p>
              <PrimaryButton onClick={() => onLog(today)}>
                Registra oggi
              </PrimaryButton>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="display-sm text-[21px] leading-tight text-plum">
            Oggi per te
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Piccole idee, in base a come stai e a quello che hai registrato.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <WellnessCard
            label="Mangia"
            text={wellness.eat.text}
            tone="peach"
            Icon={IconLeaf}
          />
          <WellnessCard
            label="Muoviti"
            text={wellness.move.text}
            tone="sage"
            Icon={IconSun}
          />
          <WellnessCard
            label="Prenditi cura"
            text={wellness.care.text}
            tone="rose"
            Icon={IconHeart}
          />
        </div>
        <p className="apple-note mt-3">
          Idee delicate, non indicazioni mediche.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="display-sm mb-4 text-[21px] leading-tight text-plum">
          Il tuo ritmo
        </h2>

        <div className="insight-surface p-6">
          <p
            className={`display-sm text-[16px] leading-relaxed ${
              rhythm ? "text-plum" : "text-muted"
            }`}
          >
            {rhythm ?? PATTERN_EMPTY_MESSAGE}
          </p>
        </div>
      </section>

      <div className="mt-16 flex items-center justify-center gap-2">
        <IconLock className="h-3.5 w-3.5 text-muted" />
        <p className="text-[11px] uppercase leading-none tracking-[0.14em] text-muted">
          I tuoi dati restano su questo dispositivo
        </p>
      </div>
    </Screen>
  );
}
