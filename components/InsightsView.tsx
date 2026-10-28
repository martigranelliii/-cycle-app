"use client";
import { useStore } from "@/lib/store";
import { buildInsights } from "@/lib/insights";
import { Card, Screen } from "./ui";
export function Observation({
  onDay,
  onlyOne = false,
}: {
  onDay: (date: string) => void;
  onlyOne?: boolean;
}) {
  const { data, stats } = useStore();
  const insights = buildInsights(stats, data.logs);
  return (
    <div className="space-y-4">
      {insights.patterns.length ? (
        insights.patterns.slice(0, onlyOne ? 1 : 3).map((p) => (
          <div className="insight-surface p-5" key={p.text}>
            <p className="display-sm text-lg">{p.text}</p>
            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-3">
                Su cosa si basa?
              </summary>
              <p className="text-muted">{p.evidence}</p>
              <p className="mt-2 text-muted">
                Descrive le registrazioni disponibili, non le cause o tutti i
                giorni vissuti.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.dates?.map((date) => (
                  <button
                    className="chip"
                    key={date}
                    onClick={() => onDay(date)}
                  >
                    {new Date(date + "T12:00:00").toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))
      ) : (
        <Card>
          <p className="text-sm leading-relaxed">{insights.emptyMessage}</p>
          {insights.status === "insufficient" ? (
            <details className="mt-3 text-sm">
              <summary className="min-h-11 py-2">Quali dati servono?</summary>
              <p>
                Almeno quattro giornate con sintomi o energia in ciascuno di tre
                cicli completati. Per confrontare i giorni prima delle
                mestruazioni servono registrazioni anche negli altri giorni. Non
                occorre registrare tutto.
              </p>
            </details>
          ) : null}
        </Card>
      )}
    </div>
  );
}
export function InsightsView({ onDay }: { onDay: (date: string) => void }) {
  const { data, stats } = useStore();
  const insights = buildInsights(stats, data.logs);
  return (
    <Screen className="pb-28">
      <header className="mb-6">
        <h1 className="display text-3xl">Il tuo andamento</h1>
        <p className="mt-2 text-sm text-muted">
          Cosa raccontano le tue registrazioni.
        </p>
      </header>
      <section>
        <h2 className="display-sm mb-3 text-xl">Cycle ha notato</h2>
        <Observation onDay={onDay} />
      </section>
      <section className="mt-7">
        <h2 className="display-sm mb-3 text-xl">I cicli recenti</h2>
        <Card>
          {insights.comparison.length ? (
            <ul className="space-y-4">
              {insights.comparison.map((c) => (
                <li key={c.start}>
                  <button
                    className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
                    onClick={() => onDay(c.start)}
                  >
                    <span className="text-sm">Dal {c.label}</span>
                    <span className="display-sm text-xl">
                      {c.length} giorni
                    </span>
                  </button>
                  {c.periodLength ? (
                    <p className="text-sm text-muted">
                      Mestruazioni: {c.periodLength} giorni osservati; controlla
                      il diario per la completezza.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Con due inizi registrati potrai confrontare il primo ciclo.
            </p>
          )}
        </Card>
      </section>
      <section className="mt-7">
        <h2 className="display-sm mb-3 text-xl">Numeri di contesto</h2>
        <Card>
          <dl className="space-y-5">
            {[insights.averageCycle, insights.averagePeriod].map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="display-sm mt-1 text-2xl">{s.value}</dd>
                <dd className="mt-1 text-sm text-muted">{s.note}</dd>
              </div>
            ))}
          </dl>
          {insights.cycleRange ? (
            <p className="mt-4 text-sm">
              Durate osservate: {insights.cycleRange.shortest}–
              {insights.cycleRange.longest} giorni.
            </p>
          ) : null}
          <p className="mt-4 text-sm text-muted">{stats.estimateNote}</p>
        </Card>
      </section>
    </Screen>
  );
}
