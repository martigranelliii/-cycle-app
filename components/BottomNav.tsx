"use client";

import type { TabId } from "@/types";
import { IconCalendar, IconPlus, IconSpark, IconSun } from "./icons";

const TABS: {
  id: TabId;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { id: "oggi", label: "Oggi", Icon: IconSun },
  { id: "calendario", label: "Calendario", Icon: IconCalendar },
  { id: "registra", label: "Registra", Icon: IconPlus },
  { id: "insights", label: "Insights", Icon: IconSpark },
];

export function BottomNav({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      className="bottom-nav fixed inset-x-0 bottom-0 z-20"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[430px] items-stretch px-3">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              className="nav-item"
              data-active={active}
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-icon">
                <Icon className="h-[21px] w-[21px]" />
              </span>
              <span className={active ? "font-medium" : ""}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
