import type {
  DailyLog,
  MoodId,
  PeriodFlow,
  PhaseId,
  SymptomId,
} from "@/types";

/**
 * Deterministic, local-only wellness suggestions.
 *
 * Priority, from strongest to weakest:
 *   1. what the person logged TODAY (energy, symptoms, mood, flow, spotting)
 *   2. what tends to repeat in her own recent logs
 *   3. the estimated cycle phase
 *   4. a gentle generic default
 *
 * The suggestions are ideas, not treatments: no supplements, no hormone
 * claims, no cycle regulation, no fertility promises.
 */

export type WellnessBasis = "today" | "history" | "phase" | "default";

export interface WellnessSuggestion {
  text: string;
}

export interface DailyWellness {
  eat: WellnessSuggestion;
  move: WellnessSuggestion;
  care: WellnessSuggestion;
  basis: WellnessBasis;
}

export interface WellnessInput {
  phase: PhaseId | null;
  cycleDay: number | null;
  averageCycleLength: number;
  energy: number | null;
  symptoms: SymptomId[];
  moods: MoodId[];
  periodFlow: PeriodFlow;
  spotting: boolean;
  recentLogs: DailyLog[];
  hasLogToday: boolean;
}

/** Symptoms that make intense movement a bad idea for today. */
const LIMITING_SYMPTOMS: SymptomId[] = [
  "crampi",
  "mal-di-testa",
  "nausea",
  "stanchezza",
  "mal-di-schiena",
  "sonno-disturbato",
];

const GENTLE_MOVE =
  "Se ti va di muoverti, prova una passeggiata tranquilla o qualche minuto di stretching.";
const MODERATE_MOVE =
  "Se ti va, una passeggiata o un po' di mobilità dolce sono più che sufficienti.";
const ACTIVE_MOVE =
  "Se oggi ti senti bene, una camminata svelta, una bici o una sessione leggera di forza sono un'idea.";

function historyHas(logs: DailyLog[], test: (log: DailyLog) => boolean): boolean {
  return logs.filter(test).length >= 3;
}

export function getDailyWellnessSuggestions(
  input: WellnessInput
): DailyWellness {
  const bleeding = input.periodFlow !== "none";
  const lowEnergy = input.energy !== null && input.energy <= 2;
  const highEnergy = input.energy !== null && input.energy >= 4;
  const limiting = input.symptoms.some((symptom) =>
    LIMITING_SYMPTOMS.includes(symptom)
  );
  const stressed = input.moods.some(
    (mood) => mood === "stressata" || mood === "ansiosa"
  );
  const cravings = input.symptoms.includes("voglie") || input.symptoms.includes("fame");

  const recent = input.recentLogs.slice(-30);
  const lowEnergyHistory = historyHas(
    recent,
    (log) => log.energy !== null && log.energy <= 2
  );
  const cravingHistory = historyHas(recent, (log) =>
    log.symptoms.includes("voglie")
  );
  const crampsHistory = historyHas(recent, (log) =>
    log.symptoms.includes("crampi")
  );

  const phase = input.phase;

  /* ------------------------------- movement ------------------------------- */

  let move: WellnessSuggestion;
  if (input.hasLogToday && (lowEnergy || limiting)) {
    move = { text: GENTLE_MOVE };
  } else if (input.hasLogToday && highEnergy && !limiting && !bleeding) {
    move = { text: ACTIVE_MOVE };
  } else if (input.hasLogToday) {
    move = { text: MODERATE_MOVE };
  } else if (phase === "mestruale" || crampsHistory) {
    move = { text: GENTLE_MOVE };
  } else {
    move = { text: MODERATE_MOVE };
  }

  /* --------------------------------- food --------------------------------- */

  let eat: WellnessSuggestion;
  if (input.hasLogToday && input.symptoms.includes("nausea")) {
    eat = {
      text: "Qualcosa di semplice e idratante: acqua, frutta o una zuppa leggera, se ti va.",
    };
  } else if (input.hasLogToday && bleeding) {
    eat = {
      text: "Un pasto semplice con ferro (legumi, verdure a foglia verde, cereali integrali) e una fonte di vitamina C, se ti va.",
    };
  } else if (input.hasLogToday && (cravings || lowEnergy)) {
    eat = {
      text: "Una merenda con frutta, yogurt o una manciata di frutta secca può essere una buona idea oggi.",
    };
  } else if (input.hasLogToday && highEnergy) {
    eat = {
      text: "Un piatto colorato con proteine, verdure e cereali integrali: semplice e completo.",
    };
  } else if (cravingHistory) {
    eat = {
      text: "Nel tuo storico le voglie tornano ogni tanto: tieni a portata di mano frutta, yogurt o frutta secca.",
    };
  } else if (phase === "mestruale") {
    eat = {
      text: "Un pasto caldo e semplice, con legumi o verdure e una fonte di vitamina C, se ti va.",
    };
  } else if (phase === "luteale") {
    eat = {
      text: "Una zuppa di legumi, cereali integrali o verdure: caldo, semplice e saziante.",
    };
  } else if (phase === "follicolare" || phase === "ovulatoria") {
    eat = {
      text: "Un piatto colorato con proteine, verdure e cereali integrali; frutta o yogurt come pausa.",
    };
  } else {
    eat = {
      text: "Un pasto equilibrato con proteine, verdure e cereali integrali, e acqua durante il giorno.",
    };
  }

  /* ------------------------------- self-care ------------------------------ */

  let care: WellnessSuggestion;
  if (limiting || lowEnergy) {
    care = {
      text: "Concediti una pausa: una doccia calda, respiro lento e acqua. Se puoi, oggi riduci il ritmo.",
    };
  } else if (stressed) {
    care = {
      text: "Cinque minuti senza schermo, qualche respiro lento o due chiacchiere con qualcuno di cui ti fidi.",
    };
  } else if (bleeding) {
    care = {
      text: "Prepara ciò che ti fa stare comoda: acqua, calore, riposo. Oggi va bene andare piano.",
    };
  } else if (input.spotting) {
    care = {
      text: "Un po' di attenzione in più: idratazione, riposo e nessuna fretta di capire quello che senti.",
    };
  } else if (phase === "luteale") {
    care = {
      text: "Una routine serale semplice e un po' di tempo all'aperto, se ti va.",
    };
  } else if (lowEnergyHistory) {
    care = {
      text: "Se ti senti stanca, una giornata più leggera non è un passo indietro.",
    };
  } else {
    care = {
      text: "Cinque minuti per te: acqua, respiro, una passeggiata o una chiacchiera.",
    };
  }

  let basis: WellnessBasis = "default";
  if (input.hasLogToday) basis = "today";
  else if (lowEnergyHistory || cravingHistory || crampsHistory) basis = "history";
  else if (phase) basis = "phase";

  return { eat, move, care, basis };
}
