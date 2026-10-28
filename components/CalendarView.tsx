"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cycleDayFor } from "@/lib/cycle";
import {
  WEEKDAYS,
  formatLong,
  formatRange,
  formatWithWeekday,
  monthKey,
  monthTitle,
  monthWeeks,
  shiftMonth,
} from "@/lib/dates";
import { hasSexualActivity } from "@/lib/labels";
import { LogSummary } from "./LogSummary";
import { Card, GhostButton, PrimaryButton, Screen } from "./ui";
import { IconChevronLeft, IconHeart } from "./icons";

export function CalendarView({
  month,
  selected,
  onMonthChange,
  onSelect,
  onRegister,
}: {
  month: string;
  selected: string;
  onMonthChange: (month: string) => void;
  onSelect: (day: string) => void;
  onRegister: (date: string) => void;
}) {
  const { data, stats, today } = useStore();
  const [showActivity, setShowActivity] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const periodSet = useMemo(
    () => new Set(stats.periodDays),
    [stats.periodDays],
  );
  const prediction = stats.prediction;
  const fertile = stats.fertileWindow;
  const ovulation = stats.ovulation;
  const inside = (day: string, range: { start: string; end: string } | null) =>
    Boolean(range && day >= range.start && day <= range.end);
  const selectedLog = data.logs[selected];
  const isFuture = selected > today;
  const cycleDay = isFuture ? null : cycleDayFor(selected, stats);
  const episode = stats.periods.find(
    (p) => selected >= p.start && selected <= p.end,
  );
  const selectedFertile = inside(selected, fertile);
  const selectedPredicted = inside(selected, prediction);
  return (
    <Screen className="calendar-screen pb-28">
      <header className="calendar-header">
        <h1 className="display text-[28px] leading-tight">
          {monthTitle(month)}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Mese precedente"
            className="calendar-month-button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mese successivo"
            className="calendar-month-button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            <IconChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </header>
      <div className="card calendar-shell">
        <div className="calendar-weekdays" aria-hidden>
          {WEEKDAYS.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>
        <div
          className="calendar-days"
          role="group"
          aria-label={`Giorni di ${monthTitle(month)}`}
        >
          {weeks.flat().map((day, i) => {
            if (!day) return <span key={`empty-${i}`} aria-hidden />;
            const period = periodSet.has(day);
            const predicted = !period && inside(day, prediction);
            const isFertile = !period && inside(day, fertile);
            const isOvulation = ovulation?.expected === day;
            const hasLog = Boolean(data.logs[day]);
            const activity =
              showActivity && hasSexualActivity(data.logs[day]?.sexualActivity);
            const label = [
              formatLong(day),
              period ? "mestruazioni registrate" : "",
              predicted ? "inizio mestruazioni stimato" : "",
              isFertile ? "finestra fertile stimata" : "",
              isOvulation ? "ovulazione stimata" : "",
              hasLog ? "giorno registrato" : "",
              activity ? "rapporto registrato" : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                type="button"
                key={day}
                data-date={day}
                className="calendar-day"
                data-period={period || undefined}
                data-predicted={predicted || undefined}
                data-fertile={isFertile || undefined}
                data-selected={selected === day || undefined}
                data-today={today === day || undefined}
                aria-label={label}
                aria-pressed={selected === day}
                aria-current={day === today ? "date" : undefined}
                onClick={() => {
                  onSelect(day);
                  requestAnimationFrame(() =>
                    detailRef.current?.scrollIntoView({
                      block: "nearest",
                      behavior: "auto",
                    }),
                  );
                }}
              >
                <span>{Number(day.slice(-2))}</span>
                {isOvulation ? (
                  <span className="calendar-ovulation-dot" aria-hidden />
                ) : null}
                {hasLog || activity ? (
                  <span className="calendar-day-marks" aria-hidden>
                    {hasLog ? <span className="calendar-log-dot" /> : null}
                    {activity ? <IconHeart className="h-2.5 w-2.5" /> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="bg-rose-soft" />
            Mestruazioni
          </span>
          <span>
            <i className="bg-sage-soft" />
            Finestra fertile stimata
          </span>
          <span>
            <i className="calendar-legend-prediction" />
            Inizio stimato
          </span>
          <span>• Registrazione · Bordo: oggi</span>
        </div>
      </div>
      <div className="calendar-toolbar">
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={showActivity}
            onChange={(e) => setShowActivity(e.target.checked)}
          />
          Mostra rapporti
        </label>
        {monthKey(month) !== monthKey(today) || selected !== today ? (
          <button
            type="button"
            className="min-h-11 text-[13px] text-rose-deep"
            onClick={() => {
              onMonthChange(`${monthKey(today)}-01`);
              onSelect(today);
            }}
          >
            Torna a oggi
          </button>
        ) : null}
      </div>
      <div className="calendar-dates">
        {prediction ? (
          <div>
            <p>Prossime mestruazioni · stima</p>
            <p className="display-sm">
              {formatRange(prediction.start, prediction.end)}
            </p>
          </div>
        ) : null}
        {fertile ? (
          <div>
            <p>Finestra fertile stimata</p>
            <p className="display-sm">
              {formatRange(fertile.start, fertile.end)}
            </p>
          </div>
        ) : null}
        {ovulation ? (
          <div>
            <p>Ovulazione stimata</p>
            <p className="display-sm">
              {formatRange(ovulation.start, ovulation.end)}
            </p>
          </div>
        ) : null}
        {!prediction ? (
          <p className="text-sm text-muted">{stats.estimateNote}</p>
        ) : null}
      </div>
      <section
        ref={detailRef}
        className="calendar-detail-region mt-5"
        aria-label="Dettaglio giorno"
        aria-live="polite"
      >
        <Card className="calendar-detail">
          <h2 className="display-sm text-[22px]">
            {formatWithWeekday(selected)}{" "}
            <span className="text-sm text-muted">{selected.slice(0, 4)}</span>
          </h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px] text-muted">
            {cycleDay ? <span>Giorno {cycleDay} del ciclo</span> : null}
            {selectedFertile ? (
              <span className="text-sage">Finestra fertile stimata</span>
            ) : null}
            {selectedPredicted ? (
              <span className="text-rose-deep">
                Possibile inizio delle mestruazioni
              </span>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {selectedLog ? (
              <LogSummary log={selectedLog} />
            ) : (
              <p className="text-sm text-muted">
                {isFuture
                  ? "Giorno futuro: puoi consultare le stime, ma non registrare in anticipo."
                  : "Nessuna registrazione."}
              </p>
            )}
            {episode && episode.status !== "complete" ? (
              <details className="text-[13px] text-muted">
                <summary className="min-h-11 py-2">
                  Durata delle mestruazioni
                </summary>
                <p>
                  {episode.status === "ongoing"
                    ? "Episodio ancora aperto: la durata non entra nella media."
                    : "Fine non confermata o giornate mancanti: questo episodio non entra nella durata media."}
                </p>
              </details>
            ) : null}
            {!isFuture ? (
              selectedLog ? (
                <GhostButton onClick={() => onRegister(selected)}>
                  Modifica
                </GhostButton>
              ) : (
                <PrimaryButton onClick={() => onRegister(selected)}>
                  Registra questo giorno
                </PrimaryButton>
              )
            ) : null}
          </div>
        </Card>
      </section>
      <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
        Le date sono stime del ciclo corrente. La finestra fertile non è un
        metodo contraccettivo.
      </p>
    </Screen>
  );
}
