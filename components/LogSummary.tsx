import type { ReactNode } from "react";
import type { DailyLog } from "@/types";
import {
  ENERGY_LABELS,
  MOODS,
  SYMPTOMS,
  cervicalMucusLabel,
  flowLabel,
  labelFor,
  ovulationTestLabel,
  sexualActivityLabel,
} from "@/lib/labels";
import { IconHeart } from "./icons";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase leading-none tracking-[0.14em] text-muted">
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-plum">{children}</div>
    </div>
  );
}

function EnergyDots({ energy }: { energy: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex items-center gap-[5px]">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="h-[9px] w-[9px] rounded-full"
            style={{
              background: step <= energy ? "var(--sage)" : "var(--line)",
            }}
          />
        ))}
      </span>
      <span className="text-[13px] text-muted">{ENERGY_LABELS[energy]}</span>
    </span>
  );
}

export function LogSummary({ log }: { log: DailyLog }) {
  const moods = log.moods.map((id) => labelFor(MOODS, id)).join(" · ");
  const symptoms = log.symptoms.map((id) => labelFor(SYMPTOMS, id)).join(" · ");
  const note = log.notes.trim();

  const hasDetail =
    log.moods.length > 0 ||
    log.symptoms.length > 0 ||
    log.energy !== null ||
    log.periodFlow !== "none" ||
    log.flowRecorded === true ||
    log.symptomsRecorded === true ||
    Boolean(log.spotting) ||
    Boolean(log.ovulationTest) ||
    Boolean(log.cervicalMucus) ||
    log.sexualActivity !== undefined ||
    note.length > 0;

  if (!hasDetail) {
    return (
      <p className="text-[14px] leading-relaxed text-muted">
        Nessun dettaglio registrato per questo giorno.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {log.periodFlow !== "none" || log.flowRecorded ? (
        <Row label="Flusso">
          {log.periodFlow === "recorded" ? (
            <span className="text-plum-soft">{flowLabel(log.periodFlow)}</span>
          ) : (
            flowLabel(log.periodFlow)
          )}
        </Row>
      ) : null}

      {log.spotting ? (
        <Row label="Spotting">
          <span className="flex flex-col gap-0.5">
            <span>Sì</span>
            <span className="text-[12px] text-muted">
              Non conta come mestruazioni e non fa iniziare un nuovo ciclo.
            </span>
          </span>
        </Row>
      ) : null}

      {log.moods.length > 0 ? (
        <Row label="Umore">
          <span className="display-sm text-[16px]">{moods}</span>
        </Row>
      ) : null}

      {log.symptoms.length > 0 || log.symptomsRecorded ? (
        <Row label="Sintomi">
          <span className="display-sm text-[16px]">
            {symptoms || "Nessun sintomo"}
          </span>
        </Row>
      ) : null}

      {log.energy !== null ? (
        <Row label="Energia">
          <EnergyDots energy={log.energy} />
        </Row>
      ) : null}

      {log.ovulationTest ? (
        <Row label="Test ovulazione">
          <span className="flex flex-col gap-0.5">
            <span>{ovulationTestLabel(log.ovulationTest)}</span>
            {log.ovulationTest === "positive" ? (
              <span className="text-[12px] text-muted">
                Segnale osservato: non conferma il giorno esatto
                dell&apos;ovulazione.
              </span>
            ) : null}
          </span>
        </Row>
      ) : null}

      {log.cervicalMucus ? (
        <Row label="Muco cervicale">
          {cervicalMucusLabel(log.cervicalMucus)}
        </Row>
      ) : null}

      {log.sexualActivity !== undefined ? (
        <Row label="Rapporti">
          {log.sexualActivity === "protected" ||
          log.sexualActivity === "unprotected" ? (
            <span className="flex items-center gap-1.5 text-[14px] text-rose-deep">
              <IconHeart className="h-3.5 w-3.5" />
              {sexualActivityLabel(log.sexualActivity)}
            </span>
          ) : log.sexualActivity === "recorded" ? (
            <span className="flex items-center gap-1.5 text-[14px] text-muted">
              <IconHeart className="h-3.5 w-3.5" />
              {sexualActivityLabel(log.sexualActivity)}
            </span>
          ) : (
            <span className="text-[14px] text-muted">
              {sexualActivityLabel(log.sexualActivity)}
            </span>
          )}
        </Row>
      ) : null}

      {note.length > 0 ? (
        <Row label="Note">
          <span className="display-sm text-[15px] italic leading-relaxed text-plum-soft">
            “{note}”
          </span>
        </Row>
      ) : null}
    </div>
  );
}
