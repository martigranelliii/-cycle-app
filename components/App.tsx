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
  const { data, hydrated, today } = useStore();
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
          keys.forEach((key) => void caches.delete(key));
        });
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Each screen opens at the top, not at the previous screen's scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

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

  if (!data.onboarding.completed) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-[100svh]">
      {tab === "oggi" ? (
        <TodayView onLog={(date) => openLog(date, "oggi")} />
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

      {tab === "insights" ? <InsightsView /> : null}

      <BottomNav tab={tab} onChange={handleTab} />
    </div>
  );
}
