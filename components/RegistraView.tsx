"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CervicalMucus,
  DailyLog,
  MoodId,
  OvulationTestResult,
  PeriodFlow,
  SexualActivity,
  SymptomId,
} from "@/types";
import {
  CERVICAL_MUCUS_OPTIONS,
  ENERGY_LABELS,
  FLOWS,
  MOODS,
  OVULATION_TESTS,
  PRIMARY_SYMPTOMS,
  SECONDARY_SYMPTOMS,
  SEXUAL_ACTIVITIES,
  SYMPTOMS,
} from "@/lib/labels";
import { useStore } from "@/lib/store";
import { formatWithWeekday } from "@/lib/dates";
import { Card, Chip, ChipRow, PrimaryButton, Screen, SectionTitle } from "./ui";
import { IconCheck, IconTrash } from "./icons";

type Draft = Omit<DailyLog, "date" | "createdAt" | "updatedAt">;

function initialDraft(log: DailyLog | null): Draft {
  return {
    periodFlow: log?.periodFlow ?? "none",
    moods: log?.moods ?? [],
    symptoms: log?.symptoms ?? [],
    energy: log?.energy ?? null,
    notes: log?.notes ?? "",
    sexualActivity: log?.sexualActivity,
    spotting: log?.spotting ?? false,
    ovulationTest: log?.ovulationTest,
    cervicalMucus: log?.cervicalMucus,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function symptoms(ids: SymptomId[]) {
  return SYMPTOMS.filter((symptom) => ids.includes(symptom.id));
}

export function RegistraView({
  date,
  onDone,
  onPickDate,
}: {
  date: string;
  onDone: () => void;
  onPickDate?: (date: string) => void;
}) {
  const { data, saveLog, deleteLog, today } = useStore();
  const existing = data.logs[date] ?? null;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(existing));
  const [saved, setSaved] = useState(false);
  const [moreSymptoms, setMoreSymptoms] = useState(() =>
    Boolean(existing?.symptoms.some((id) => SECONDARY_SYMPTOMS.includes(id)))
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleSave() {
    saveLog(date, {
      ...draft,
      // Never persist an explicit `false`: absence already means "not recorded".
      spotting: draft.spotting ? true : undefined,
    });
    setSaved(true);
    timer.current = setTimeout(onDone, 900);
  }

  if (saved) {
    return (
      <Screen className="pb-32">
        <div className="flex min-h-[60svh] flex-col items-center justify-center text-center">
          <span className="save-check flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-plum">
            <IconCheck className="h-7 w-7" />
          </span>
          <p className="display mt-6 text-[26px]">Giornata salvata</p>
          <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-muted">
            La stima del prossimo ciclo si aggiorna con quello che registri.
          </p>
        </div>
      </Screen>
    );
  }

  const sexualHint = SEXUAL_ACTIVITIES.find(
    (option) => option.id === draft.sexualActivity
  )?.hint;

  return (
    <Screen className="pb-40">
      <header className="mb-7">
        <h1 className="display text-[32px] leading-tight">
          {existing
            ? "Modifica la giornata"
            : date === today
              ? "Come stai oggi?"
              : "Com'era quel giorno?"}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {formatWithWeekday(date)}
        </p>
        {date !== today && onPickDate ? (
          <button
            type="button"
            className="mt-3 min-h-11 text-[13px] text-muted underline decoration-[rgba(53,24,42,0.28)] underline-offset-4"
            onClick={() => onPickDate(today)}
          >
            Registra oggi
          </button>
        ) : null}
      </header>

      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>Flusso</SectionTitle>
          <Card className="p-4">
            {draft.periodFlow === "recorded" ? (
              <div className="mb-3 flex">
                <span className="chip chip-recorded" aria-label="Intensità non indicata">
                  Intensità non indicata
                </span>
              </div>
            ) : null}
            <ChipRow>
              {FLOWS.map((flow) => (
                <Chip
                  key={flow.id}
                  selected={draft.periodFlow === flow.id}
                  onClick={() =>
                    update({ periodFlow: flow.id as PeriodFlow })
                  }
                >
                  {flow.label}
                </Chip>
              ))}
            </ChipRow>
            {draft.periodFlow === "recorded" ? (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Giorno mestruale dello storico importato: l&apos;intensità non
                era indicata. Scegli un livello solo se lo ricordi.
              </p>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Leggero, medio o abbondante: sono i giorni che contano come
                mestruazioni.
              </p>
            )}
            <div className="divider mt-4" />
            <div className="pt-4">
              <ChipRow>
                <Chip
                  tone="soft"
                  selected={Boolean(draft.spotting)}
                  onClick={() => update({ spotting: !draft.spotting })}
                >
                  Spotting
                </Chip>
              </ChipRow>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                Separato dalle mestruazioni: lo spotting non fa iniziare un
                nuovo ciclo.
              </p>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>Umore</SectionTitle>
          <Card className="p-4">
            <ChipRow>
              {MOODS.map((mood) => (
                <Chip
                  key={mood.id}
                  tone="soft"
                  selected={draft.moods.includes(mood.id)}
                  onClick={() =>
                    update({ moods: toggle<MoodId>(draft.moods, mood.id) })
                  }
                >
                  {mood.label}
                </Chip>
              ))}
            </ChipRow>
          </Card>
        </section>

        <section>
          <SectionTitle>Sintomi</SectionTitle>
          <Card className="p-4">
            <ChipRow>
              {symptoms(PRIMARY_SYMPTOMS).map((symptom) => (
                <Chip
                  key={symptom.id}
                  tone="soft"
                  selected={draft.symptoms.includes(symptom.id)}
                  onClick={() =>
                    update({
                      symptoms: toggle<SymptomId>(draft.symptoms, symptom.id),
                    })
                  }
                >
                  {symptom.label}
                </Chip>
              ))}
            </ChipRow>

            <button
              type="button"
              aria-expanded={moreSymptoms}
              className="mt-3 min-h-11 text-[13px] text-muted underline decoration-[rgba(53,24,42,0.24)] underline-offset-4"
              onClick={() => setMoreSymptoms((open) => !open)}
            >
              {moreSymptoms ? "Meno segnali" : "Altri segnali"}
            </button>

            {moreSymptoms ? (
              <div className="mt-3 flex flex-col gap-2">
                <p className="label-xs">Appetito, sonno e altro</p>
                <ChipRow>
                  {symptoms(SECONDARY_SYMPTOMS).map((symptom) => (
                    <Chip
                      key={symptom.id}
                      tone="soft"
                      selected={draft.symptoms.includes(symptom.id)}
                      onClick={() =>
                        update({
                          symptoms: toggle<SymptomId>(
                            draft.symptoms,
                            symptom.id
                          ),
                        })
                      }
                    >
                      {symptom.label}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
            ) : null}
          </Card>
        </section>

        <section>
          <SectionTitle>Energia</SectionTitle>
          <Card className="p-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => {
                const selected = draft.energy === level;
                return (
                  <button
                    key={level}
                    type="button"
                    aria-label={`Energia ${level} — ${ENERGY_LABELS[level]}`}
                    aria-pressed={selected}
                    onClick={() =>
                      update({ energy: selected ? null : level })
                    }
                    className="flex-1 rounded-2xl border py-3 text-[15px] transition-colors"
                    style={{
                      background: selected
                        ? "var(--grad-primary)"
                        : "var(--surface)",
                      borderColor: selected ? "var(--plum)" : "var(--line)",
                      color: selected ? "#fdf7f2" : "var(--plum)",
                    }}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[12px] text-muted">
              {draft.energy ? ENERGY_LABELS[draft.energy] : "Da 1 a 5, se vuoi."}
            </p>
          </Card>
        </section>

        <section>
          <SectionTitle>Segnali facoltativi</SectionTitle>
          <Card className="p-4">
            <p className="label-xs mb-2">Test ovulazione</p>
            <ChipRow>
              {OVULATION_TESTS.map((option) => {
                const selected =
                  (draft.ovulationTest ?? "not-done") === option.id;
                return (
                  <Chip
                    key={option.id}
                    tone="soft"
                    selected={selected}
                    onClick={() =>
                      update({
                        ovulationTest:
                          option.id === "not-done"
                            ? undefined
                            : (option.id as OvulationTestResult),
                      })
                    }
                  >
                    {option.label}
                  </Chip>
                );
              })}
            </ChipRow>
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              Un test positivo è un&apos;osservazione: non conferma il giorno
              esatto dell&apos;ovulazione.
            </p>

            <div className="divider my-4" />

            <p className="label-xs mb-2">Muco cervicale</p>
            <ChipRow>
              <Chip
                tone="soft"
                selected={!draft.cervicalMucus}
                onClick={() => update({ cervicalMucus: undefined })}
              >
                Non registrato
              </Chip>
              {CERVICAL_MUCUS_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  tone="soft"
                  selected={draft.cervicalMucus === option.id}
                  onClick={() =>
                    update({ cervicalMucus: option.id as CervicalMucus })
                  }
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              Facoltativo. Cycle lo mostra come contesto, senza conclusioni
              mediche.
            </p>
          </Card>
        </section>

        <section>
          <SectionTitle>Rapporti</SectionTitle>
          <Card className="p-4">
            <ChipRow>
              {SEXUAL_ACTIVITIES.map((option) => {
                const selected = draft.sexualActivity === option.id;
                return (
                  <Chip
                    key={option.id}
                    tone="soft"
                    selected={selected}
                    onClick={() =>
                      update({
                        sexualActivity: selected
                          ? undefined
                          : (option.id as SexualActivity),
                      })
                    }
                  >
                    {option.label}
                  </Chip>
                );
              })}
            </ChipRow>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {sexualHint ??
                "Solo per te e solo su questo dispositivo. Cycle non calcola la fertilità e non dà indicazioni di alcun tipo."}
            </p>
          </Card>
        </section>

        <section className="scroll-mt-44">
          <SectionTitle>Note</SectionTitle>
          <Card className="p-4">
            <textarea
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
              onFocus={(event) => {
                const target = event.currentTarget;
                window.setTimeout(
                  () => target.scrollIntoView({ block: "center" }),
                  250
                );
              }}
              rows={3}
              maxLength={600}
              placeholder="Due righe per te, se ti va."
              className="w-full bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted"
            />
          </Card>
        </section>

        {existing ? (
          <button
            type="button"
            className="mx-auto flex min-h-11 items-center gap-2 px-4 text-[13px] text-muted"
            onClick={() => {
              if (
                window.confirm(
                  "Eliminare la registrazione di questo giorno? L'operazione non si può annullare."
                )
              ) {
                deleteLog(date);
                onDone();
              }
            }}
          >
            <IconTrash className="h-4 w-4" />
            Elimina registrazione
          </button>
        ) : null}
      </div>

      <div
        className="sticky z-10 -mx-6 mt-8 border-t border-line-light bg-bg/95 px-6 pt-4 pb-2 backdrop-blur-sm"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}
      >
        <PrimaryButton onClick={handleSave}>Salva giornata</PrimaryButton>
        <p className="apple-note mt-3">
          Le stime si aggiornano in base ai giorni che registri.
        </p>
      </div>
    </Screen>
  );
}
