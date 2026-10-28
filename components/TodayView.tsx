"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { cycleProgress } from "@/lib/cycle";
import {
  formatRange,
  formatWithWeekday,
  diffDays,
  formatDayMonth,
} from "@/lib/dates";
import { getDailyWellnessSuggestions } from "@/lib/wellness";
import { Card, CycleProgress, PrimaryButton, Screen } from "./ui";
import { LogSummary } from "./LogSummary";
import { Observation } from "./InsightsView";
export function TodayView({
  onLog,
  onDay,
}: {
  onLog: (date: string) => void;
  onDay: (date: string) => void;
}) {
  const { data, stats, today, drafts } = useStore();
  const [more, setMore] = useState(false);
  const log = data.logs[today];
  const p = stats.prediction;
  const current = stats.currentState;
  const wellness = getDailyWellnessSuggestions({
    phase: stats.phase,
    cycleDay: stats.currentCycleDay,
    averageCycleLength: stats.averageCycleLength,
    energy: log?.energy ?? null,
    symptoms: log?.symptoms ?? [],
    moods: log?.moods ?? [],
    periodFlow: log?.periodFlow ?? "none",
    spotting: Boolean(log?.spotting),
    recentLogs: Object.values(data.logs).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    hasLogToday: Boolean(log),
  });
  return (
    <Screen className="pb-28">
      <section className="hero px-5 pb-5 pt-5">
        <h1 aria-label="Oggi" className="label-xs">
          {formatWithWeekday(today)}
        </h1>
        <div
          className="mt-4 text-center"
          aria-label="Stato attuale del ciclo"
          aria-live="polite"
          data-cycle-state={current.kind}
          data-source={current.source}
        >
          {current.kind !== "unknown" ? (
            <h2 className="display-sm text-[23px]">{current.label}</h2>
          ) : null}
          {current.source === "recorded" ? (
            <p className="mt-1 text-[13px] text-rose-deep">
              Flusso registrato oggi
            </p>
          ) : null}
          {current.kind === "menstruation-estimated" ? (
            <p className="mt-1 text-[13px] text-muted">
              Stima dalla durata abituale, non flusso registrato
            </p>
          ) : null}
        </div>
        {stats.currentCycleDay !== null ? (
          <>
            <CycleProgress
              day={stats.currentCycleDay}
              progress={cycleProgress(stats)}
            />
            <p className="text-center text-sm text-muted">
              Dall’ultimo inizio segnalato, il{" "}
              {formatDayMonth(stats.currentCycleStart!)}.
            </p>
            {current.phase === "mestruale" ? (
              <p className="mt-2 text-center text-[13px] text-muted">
                {stats.periodLengthIsEstimate
                  ? "Riferimento iniziale"
                  : "Durata abituale"}
                : circa {stats.averagePeriodLength} giorni
                {stats.periodLengthIsEstimate
                  ? "; mancano episodi completati"
                  : ""}
                .
              </p>
            ) : null}
          </>
        ) : (
          <p className="my-6 text-sm">
            {stats.hasPeriodData
              ? "L’ultimo inizio registrato è lontano. Aggiorna il diario per ritrovare il punto."
              : "Registra le mestruazioni per vedere il giorno del ciclo."}
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm font-medium">Prossime mestruazioni</p>
          {p ? (
            <>
              <p className="display-sm mt-2 text-lg">
                {diffDays(today, p.end) > 0
                  ? "L’intervallo stimato è trascorso."
                  : `Indicativamente ${formatRange(p.start, p.end)}.`}
              </p>
              <p className="mt-2 text-sm text-muted">
                {diffDays(today, p.end) > 0
                  ? "Non hai ancora registrato un nuovo inizio. Puoi aggiungerlo o correggere il diario."
                  : `Da ${p.cyclesUsed} cicli recenti. È un intervallo indicativo, non una certezza.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{stats.estimateNote}</p>
          )}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="display-sm mb-3 text-xl">Come stai oggi?</h2>
        <Card>
          {log ? (
            <div className="mb-4">
              <LogSummary log={log} />
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">
              Un segnale basta. Energia, flusso o come ti senti: scegli tu.
            </p>
          )}
          <PrimaryButton onClick={() => onLog(today)}>
            {drafts[today]
              ? "Riprendi la bozza"
              : log
                ? "Aggiorna oggi"
                : "Registra oggi"}
          </PrimaryButton>
        </Card>
      </section>
      <section className="mt-6">
        <h2 className="display-sm mb-3 text-xl">Cycle ha notato</h2>
        <Observation onDay={onDay} onlyOne />
      </section>
      <section className="mt-6">
        <button
          className="btn btn-quiet"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          Approfondimenti
        </button>
        {more ? (
          <div className="mt-4 space-y-4">
            {stats.ovulation && stats.ovulation.end >= today ? (
              <Card>
                <h2 className="display-sm text-xl">Ovulazione stimata</h2>
                <p className="mt-2 text-sm">
                  {formatRange(stats.ovulation.start, stats.ovulation.end)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Stima ricavata dal calendario, senza conferma dell’ovulazione.
                  Non è un metodo contraccettivo.
                </p>
                {stats.fertileWindow && stats.fertileWindow.end >= today ? (
                  <p className="mt-3 text-sm">
                    Finestra fertile stimata{" "}
                    {formatRange(
                      stats.fertileWindow.start,
                      stats.fertileWindow.end,
                    )}
                    .
                  </p>
                ) : null}
                {stats.latestPositiveLhTest ? (
                  <p className="mt-2 text-sm">
                    Test LH positivo registrato il{" "}
                    {formatDayMonth(stats.latestPositiveLhTest)}: osservazione,
                    non conferma del giorno.
                  </p>
                ) : null}
              </Card>
            ) : null}
            <Card>
              <h2 className="display-sm text-xl">Una piccola idea</h2>
              <p className="mt-2 text-sm">{wellness.care.text}</p>
              <p className="mt-2 text-sm text-muted">
                {log
                  ? "Da ciò che hai registrato oggi."
                  : "Un’idea generale, da adattare a come ti senti."}{" "}
                Non è un’indicazione medica.
              </p>
            </Card>
          </div>
        ) : null}
      </section>
      <p className="mt-8 text-center text-sm text-muted">
        Il diario resta su questo browser.
      </p>
    </Screen>
  );
}
