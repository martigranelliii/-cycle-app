"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  buildBackup,
  backupFilename,
  parseBackup,
  mergeBackup,
} from "@/lib/backup";
import type { CycleData } from "@/types";
import { Card, PrimaryButton, Stepper } from "./ui";
export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BackupImport() {
  const { data, restoreBackup, error } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<CycleData | null>(null);
  const [notice, setNotice] = useState("");
  const preview = incoming ? mergeBackup(data, incoming).report : null;
  function restore(prefer = false) {
    if (!incoming) return;
    const r = restoreBackup(incoming, prefer);
    if (r.ok) {
      setNotice(
        `${r.added} giornate aggiunte. ${r.conflicts} conflitti conservati nel backup esportabile.${r.adoptedProfile ? " Profilo ripristinato." : ""}`,
      );
      setIncoming(null);
    }
  }
  return (
    <div className="space-y-3">
      <input
        aria-label="File di backup Cycle"
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 10_000_000) {
              setNotice(
                "Il file è troppo grande. Scegli un backup Cycle più piccolo.",
              );
              return;
            }
            const p = parseBackup(await file.text());
            if (!p.ok) {
              setNotice(p.error);
              return;
            }
            setIncoming(p.data);
            setNotice("");
          } catch {
            setNotice("Non riesco a leggere questo file. Riprova.");
          }
        }}
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => input.current?.click()}
      >
        Ripristina da backup
      </button>
      {incoming && preview ? (
        <Card className="space-y-3">
          <p className="text-sm">
            {preview.added} giornate da aggiungere, {preview.conflicts} giornate
            con versioni diverse. Le versioni alternative restano conservate e
            incluse nell’export.
          </p>
          <PrimaryButton onClick={() => restore(false)}>
            Importa mantenendo i dati locali
          </PrimaryButton>
          {Object.keys(data.logs).length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (
                  window.confirm(
                    "Usare il profilo e le giornate del backup nei conflitti? Le versioni locali saranno conservate nell’export.",
                  )
                )
                  restore(true);
              }}
            >
              Usa le versioni del backup
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setIncoming(null)}
          >
            Annulla importazione
          </button>
        </Card>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function DataSettings({ onClose }: { onClose: () => void }) {
  const { data, updateSettings, updateProfile, resetAll, error, today } =
    useStore();
  const [start, setStart] = useState(data.onboarding.lastPeriodStart ?? "");
  const [notice, setNotice] = useState("");
  const conflicts = Object.values(data.backupConflicts ?? {}).reduce(
    (n, v) => n + v.length,
    0,
  );
  return (
    <div className="mx-auto max-w-[430px] px-6 pb-28 pt-6">
      <header className="flex items-center justify-between gap-3">
        <h1 tabIndex={-1} className="display text-3xl">
          Impostazioni e dati
        </h1>
        <button className="btn btn-quiet !w-auto" onClick={onClose}>
          Chiudi
        </button>
      </header>
      <div className="mt-6 space-y-6">
        <Card className="space-y-4">
          <h2 className="display-sm text-xl">Informazioni iniziali</h2>
          <label className="block text-sm" htmlFor="initial-start">
            Ultimo inizio riportato nell’onboarding
          </label>
          <input
            id="initial-start"
            type="date"
            max={today}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-line p-3"
          />
          <p className="text-sm text-muted">
            Corregge la data iniziale. I giorni già registrati si modificano dal
            calendario.
          </p>
          <PrimaryButton
            disabled={Boolean(start && start > today)}
            onClick={() => {
              if (updateProfile(start || null).ok)
                setNotice("Data iniziale aggiornata.");
            }}
          >
            Salva data iniziale
          </PrimaryButton>
          <p id="cycle-setting" className="text-sm">
            Durata di partenza del ciclo
          </p>
          <Stepper
            label="Durata di partenza del ciclo"
            value={data.settings.averageCycleLength}
            min={15}
            max={90}
            suffix="giorni"
            onChange={(v) => updateSettings({ averageCycleLength: v })}
          />
          <p className="text-sm">Durata di partenza delle mestruazioni</p>
          <Stepper
            label="Durata di partenza delle mestruazioni"
            value={data.settings.averagePeriodLength}
            min={1}
            max={15}
            suffix="giorni"
            onChange={(v) => updateSettings({ averagePeriodLength: v })}
          />
          <p className="text-sm text-muted">
            Valori di contesto finché lo storico non basta. Non rendono certe le
            previsioni.
          </p>
        </Card>
        <Card className="space-y-4">
          <h2 className="display-sm text-xl">I tuoi dati</h2>
          <button
            className="btn btn-ghost"
            onClick={() =>
              downloadText(
                JSON.stringify(buildBackup(data), null, 2),
                backupFilename(),
              )
            }
          >
            Esporta i miei dati
          </button>
          <p className="text-sm text-muted">
            Il file contiene dati intimi in chiaro. Conservalo in un luogo
            privato. Include anche {conflicts} versioni alternative da
            importazioni.
          </p>
          <BackupImport />
        </Card>
        <Card className="space-y-3">
          <h2 className="display-sm text-xl">Privacy</h2>
          <p className="text-sm text-muted">
            Nessun account o analytics. Registrazioni su questo browser, senza
            cifratura applicativa. Cancellare i dati del browser può rimuoverle:
            un backup ti permette di recuperarle.
          </p>
          <button
            className="btn btn-ghost text-rose-deep"
            onClick={() => {
              if (
                window.confirm(
                  "Cancellare tutti i dati locali e le bozze? Esporta prima un backup se vuoi conservarli. I file già esportati non saranno cancellati.",
                )
              ) {
                if (resetAll().ok) onClose();
              }
            }}
          >
            Cancella dati locali
          </button>
        </Card>
        {notice ? <p role="status">{notice}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
