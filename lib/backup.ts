import type { CycleData, DailyLog } from "@/types";
import { isValidKey } from "./dates";
import { sanitizeData } from "./storage";

/**
 * Local backup, nothing else.
 *
 * Export writes a single JSON file; import validates it, then *merges* it:
 * days that already exist on this device are never touched, so a backup can
 * never silently overwrite something the person recorded here. A restore on a
 * fresh device adopts the profile (onboarding + preferences) as well.
 */

export const BACKUP_APP = "cycle";
export const BACKUP_KIND = "cycle-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: CycleData;
}

export function buildBackup(
  data: CycleData,
  now = new Date().toISOString()
): BackupFile {
  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now,
    data: sanitizeData(data),
  };
}

export function backupFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `cycle-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}.json`;
}

export type BackupParseResult =
  | { ok: true; data: CycleData; logCount: number }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** At least one of the shapes a Cycle payload can have must be present. */
function looksLikeCycleData(value: Record<string, unknown>): boolean {
  return (
    "logs" in value ||
    "onboarding" in value ||
    "settings" in value ||
    "imports" in value
  );
}

export function parseBackup(text: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Il file non contiene un JSON valido." };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: "Il file non sembra un backup di Cycle." };
  }

  let payload: unknown = parsed;

  // Accept both the wrapped backup format and a raw CycleData payload, so
  // files written by older versions keep working.
  if ("data" in parsed || "kind" in parsed) {
    if (parsed.kind !== undefined && parsed.kind !== BACKUP_KIND) {
      return { ok: false, error: "Questo file non è un backup di Cycle." };
    }
    if (parsed.app !== undefined && parsed.app !== BACKUP_APP) {
      return { ok: false, error: "Questo file non è un backup di Cycle." };
    }
    if (
      typeof parsed.version === "number" &&
      parsed.version > BACKUP_VERSION
    ) {
      return {
        ok: false,
        error:
          "Il backup è stato creato con una versione più recente di Cycle.",
      };
    }
    payload = parsed.data;
  }

  if (!isPlainObject(payload) || !looksLikeCycleData(payload)) {
    return { ok: false, error: "Il file non contiene dati Cycle." };
  }

  if (typeof payload.version === "number" && payload.version > 1) {
    return {
      ok: false,
      error: "Il backup non è compatibile con questa versione di Cycle.",
    };
  }

  if ("logs" in payload) {
    if (!isPlainObject(payload.logs)) {
      return { ok: false, error: "Il backup contiene registrazioni non valide." };
    }
    for (const [date, log] of Object.entries(payload.logs)) {
      if (!isValidKey(date)) {
        return { ok: false, error: "Il backup contiene date non valide." };
      }
      if (!isPlainObject(log)) {
        return {
          ok: false,
          error: "Il backup contiene una registrazione non valida.",
        };
      }
    }
  }

  if ("imports" in payload && !isPlainObject(payload.imports)) {
    return { ok: false, error: "Il backup contiene marcatori non validi." };
  }

  // Same normalisation as the local store: unknown fields are dropped and
  // old data keeps loading exactly as before.
  const data = sanitizeData(payload);
  return { ok: true, data, logCount: Object.keys(data.logs).length };
}

export interface MergeReport {
  /** Days that did not exist on this device and were added. */
  added: number;
  /** Days already present: left exactly as they were. */
  kept: number;
  /** Import markers carried over. */
  importsAdded: number;
  /** True when the profile came from the backup (fresh device). */
  adoptedProfile: boolean;
}

export function mergeBackup(
  current: CycleData,
  incoming: CycleData
): { data: CycleData; report: MergeReport } {
  const logs: Record<string, DailyLog> = { ...current.logs };
  let added = 0;
  let kept = 0;

  for (const [date, log] of Object.entries(incoming.logs)) {
    if (logs[date]) {
      kept += 1;
      continue;
    }
    logs[date] = log;
    added += 1;
  }

  const imports = { ...(current.imports ?? {}) };
  let importsAdded = 0;
  for (const [id, at] of Object.entries(incoming.imports ?? {})) {
    if (!imports[id]) {
      imports[id] = at;
      importsAdded += 1;
    }
  }

  const freshDevice =
    !current.onboarding.completed && Object.keys(current.logs).length === 0;

  return {
    data: {
      ...current,
      logs,
      imports,
      onboarding: freshDevice ? incoming.onboarding : current.onboarding,
      settings: freshDevice ? incoming.settings : current.settings,
    },
    report: {
      added,
      kept,
      importsAdded,
      adoptedProfile: freshDevice,
    },
  };
}
