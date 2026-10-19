"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CycleData, DailyLog, Onboarding, Settings } from "@/types";
import { EMPTY_STATS, computeCycle, type CycleStats } from "./cycle";
import { todayKey } from "./dates";
import { applyHistoricalImport, hasImportedHistory, type ImportReport } from "./history";
import { clearData, emptyData, loadData, saveData } from "./storage";
import { mergeBackup, type MergeReport } from "./backup";

/**
 * One tiny external store for the whole app.
 *
 * localStorage is the source of truth; React subscribes to it through
 * `useSyncExternalStore`, so every screen reads the same data and a save
 * updates the UI and the device in one step. No library, no context tree.
 */

interface Snapshot {
  data: CycleData;
  /** False until localStorage has been read on the client. */
  hydrated: boolean;
  /** Today's date key. Empty during the server render. */
  today: string;
  /** Greeting for the current part of the day. Empty during SSR. */
  greeting: string;
}

const SERVER_SNAPSHOT: Snapshot = {
  data: emptyData(),
  hydrated: false,
  today: "",
  greeting: "",
};

/** Computed from the clock, but only outside render (hydration event). */
function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Buonanotte";
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

let snapshot: Snapshot = SERVER_SNAPSHOT;
let currentData: CycleData = snapshot.data;
const listeners = new Set<() => void>();

function commit(data: CycleData, persist = true) {
  currentData = data;
  snapshot = { ...snapshot, data };
  if (persist) saveData(data);
  listeners.forEach((listener) => listener());
}

let hydrationScheduled = false;
let dayWatcherInstalled = false;

/**
 * Keeps "today" honest when the app stays open past midnight or comes back
 * from the background. Runs in an event handler, never during render.
 */
function installDayWatcher() {
  if (dayWatcherInstalled || typeof document === "undefined") return;
  dayWatcherInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !snapshot.hydrated) return;
    const today = todayKey();
    if (today === snapshot.today) return;
    snapshot = { ...snapshot, today, greeting: greetingForNow() };
    listeners.forEach((listener) => listener());
  });
}

/** Reading storage happens outside of render so the HTML stays stable. */
function ensureHydrated() {
  if (snapshot.hydrated || hydrationScheduled) return;
  if (typeof window === "undefined") return;
  hydrationScheduled = true;
  const run = () => {
    currentData = loadData();
    snapshot = {
      data: currentData,
      hydrated: true,
      today: todayKey(),
      greeting: greetingForNow(),
    };
    installDayWatcher();
    listeners.forEach((listener) => listener());
  };
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureHydrated();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  ensureHydrated();
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/* ----------------------------- actions ----------------------------- */

export type LogDraft = Omit<DailyLog, "date" | "createdAt" | "updatedAt">;

export function saveLog(date: string, draft: LogDraft) {
  const existing = currentData.logs[date];
  const now = new Date().toISOString();
  commit({
    ...currentData,
    logs: {
      ...currentData.logs,
      [date]: {
        ...draft,
        date,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
    },
  });
}

export function deleteLog(date: string) {
  const logs = { ...currentData.logs };
  delete logs[date];
  commit({ ...currentData, logs });
}

export function finishOnboarding(onboarding: Onboarding) {
  commit({
    ...currentData,
    onboarding,
    settings: {
      averageCycleLength: onboarding.cycleLength ?? 28,
      averagePeriodLength: onboarding.periodLength ?? 5,
    },
  });
}

export function updateSettings(settings: Partial<Settings>) {
  commit({ ...currentData, settings: { ...currentData.settings, ...settings } });
}

export function resetAll() {
  clearData();
  commit(emptyData(), false);
}

/** One-time history migration. Safe to call more than once. */
export function importHistory(): ImportReport {
  const result = applyHistoricalImport(currentData);
  if (result.ok && !result.report.alreadyImported) {
    commit(result.data);
  }
  return result.report;
}

/**
 * Restores a validated backup. Existing days are never overwritten: only the
 * dates missing on this device are added.
 */
export function restoreBackup(incoming: CycleData): MergeReport {
  const { data, report } = mergeBackup(currentData, incoming);
  commit(data);
  return report;
}

/* ------------------------------ hooks ------------------------------ */

export interface CycleStore extends Snapshot {
  stats: CycleStats;
  logCount: number;
  /** True once the one-time historical import has been applied. */
  historyImported: boolean;
  saveLog: typeof saveLog;
  deleteLog: typeof deleteLog;
  finishOnboarding: typeof finishOnboarding;
  updateSettings: typeof updateSettings;
  resetAll: typeof resetAll;
  importHistory: typeof importHistory;
  restoreBackup: typeof restoreBackup;
}

export function useStore(): CycleStore {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const stats = useMemo(
    () =>
      state.today
        ? computeCycle({
            logs: state.data.logs,
            lastPeriodStart: state.data.onboarding.lastPeriodStart,
            averageCycleLength: state.data.settings.averageCycleLength,
            averagePeriodLength: state.data.settings.averagePeriodLength,
            today: state.today,
          })
        : EMPTY_STATS,
    [state]
  );

  return {
    ...state,
    stats,
    logCount: Object.keys(state.data.logs).length,
    historyImported: hasImportedHistory(state.data),
    saveLog,
    deleteLog,
    finishOnboarding,
    updateSettings,
    resetAll,
    importHistory,
    restoreBackup,
  };
}
