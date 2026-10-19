"use client";

import type { PhaseId } from "@/types";
import { PHASES } from "@/lib/labels";

const SIZE = 188;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2 - 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CycleRing({
  day,
  progress,
}: {
  day: number | null;
  progress: number;
}) {
  const filled = CIRCUMFERENCE * progress;
  // The whole SVG is rotated -90°, so the marker uses raw circle coordinates.
  const markerAngle = progress * 360;
  const markerX = SIZE / 2 + RADIUS * Math.cos((markerAngle * Math.PI) / 180);
  const markerY = SIZE / 2 + RADIUS * Math.sin((markerAngle * Math.PI) / 180);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--rose-soft)"
          strokeWidth={STROKE}
        />
        {day === null ? null : (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--rose)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            />
            <circle cx={markerX} cy={markerY} r={4.5} fill="var(--rose-deep)" />
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {day === null ? (
          <>
            <span className="display text-[40px] leading-none text-plum">
              —
            </span>
            <span className="label-xs mt-3 max-w-[120px] text-center leading-snug">
              Ancora nessun ciclo registrato
            </span>
          </>
        ) : (
          <>
            <span className="display text-[68px] leading-none tracking-[-0.04em]">
              {day}
            </span>
            <span className="label-xs mt-2">giorno del ciclo</span>
          </>
        )}
      </div>

    </div>
  );
}

export function PhaseLine({
  phase,
  children,
}: {
  phase: PhaseId | null;
  children?: React.ReactNode;
}) {
  if (!phase) return null;
  const info = PHASES[phase];
  return (
    <div className="text-center">
      <p className="display text-[26px] leading-tight">{info.label}</p>
      <p className="mt-1 text-[13px] text-muted">{info.hint}</p>
      {children}
    </div>
  );
}
