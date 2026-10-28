"use client";

import { useEffect, useState } from "react";
import type { TabId } from "@/types";
import { useStore } from "@/lib/store";
import { diffDays } from "@/lib/dates";
import { BottomNav } from "./BottomNav";
import { CalendarView } from "./CalendarView";
import { InsightsView } from "./InsightsView";
import { Onboarding } from "./Onboarding";
import { RegistraView } from "./RegistraView";
import { DataSettings, downloadText } from "./DataSettings";
import { TodayView } from "./TodayView";

function Splash() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-3">
      <p className="display text-[28px] tracking-[-0.03em] text-plum">Cycle</p>
      <p className="label-xs">un momento</p>
    </div>
  );
}

export function App() {
  const { data, hydrated, today, storageStatus, raw, resetAll, error } =
    useStore();
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState<TabId>("oggi");
  const [logDateOverride, setLogDate] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<TabId>("oggi");
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [dayOverride, setCalendarDay] = useState<string | null>(null);

  const logDate = logDateOverride ?? today;
  const calendarMonth = monthOverride ?? `${today.slice(0, 7)}-01`;
  const calendarDay = dayOverride ?? today;

  // Offline shell: only active in production builds.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // In development, a previously installed offline shell (e.g. from a
      // production run on the same origin) could serve stale JS chunks
      // cache-first. Make sure it can't: unregister it and drop its caches.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("cycle-"))
            .forEach((key) => void caches.delete(key));
        });
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Each screen opens at the top, not at the previous screen's scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
    const target = document.querySelector<HTMLElement>("h1");
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [tab, settings, hydrated, data.onboarding.completed, storageStatus]);

  function openLog(date: string, from: TabId) {
    // A day that has not happened yet cannot be recorded.
    if (diffDays(date, today) > 0) return;
    setLogDate(date);
    setReturnTo(from);
    setTab("registra");
  }

  function handleTab(next: TabId) {
    if (next === "registra") {
      setLogDate(today);
      setReturnTo("oggi");
      setCalendarDay(today);
    }
    setTab(next);
  }

  if (!hydrated) return <Splash />;

  if (storageStatus === "corrupt" || storageStatus === "unavailable")
    return (
      <main className="mx-auto max-w-[430px] px-6 py-12">
        <h1 className="display text-3xl">Il tuo diario è da recuperare</h1>
        <p className="my-5 text-sm">
          Cycle non riesce a leggere i dati locali. Non li abbiamo sostituiti.
          Conserva una copia prima di ripartire e importare un backup.
        </p>
        {raw !== null ? (
          <button
            className="btn btn-primary"
            onClick={() => downloadText(raw, "cycle-recupero-originale.json")}
          >
            Esporta il dato originale
          </button>
        ) : null}
        <button
          className="btn btn-ghost mt-4"
          onClick={() => location.reload()}
        >
          Riprova a leggere
        </button>
        <button
          className="btn btn-quiet mt-4"
          onClick={() => {
            if (
              window.confirm(
                "Hai conservato una copia? Rimuovere il dato locale e aprire il recupero da backup?",
              )
            )
              resetAll();
          }}
        >
          Riparti e recupera da backup
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  if (!data.onboarding.completed) return <Onboarding />;
  if (settings) return <DataSettings onClose={() => setSettings(false)} />;
  function showDay(date: string) {
    setMonthOverride(`${date.slice(0, 7)}-01`);
    setCalendarDay(date);
    setTab("calendario");
  }
  return (
    <div className="min-h-[100svh]">
      <div className="mx-auto flex max-w-[430px] justify-end px-6 pt-2">
        <button
          type="button"
          className="min-h-11 text-sm text-muted"
          onClick={() => setSettings(true)}
        >
          Impostazioni
        </button>
      </div>
      {tab === "oggi" ? (
        <TodayView onLog={(date) => openLog(date, "oggi")} onDay={showDay} />
      ) : null}

      {tab === "calendario" ? (
        <CalendarView
          month={calendarMonth}
          selected={calendarDay}
          onMonthChange={setMonthOverride}
          onSelect={setCalendarDay}
          onRegister={(date) => openLog(date, "calendario")}
        />
      ) : null}

      {tab === "registra" ? (
        <RegistraView
          key={logDate}
          date={logDate}
          onDone={() => setTab(returnTo)}
          onPickDate={(date) => {
            setLogDate(date);
            setReturnTo("oggi");
          }}
        />
      ) : null}

      {tab === "insights" ? <InsightsView onDay={showDay} /> : null}

      <BottomNav tab={tab} onChange={handleTab} />
    </div>
  );
}
