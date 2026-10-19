"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { cycleDayFor, estimatePhase, predictedDays } from "@/lib/cycle";
import {
  WEEKDAYS,
  addDays,
  diffDays,
  formatLong,
  formatWithWeekday,
  monthKey,
  monthTitle,
  monthWeeks,
  shiftMonth,
} from "@/lib/dates";
import { PHASES, hasSexualActivity } from "@/lib/labels";
import { LogSummary } from "./LogSummary";
import {
  Card,
  GhostButton,
  PrimaryButton,
  Screen,
  SectionTitle,
} from "./ui";
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

  const weeks = useMemo(() => monthWeeks(month), [month]);
  const periodSet = useMemo(
    () => new Set(stats.periodDays),
    [stats.periodDays]
  );
  const predictedSet = useMemo(
    () => new Set(predictedDays(stats)),
    [stats]
  );
  const windowSet = useMemo(() => {
    const days = new Set<string>();
    const prediction = stats.prediction;
    if (!prediction) return days;
    const total = diffDays(prediction.end, prediction.start);
    for (let offset = 0; offset <= total; offset += 1) {
      days.add(addDays(prediction.start, offset));
    }
    return days;
  }, [stats.prediction]);
  const fertileSet = useMemo(() => {
    const days = new Set<string>();
    for (const window of stats.fertileWindows) {
      const total = diffDays(window.end, window.start);
      for (let offset = 0; offset <= total; offset += 1) {
        days.add(addDays(window.start, offset));
      }
    }
    return days;
  }, [stats.fertileWindows]);
  const ovulationRangeSet = useMemo(() => {
    const days = new Set<string>();
    for (const window of stats.ovulationWindows) {
      const total = diffDays(window.end, window.start);
      for (let offset = 0; offset <= total; offset += 1) {
        days.add(addDays(window.start, offset));
      }
    }
    return days;
  }, [stats.ovulationWindows]);
  const ovulationSet = useMemo(
    () => new Set(stats.ovulationWindows.map((window) => window.expected)),
    [stats.ovulationWindows]
  );

  const selectedLog = data.logs[selected] ?? null;
  const isFuture = diffDays(selected, today) > 0;
  const isCurrentMonth = monthKey(month) === monthKey(today);
  const selectedDay = cycleDayFor(selected, stats);
  const selectedPredicted =
    predictedSet.has(selected) && !periodSet.has(selected);
  const selectedInWindow =
    windowSet.has(selected) && !selectedPredicted && !periodSet.has(selected);
  const selectedInFertile = fertileSet.has(selected);
  const selectedInOvulationRange = ovulationRangeSet.has(selected);
  const selectedIsOvulationExpected = ovulationSet.has(selected);
  const selectedPhase =
    selectedDay !== null
      ? estimatePhase(
          selectedDay,
          stats.averageCycleLength,
          stats.averagePeriodLength
        )
      : null;

  const subtitle = selectedDay
    ? `Giorno ${selectedDay} del ciclo`
    : selectedInFertile
      ? "Finestra fertile stimata"
      : selectedPredicted
        ? "Periodo previsto · stima"
        : selectedInWindow
          ? "Finestra probabile del prossimo ciclo"
          : "Fuori dal ciclo registrato";

  return (
    <Screen className="pb-32">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-tight">
            {monthTitle(month)}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Il tuo diario, giorno per giorno.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mese precedente"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-soft text-plum-soft transition-colors"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mese successivo"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-soft text-plum-soft transition-colors"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            <IconChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </header>

      <Card className="p-2.5">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              className="label-xs py-2 text-center"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {weeks.flat().map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />;

            const isPeriod = periodSet.has(day);
            const isPredicted = !isPeriod && predictedSet.has(day);
            const inWindow =
              !isPeriod && !isPredicted && windowSet.has(day);
            const isFertile =
              !isPeriod && !isPredicted && !inWindow && fertileSet.has(day);
            const hasLog = Boolean(data.logs[day]);
            const isToday = day === today;
            const isSelected = day === selected;
            const hasActivity = hasSexualActivity(
              data.logs[day]?.sexualActivity
            );
            const isOvulation = ovulationSet.has(day);
            const showLogDot = hasLog && !isPeriod && !isSelected;

            const background = isPeriod
              ? "var(--rose-soft)"
              : inWindow
                ? "var(--peach-soft)"
                : isFertile
                  ? "var(--sage-soft)"
                  : "transparent";
            const border = isToday
              ? "1px solid var(--rose-deep)"
              : isPredicted
                ? "1px dashed var(--rose-deep)"
                : "1px solid transparent";

            const label = [
              formatLong(day),
              isPeriod ? "mestruazioni registrate" : "",
              isPredicted ? "periodo previsto" : "",
              inWindow ? "finestra probabile del ciclo" : "",
              isFertile ? "finestra fertile stimata" : "",
              isOvulation ? "ovulazione stimata" : "",
              hasLog ? "giorno registrato" : "",
              hasActivity ? "rapporto registrato" : "",
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                aria-label={label}
                aria-pressed={isSelected}
                className={`day-button relative mx-auto flex aspect-square w-full max-w-11 flex-col items-center justify-center rounded-full text-[15px] ${
                  isSelected ? "day-selected" : ""
                }`}
                style={
                  isSelected
                    ? undefined
                    : {
                        background,
                        border,
                        color: "var(--plum)",
                      }
                }
              >
                {day.slice(-2).replace(/^0/, "")}
                {isOvulation && !isSelected ? (
                  <span
                    aria-hidden
                    className="absolute top-[3px] h-[4px] w-[4px] rounded-full"
                    style={{ background: "var(--sage)" }}
                  />
                ) : null}
                {showLogDot || hasActivity ? (
                  <span
                    aria-hidden
                    className="absolute bottom-[3px] flex h-[10px] items-center gap-[3px]"
                  >
                    {showLogDot ? (
                      <span
                        className="h-[4px] w-[4px] rounded-full"
                        style={{
                          background: isSelected
                            ? "var(--rose-soft)"
                            : "var(--muted-very)",
                        }}
                      />
                    ) : null}
                    {hasActivity ? (
                      <span
                        className="shrink-0"
                        style={{
                          color: isSelected
                            ? "var(--rose-soft)"
                            : "var(--rose-deep)",
                        }}
                      >
                        <IconHeart className="h-[9px] w-[9px]" />
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="divider my-3" />

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-1 pb-1">
          <Legend
            swatch={
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "var(--rose-soft)" }}
              />
            }
            label="Mestruazioni"
          />
          <Legend
            swatch={
              <span
                className="h-3 w-3 rounded-full"
                style={{ border: "1px dashed var(--rose-deep)" }}
              />
            }
            label="Periodo previsto"
          />
          <Legend
            swatch={
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "var(--peach-soft)" }}
              />
            }
            label="Finestra probabile"
          />
          <Legend
            swatch={
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "var(--sage-soft)" }}
              />
            }
            label="Finestra fertile stimata"
          />
          <Legend
            swatch={
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: "var(--sage)" }}
              />
            }
            label="Ovulazione stimata"
          />
          <Legend
            swatch={
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: "var(--muted-very)" }}
              />
            }
            label="Giorno registrato"
          />
          <Legend
            swatch={
              <span style={{ color: "var(--rose-deep)" }}>
                <IconHeart className="h-3 w-3" />
              </span>
            }
            label="Rapporti"
          />
        </div>
      </Card>

      {!isCurrentMonth ? (
        <button
          type="button"
          className="mx-auto mt-4 block text-[13px] text-muted underline decoration-[rgba(53,24,42,0.28)] underline-offset-4"
          onClick={() => {
            onMonthChange(`${monthKey(today)}-01`);
            onSelect(today);
          }}
        >
          Torna al mese corrente
        </button>
      ) : null}

      <section className="mt-8">
        <SectionTitle>
          {isFuture ? "Giorno futuro" : "Giorno selezionato"}
        </SectionTitle>
        <Card>
          <div className="mb-5">
            <p className="display text-[21px] leading-tight">
              {formatWithWeekday(selected)}{" "}
              <span className="text-[14px] text-muted">
                {selected.slice(0, 4)}
              </span>
            </p>
            <p className="mt-1.5 text-[12px] text-muted">{subtitle}</p>
          </div>

          {stats.hasPeriodData ? (
            <div className="mb-6 flex flex-col gap-4 border-b border-line-light pb-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="label-xs">Ciclo</span>
                  <span className="text-[15px] leading-snug text-plum">
                    {selectedDay ? `Giorno ${selectedDay}` : "—"}
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted">
                    {selectedPhase
                      ? `${PHASES[selectedPhase].label} stimata`
                      : "Fuori dal ciclo registrato"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="label-xs">Ovulazione</span>
                  <span className="text-[15px] leading-snug text-plum">
                    {selectedIsOvulationExpected
                      ? "Stimata"
                      : selectedInOvulationRange
                        ? "Nella finestra"
                        : "—"}
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted">
                    {selectedInOvulationRange
                      ? "Stima, non conferma"
                      : "Fuori dalla finestra stimata"}
                  </span>
                </div>
              </div>
              {selectedInFertile ? (
                <p className="text-[12.5px] leading-relaxed text-sage">
                  Finestra fertile stimata. È una stima e non va usata come
                  metodo contraccettivo.
                </p>
              ) : null}
              {selectedPredicted ? (
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Periodo previsto: è una stima basata sul tuo storico.
                </p>
              ) : null}
              {selectedInWindow && !selectedPredicted ? (
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Finestra probabile del prossimo ciclo: è una stima.
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedLog ? (
            <div className="flex flex-col gap-6">
              <LogSummary log={selectedLog} />
              {isFuture ? (
                <p className="text-[12px] leading-relaxed text-muted">
                  Giorno futuro: la registrazione è in sola lettura.
                </p>
              ) : (
                <GhostButton
                  className="w-full"
                  onClick={() => onRegister(selected)}
                >
                  Modifica
                </GhostButton>
              )}
            </div>
          ) : isFuture ? (
            <p className="text-[14px] leading-relaxed text-muted">
              {selectedPredicted
                ? "Qui il ciclo è previsto, ma è solo una stima."
                : selectedInWindow
                  ? "Da qui potrebbe iniziare il prossimo ciclo: è una stima."
                  : "Non puoi registrare un giorno futuro."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-relaxed text-muted">
                Nessuna registrazione per questo giorno.
              </p>
              <PrimaryButton onClick={() => onRegister(selected)}>
                Registra questo giorno
              </PrimaryButton>
            </div>
          )}
        </Card>
      </section>

      <p className="apple-note mt-8">
        Il tratteggio e le fasce colorate sono stime basate sul tuo storico,
        non certezze. La finestra fertile non è un metodo contraccettivo.
      </p>
    </Screen>
  );
}

function Legend({
  swatch,
  label,
}: {
  swatch: ReactNode;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-[11px] leading-tight text-muted">
      {swatch}
      {label}
    </span>
  );
}
