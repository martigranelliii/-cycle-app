"use client";

import { useState } from "react";
import type { Onboarding as OnboardingData } from "@/types";
import { useStore } from "@/lib/store";
import { PrimaryButton, Stepper } from "./ui";

function Wordmark() {
  return (
    <div className="text-center">
      <h1 className="display text-[46px] leading-none tracking-[-0.03em]">
        Cycle
      </h1>
      <p className="mt-3 text-[15px] italic text-rose-deep">
        Il tuo ciclo, con calma
      </p>
    </div>
  );
}

export function Onboarding() {
  const { finishOnboarding, today } = useStore();
  const [step, setStep] = useState(0);
  const [lastPeriodStart, setLastPeriodStart] = useState<string | null>(null);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [unknownLengths, setUnknownLengths] = useState(false);

  function finish() {
    const data: OnboardingData = {
      completed: true,
      lastPeriodStart,
      cycleLength: unknownLengths ? null : cycleLength,
      periodLength: unknownLengths ? null : periodLength,
    };
    finishOnboarding(data);
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col px-6 pt-16 pb-10">
      <div className="flex-1">
        {step === 0 ? (
          <div className="flex min-h-[72svh] flex-col justify-between">
            <div className="pt-20">
              <Wordmark />
              <p className="mt-6 text-center text-[15px] leading-relaxed text-plum-soft">
                Un diario intimo e semplice per capire dove sei nel tuo ciclo,
                come ti senti e quando aspettarti il prossimo.
              </p>
              <p className="mt-4 text-center text-xs text-muted">
                Nessun account. Tutto resta su questo dispositivo.
              </p>
            </div>
            <PrimaryButton onClick={() => setStep(1)}>Iniziamo</PrimaryButton>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex min-h-[72svh] flex-col justify-between">
            <div>
              <h2 className="display text-[30px] leading-tight">
                Quando è iniziato
                <br />
                il tuo ultimo ciclo?
              </h2>
              <div className="mt-4 flex items-center gap-2.5">
                <span className="flex gap-1">
                  <span className="h-1.5 w-6 rounded-full bg-rose" />
                  <span className="h-1.5 w-6 rounded-full bg-line" />
                </span>
                <span className="label-xs">Passo 1 di 2</span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">
                Serve solo per iniziare. Puoi cambiarla quando vuoi.
              </p>
              <input
                type="date"
                max={today}
                value={lastPeriodStart ?? ""}
                onChange={(event) =>
                  setLastPeriodStart(event.target.value || null)
                }
                className="mt-8 w-full rounded-2xl border border-line bg-surface px-4 py-4 text-[17px] outline-none focus:border-rose"
              />
            </div>
            <div className="flex flex-col gap-3">
              <PrimaryButton disabled={!lastPeriodStart} onClick={() => setStep(2)}>
                Continua
              </PrimaryButton>
              <button
                type="button"
                className="btn btn-quiet w-full"
                onClick={() => {
                  setLastPeriodStart(null);
                  setStep(2);
                }}
              >
                Non lo so
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex min-h-[72svh] flex-col justify-between">
            <div>
              <h2 className="display text-[30px] leading-tight">
                Quanto durano
                <br />
                di solito?
              </h2>
              <div className="mt-4 flex items-center gap-2.5">
                <span className="flex gap-1">
                  <span className="h-1.5 w-6 rounded-full bg-rose" />
                  <span className="h-1.5 w-6 rounded-full bg-rose" />
                </span>
                <span className="label-xs">Passo 2 di 2</span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">
                Valori di partenza per le stime. Diventeranno precisi con il
                tuo storico.
              </p>

              <div className={`mt-8 flex flex-col gap-5 ${unknownLengths ? "opacity-40" : ""}`}>
                <div>
                  <p className="label-xs mb-2">Ciclo</p>
                  <Stepper
                    value={cycleLength}
                    min={21}
                    max={40}
                    suffix="giorni"
                    onChange={setCycleLength}
                  />
                </div>
                <div>
                  <p className="label-xs mb-2">Mestruazioni</p>
                  <Stepper
                    value={periodLength}
                    min={2}
                    max={9}
                    suffix="giorni"
                    onChange={setPeriodLength}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <PrimaryButton onClick={finish}>Inizia a usare Cycle</PrimaryButton>
              <button
                type="button"
                className="btn btn-quiet w-full"
                onClick={() => {
                  setUnknownLengths(true);
                  finishOnboarding({
                    completed: true,
                    lastPeriodStart,
                    cycleLength: null,
                    periodLength: null,
                  });
                }}
              >
                Non lo so, usa dei valori iniziali
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
