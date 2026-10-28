"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { CycleData, DailyLog, Onboarding, Settings } from "@/types";
import { EMPTY_STATS, computeCycle } from "./cycle";
import { todayKey } from "./dates";
import {
  clearData,
  emptyData,
  readStorage,
  saveData,
  type StorageRead,
  type WriteResult,
} from "./storage";
import { mergeBackup } from "./backup";
export type LogDraft = Omit<DailyLog, "date" | "createdAt" | "updatedAt">;
interface Snapshot {
  data: CycleData;
  hydrated: boolean;
  today: string;
  greeting: string;
  storageStatus: StorageRead["status"];
  raw: string | null;
  error: string;
  drafts: Record<string, LogDraft>;
  draftBases: Record<string, string>;
}
const server: Snapshot = {
  data: emptyData(),
  hydrated: false,
  today: "",
  greeting: "Ciao",
  storageStatus: "empty",
  raw: null,
  error: "",
  drafts: {},
  draftBases: {},
};
let state = server;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let scheduled = false;
function refresh() {
  const result = readStorage();
  state = {
    ...state,
    ...result,
    storageStatus: result.status,
    hydrated: true,
    today: todayKey(),
  };
  emit();
}
function init() {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;
  queueMicrotask(refresh);
  window.addEventListener("beforeunload", (event) => {
    if (Object.keys(state.drafts).length) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "cycle.v1" || event.key === null) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}
function commit(data: CycleData): WriteResult {
  if (
    state.storageStatus === "corrupt" ||
    state.storageStatus === "unavailable"
  )
    return fail({ ok: false, reason: "storage" });
  const result = saveData(data, state.raw);
  if (!result.ok) {
    if (result.reason === "conflict") refresh();
    return fail(result);
  }
  state = {
    ...state,
    data,
    raw: JSON.stringify(data),
    storageStatus: "ok",
    error: "",
  };
  emit();
  return result;
}
function fail(result: WriteResult): WriteResult {
  state = {
    ...state,
    error:
      !result.ok && result.reason === "conflict"
        ? "I dati sono cambiati in un’altra scheda. La bozza è qui: controlla e riprova."
        : "Non sono riuscita a salvare. I dati e la bozza restano qui: riprova.",
  };
  emit();
  return result;
}
export function setDraft(date: string, draft: LogDraft, base?: string) {
  state = {
    ...state,
    drafts: { ...state.drafts, [date]: draft },
    draftBases: {
      ...state.draftBases,
      [date]:
        state.draftBases[date] ??
        base ??
        JSON.stringify(state.data.logs[date] ?? null),
    },
  };
  emit();
}
export function discardDraft(date: string) {
  const drafts = { ...state.drafts };
  const draftBases = { ...state.draftBases };
  delete drafts[date];
  delete draftBases[date];
  state = { ...state, drafts, draftBases };
  emit();
}
export function saveLog(
  date: string,
  draft: LogDraft,
  replaceChangedDay = false,
) {
  const latest = readStorage();
  if (latest.raw !== state.raw) refresh();
  const existing = state.data.logs[date];
  if (
    state.draftBases[date] !== undefined &&
    state.draftBases[date] !== JSON.stringify(existing ?? null) &&
    !replaceChangedDay
  ) {
    state = {
      ...state,
      error:
        "Questa giornata è cambiata in un’altra scheda. Controlla la versione salvata prima di sostituirla.",
    };
    emit();
    return { ok: false, reason: "conflict" } as WriteResult;
  }
  const backupConflicts = { ...state.data.backupConflicts };
  if (replaceChangedDay && existing)
    backupConflicts[date] = [...(backupConflicts[date] ?? []), existing];
  const now = new Date().toISOString();
  const result = commit({
    ...state.data,
    backupConflicts,
    logs: {
      ...state.data.logs,
      [date]: {
        ...draft,
        date,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
    },
  });
  if (result.ok) discardDraft(date);
  return result;
}
export function deleteLog(date: string) {
  const logs = { ...state.data.logs };
  delete logs[date];
  const r = commit({ ...state.data, logs });
  if (r.ok) discardDraft(date);
  return r;
}
export function finishOnboarding(onboarding: Onboarding) {
  return commit({
    ...state.data,
    onboarding,
    settings: {
      averageCycleLength: onboarding.cycleLength ?? 28,
      averagePeriodLength: onboarding.periodLength ?? 5,
    },
  });
}
export function updateSettings(settings: Partial<Settings>) {
  return commit({
    ...state.data,
    settings: { ...state.data.settings, ...settings },
  });
}
export function updateProfile(lastPeriodStart: string | null) {
  return commit({
    ...state.data,
    onboarding: { ...state.data.onboarding, lastPeriodStart },
  });
}
export function resetAll() {
  const r = clearData(state.raw);
  if (!r.ok) return fail(r);
  state = { ...server, hydrated: true, today: todayKey() };
  emit();
  return r;
}
export function restoreBackup(incoming: CycleData, preferIncoming = false) {
  const merged = mergeBackup(state.data, incoming, preferIncoming);
  // Corrupt original stays untouched until explicitly reset; import is available afterwards.
  const result = commit(merged.data);
  return { ...merged.report, ok: result.ok };
}
export function useStore() {
  const snapshot = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      init();
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
    () => server,
  );
  const stats = useMemo(
    () =>
      snapshot.today
        ? computeCycle({
            logs: snapshot.data.logs,
            lastPeriodStart: snapshot.data.onboarding.lastPeriodStart,
            averageCycleLength: snapshot.data.settings.averageCycleLength,
            averagePeriodLength: snapshot.data.settings.averagePeriodLength,
            today: snapshot.today,
          })
        : EMPTY_STATS,
    [snapshot.data, snapshot.today],
  );
  return {
    ...snapshot,
    stats,
    logCount: Object.keys(snapshot.data.logs).length,
    saveLog,
    deleteLog,
    finishOnboarding,
    updateSettings,
    updateProfile,
    resetAll,
    restoreBackup,
    setDraft,
    discardDraft,
  };
}
