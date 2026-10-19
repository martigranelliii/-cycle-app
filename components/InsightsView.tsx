"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useStore } from "@/lib/store";
import { buildInsights, PATTERN_EMPTY_MESSAGE } from "@/lib/insights";
import { backupFilename, buildBackup, parseBackup } from "@/lib/backup";
import { formatRange } from "@/lib/dates";
import { Card, Pill, Screen, SectionTitle, Stepper, StatRow } from "./ui";
import {
  IconCheck,
  IconChevron,
  IconImport,
  IconLeaf,
  IconLock,
  IconTrash,
  IconUpload,
} from "./icons";

export function InsightsView() {
  const {
    data,
    stats,
    logCount,
    updateSettings,
    resetAll,
    importHistory,
    historyImported,
    restoreBackup,
  } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const insights = useMemo(
    () => buildInsights(stats, data.logs),
    [stats, data.logs]
  );

  const maxCycle = Math.max(
    1,
    ...insights.comparison.map((cycle) => cycle.length)
  );

  function handleImportHistory() {
    const confirmed = window.confirm(
      "Importare lo storico precedente? Verranno aggiunti i giorni di mestruazioni e i giorni con rapporti che avevi già registrato. Le registrazioni che hai qui non vengono modificate."
    );
    if (!confirmed) return;
    const report = importHistory();
    if (report.alreadyImported) {
      setImportNotice("Lo storico risulta già importato.");
      return;
    }
    setImportNotice(
      `${report.periodDays} ${
        report.periodDays === 1 ? "giorno" : "giorni"
      } di mestruazioni e ${report.sexualActivityDays} ${
        report.sexualActivityDays === 1 ? "giorno" : "giorni"
      } con rapporti sono ora sul dispositivo.`
    );
  }

  function handleExport() {
    const backup = buildBackup(data);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backupFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDataNotice({
      tone: "ok",
      text: "Backup esportato: il file contiene tutti i tuoi dati.",
    });
  }

  async function handleBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow picking the same file again later.
    event.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setDataNotice({
        tone: "error",
        text: "Non riesco a leggere questo file.",
      });
      return;
    }

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setDataNotice({ tone: "error", text: parsed.error });
      return;
    }

    const confirmed = window.confirm(
      `Importare il backup? Contiene ${parsed.logCount} ${
        parsed.logCount === 1 ? "giornata" : "giornate"
      }. I giorni già presenti su questo dispositivo non verranno modificati: verranno aggiunti solo quelli mancanti.`
    );
    if (!confirmed) return;

    const report = restoreBackup(parsed.data);
    setDataNotice({
      tone: "ok",
      text:
        report.added > 0
          ? `${report.added} ${
              report.added === 1 ? "giornata aggiunta" : "giornate aggiunte"
            }${
              report.kept > 0
                ? `, ${report.kept} già presenti lasciate com'erano`
                : ""
            }.`
          : report.kept > 0
            ? "Backup letto: nessun giorno nuovo, i tuoi dati erano già completi."
            : "Backup letto: non conteneva giornate.",
    });
  }

  return (
    <Screen className="pb-32">
      <header className="mb-7">
        <h1 className="display text-[30px] leading-tight">Il tuo andamento</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Medie, ultimi cicli e pattern, letti dalle tue registrazioni.
        </p>
      </header>

      <Card className="py-2">
        <div className="divide-y divide-line">
          <StatRow
            label={insights.averageCycle.label}
            value={insights.averageCycle.value}
            note={insights.averageCycle.note}
          />
          <StatRow
            label={insights.averagePeriod.label}
            value={insights.averagePeriod.value}
            note={insights.averagePeriod.note}
          />
        </div>
        {insights.cycleRange ? (
          <div className="grid grid-cols-2 gap-4 border-t border-line py-4">
            <div>
              <p className="label-xs">Più corto</p>
              <p className="display-sm mt-1.5 text-[24px] leading-none text-plum">
                {insights.cycleRange.shortest}{" "}
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  gg
                </span>
              </p>
            </div>
            <div>
              <p className="label-xs">Più lungo</p>
              <p className="display-sm mt-1.5 text-[24px] leading-none text-plum">
                {insights.cycleRange.longest}{" "}
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  gg
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      {stats.prediction || stats.ovulation ? (
        <section className="mt-8">
          <SectionTitle>Le tue stime</SectionTitle>
          <Card className="flex flex-col gap-4">
            {stats.prediction ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-muted">Prossimo ciclo</span>
                <span className="display-sm text-right text-[16px] leading-snug text-plum">
                  {formatRange(stats.prediction.start, stats.prediction.end)}
                </span>
              </div>
            ) : null}
            {stats.ovulation ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-muted">
                  Ovulazione stimata
                </span>
                <span className="display-sm text-right text-[16px] leading-snug text-plum">
                  {formatRange(stats.ovulation.start, stats.ovulation.end)}
                </span>
              </div>
            ) : null}
            {stats.fertileWindow ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-muted">
                  Finestra fertile stimata
                </span>
                <span className="display-sm text-right text-[16px] leading-snug text-plum">
                  {formatRange(
                    stats.fertileWindow.start,
                    stats.fertileWindow.end
                  )}
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <Pill tone="sage" className="self-start">
                Confidenza {stats.confidence.label.toLowerCase()}
              </Pill>
              <p className="text-[12px] leading-relaxed text-muted">
                {stats.confidence.note}
              </p>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Sono stime basate sul tuo storico, non certezze. La finestra
              fertile non è un metodo contraccettivo.
            </p>
          </Card>
        </section>
      ) : null}

      <section className="mt-8">
        <SectionTitle>I tuoi ultimi cicli</SectionTitle>
        <Card>
          {insights.comparison.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-muted">
              Nessun ciclo completato per ora. Quando segnerai l&apos;inizio di
              due cicli, qui potrai confrontarli.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-5">
                {insights.comparison.map((cycle) => (
                  <li key={cycle.start}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-muted">
                        {cycle.label}
                      </span>
                      <span className="display-sm whitespace-nowrap text-[18px] leading-none text-plum">
                        {cycle.length}{" "}
                        <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
                          gg
                        </span>
                      </span>
                    </div>
                    <div className="range-track mt-2">
                      <div
                        className="range-fill"
                        style={{
                          width: `${(cycle.length / maxCycle) * 100}%`,
                        }}
                      />
                    </div>
                    {cycle.periodLength ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div
                          className="range-track flex-1"
                          style={{ height: 3 }}
                        >
                          <div
                            className="range-fill-period"
                            style={{
                              width: `${Math.min(
                                100,
                                (cycle.periodLength / maxCycle) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] text-muted">
                          Mestruazioni {cycle.periodLength} gg
                        </span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[11px] leading-relaxed text-muted">
                Confronto degli ultimi {insights.comparison.length} cicli
                completati. La barra sottile indica i giorni di mestruazioni.
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Il tuo pattern</SectionTitle>
        <div className="insight-surface-rose p-6">
          {insights.patterns.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {insights.patterns.map((pattern) => (
                <li key={pattern.text} className="flex gap-3">
                  <IconLeaf className="mt-[3px] h-4 w-4 shrink-0 text-sage" />
                  <span className="flex flex-col gap-1">
                    <span className="display text-[16px] leading-relaxed text-plum-soft">
                      {pattern.text}
                    </span>
                    {pattern.evidence ? (
                      <span className="text-[12px] leading-relaxed text-muted">
                        {pattern.evidence}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="display text-[16px] leading-relaxed text-plum-soft">
              {PATTERN_EMPTY_MESSAGE}
            </p>
          )}
          {insights.patterns.length > 0 ? (
            <p className="mt-4 text-[12px] leading-relaxed text-muted">
              Osservazioni basate su {logCount} giornate registrate. Non sono
              indicazioni mediche.
            </p>
          ) : null}
        </div>
      </section>

      <p className="apple-note mt-8 flex items-center justify-center gap-1.5">
        <IconLock className="h-3.5 w-3.5" />
        I tuoi dati restano su questo dispositivo.
      </p>

      <section className="mt-6">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between px-1 py-2 text-[13px] text-muted"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          Impostazioni e dati
          <IconChevron
            className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-90" : ""}`}
          />
        </button>

        {settingsOpen ? (
          <Card className="mt-3 flex flex-col gap-5">
            <div>
              <p className="label-xs mb-2">Ciclo tipico</p>
              <Stepper
                value={data.settings.averageCycleLength}
                min={21}
                max={40}
                suffix="giorni"
                onChange={(value) =>
                  updateSettings({ averageCycleLength: value })
                }
              />
            </div>
            <div>
              <p className="label-xs mb-2">Mestruazioni tipiche</p>
              <Stepper
                value={data.settings.averagePeriodLength}
                min={2}
                max={9}
                suffix="giorni"
                onChange={(value) =>
                  updateSettings({ averagePeriodLength: value })
                }
              />
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Questi valori si usano solo finché non hai abbastanza storico.
              Dopo, Cycle segue i tuoi dati reali.
            </p>

            <div className="divider" />

            <div>
              <p className="label-xs mb-3">I tuoi dati</p>

              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 text-[14px] text-plum"
                onClick={handleExport}
              >
                <IconImport className="h-4 w-4 shrink-0" />
                Esporta i miei dati
              </button>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Un file JSON con registrazioni, umore, sintomi, energia, note,
                rapporti, spotting, test di ovulazione, muco cervicale e
                impostazioni.
              </p>

              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={handleBackupFile}
                aria-hidden
                tabIndex={-1}
              />
              <button
                type="button"
                className="mt-3 flex min-h-11 w-full items-center gap-2 text-[14px] text-plum"
                onClick={() => fileInput.current?.click()}
              >
                <IconUpload className="h-4 w-4 shrink-0" />
                Importa backup
              </button>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Controllo del file prima di importare. I giorni già presenti non
                vengono modificati: si aggiungono solo quelli mancanti.
              </p>

              {dataNotice ? (
                <p
                  role="status"
                  className={`mt-3 text-[12px] leading-relaxed ${
                    dataNotice.tone === "error"
                      ? "text-rose-deep"
                      : "text-sage"
                  }`}
                >
                  {dataNotice.text}
                </p>
              ) : null}
            </div>

            <div className="divider" />

            <div>
              <p className="label-xs mb-3">Storico</p>
              {historyImported ? (
                <>
                  <p className="flex items-center gap-2 text-[14px] text-plum-soft">
                    <IconCheck className="h-4 w-4 shrink-0 text-sage" />
                    Storico importato
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">
                    {importNotice ??
                      "I giorni di mestruazioni e i rapporti del tuo storico sono già sul dispositivo."}
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2 text-[14px] text-plum"
                    onClick={handleImportHistory}
                  >
                    <IconImport className="h-4 w-4 shrink-0" />
                    Importa storico
                  </button>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Importa il tuo storico precedente su questo dispositivo.
                  </p>
                </>
              )}
            </div>

            <div className="divider" />

            <div>
              <p className="label-xs mb-2">Privacy</p>
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                <IconLock className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                I tuoi dati restano su questo dispositivo.
              </p>
            </div>

            <div className="divider" />

            <div>
              <p className="label-xs mb-2">Riparti da zero</p>
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 text-[14px] text-rose-deep"
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancellare tutti i dati dell'app? Registrazioni e ciclo riportato verranno eliminati. L'operazione non si può annullare."
                    )
                  ) {
                    resetAll();
                  }
                }}
              >
                <IconTrash className="h-4 w-4" />
                Resetta dati
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                Elimina solo i dati salvati su questo dispositivo.
                L&apos;operazione non si può annullare.
              </p>
            </div>
          </Card>
        ) : null}
      </section>
    </Screen>
  );
}
