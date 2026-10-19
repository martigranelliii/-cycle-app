import type {
  CervicalMucus,
  MoodId,
  OvulationTestResult,
  PeriodFlow,
  PhaseId,
  SexualActivity,
  SymptomId,
} from "@/types";

/** User-facing flow choices in Registra. */
export const FLOWS: { id: PeriodFlow; label: string }[] = [
  { id: "none", label: "Nessuno" },
  { id: "light", label: "Leggero" },
  { id: "medium", label: "Medio" },
  { id: "heavy", label: "Abbondante" },
];

/** Every `PeriodFlow` that may be stored, including imported ones. */
export const PERIOD_FLOW_IDS: PeriodFlow[] = [
  "none",
  "recorded",
  "light",
  "medium",
  "heavy",
];

/** Every stored sexual-activity value, including the historical `recorded`. */
export const SEXUAL_ACTIVITY_IDS: SexualActivity[] = [
  "none",
  "recorded",
  "protected",
  "unprotected",
];

/**
 * User-facing choices for the discreet "Rapporti" section.
 * `recorded` is shown as "Non specificato": historical imports know only that
 * activity happened, never whether it was protected.
 */
export const SEXUAL_ACTIVITIES: {
  id: SexualActivity;
  label: string;
  hint?: string;
}[] = [
  { id: "none", label: "Nessuno" },
  { id: "protected", label: "Protetto" },
  { id: "unprotected", label: "Non protetto" },
  {
    id: "recorded",
    label: "Non specificato",
    hint: "Per i dati dello storico: rapporto registrato, senza dettaglio.",
  },
];

/** Optional LH test choices. `not-done` clears the stored value. */
export const OVULATION_TESTS: {
  id: OvulationTestResult | "not-done";
  label: string;
}[] = [
  { id: "not-done", label: "Non fatto" },
  { id: "negative", label: "Negativo" },
  { id: "positive", label: "Positivo" },
];

export const CERVICAL_MUCUS_OPTIONS: {
  id: CervicalMucus;
  label: string;
}[] = [
  { id: "dry", label: "Secco" },
  { id: "creamy", label: "Cremoso" },
  { id: "watery", label: "Acquoso" },
  { id: "egg-white", label: "Tipo albume" },
];

export const CERVICAL_MUCUS_IDS: CervicalMucus[] =
  CERVICAL_MUCUS_OPTIONS.map((option) => option.id);

export const MOODS: { id: MoodId; label: string }[] = [
  { id: "serena", label: "Serena" },
  { id: "felice", label: "Felice" },
  { id: "energica", label: "Energica" },
  { id: "sensibile", label: "Sensibile" },
  { id: "irritabile", label: "Irritabile" },
  { id: "triste", label: "Triste" },
  { id: "ansiosa", label: "Ansiosa" },
  { id: "stressata", label: "Stressata" },
];

export const SYMPTOMS: { id: SymptomId; label: string }[] = [
  { id: "crampi", label: "Crampi" },
  { id: "gonfiore", label: "Gonfiore" },
  { id: "mal-di-testa", label: "Mal di testa" },
  { id: "mal-di-schiena", label: "Mal di schiena" },
  { id: "seno-sensibile", label: "Seno sensibile" },
  { id: "acne", label: "Acne" },
  { id: "nausea", label: "Nausea" },
  { id: "voglie", label: "Voglie" },
  { id: "fame", label: "Fame" },
  { id: "libido", label: "Libido" },
  { id: "stanchezza", label: "Stanchezza" },
  { id: "sonno-disturbato", label: "Sonno disturbato" },
];

/**
 * The daily log stays fast: the body signals most people reach for are always
 * visible, while appetite/sleep/other stay one tap away.
 */
export const PRIMARY_SYMPTOMS: SymptomId[] = [
  "crampi",
  "gonfiore",
  "mal-di-testa",
  "mal-di-schiena",
  "seno-sensibile",
  "acne",
  "nausea",
  "stanchezza",
];

export const SECONDARY_SYMPTOMS: SymptomId[] = [
  "voglie",
  "fame",
  "libido",
  "sonno-disturbato",
];

export const PHASES: Record<
  PhaseId,
  { label: string; hint: string }
> = {
  mestruale: { label: "Mestruale", hint: "Rallenta e ascoltati." },
  follicolare: { label: "Follicolare", hint: "L'energia risale." },
  ovulatoria: { label: "Ovulatoria", hint: "Giorni più pieni." },
  luteale: { label: "Luteale", hint: "Ritmo un po' più lento." },
};

export const ENERGY_LABELS: Record<number, string> = {
  1: "Molto bassa",
  2: "Bassa",
  3: "Nella media",
  4: "Buona",
  5: "Alta",
};

export function labelFor<T extends string>(
  list: { id: T; label: string }[],
  id: T
): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function flowLabel(flow: PeriodFlow): string {
  if (flow === "recorded") return "Intensità non indicata";
  return labelFor(FLOWS, flow);
}

export function sexualActivityLabel(activity: SexualActivity): string {
  if (activity === "recorded") return "Rapporto registrato";
  if (activity === "protected") return "Protetto";
  if (activity === "unprotected") return "Non protetto";
  return "Nessuno";
}

/** True when something was recorded, including the historical `recorded`. */
export function hasSexualActivity(
  activity: SexualActivity | undefined
): boolean {
  return activity !== undefined && activity !== "none";
}

export function ovulationTestLabel(result: OvulationTestResult): string {
  return result === "positive" ? "Positivo" : "Negativo";
}

export function cervicalMucusLabel(mucus: CervicalMucus): string {
  return labelFor(CERVICAL_MUCUS_OPTIONS, mucus);
}
