import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PhaseId } from "@/types";
import { PHASES } from "@/lib/labels";

export function Screen({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[430px] px-6 ${className}`}>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
  quiet = false,
}: {
  children: ReactNode;
  className?: string;
  quiet?: boolean;
}) {
  return (
    <div className={`${quiet ? "card-quiet" : "card"} p-6 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="display-sm text-[19px] text-plum">{children}</h2>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: "dark" | "soft";
}

export function Chip({
  selected = false,
  tone = "dark",
  className = "",
  children,
  ...props
}: ChipProps) {
  const on = selected
    ? tone === "dark"
      ? "chip-on"
      : "chip-soft-on"
    : "";
  return (
    <button type="button" className={`chip ${on} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn-primary ${className}`} {...props}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn-ghost ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="display-sm text-[20px] text-plum-soft leading-tight">{label}</span>
        <span className="display-sm text-[27px] leading-none text-plum whitespace-nowrap">
          {value}
        </span>
      </div>
      {note ? (
        <span className="text-[11px] leading-none uppercase tracking-[0.14em] text-muted">{note}</span>
      ) : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "rose" | "sage";
  className?: string;
}) {
  const tones = {
    soft: "bg-soft text-plum-soft",
    rose: "bg-rose-soft text-rose-deep",
    sage: "bg-sage-soft text-sage",
  } as const;
  return (
    <span
      className={`inline-flex items-center justify-between gap-1.5 rounded-full px-3 py-1.5 text-[12px] leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const buttonClass =
    "flex h-11 w-11 items-center justify-center rounded-full bg-surface text-[18px] leading-none text-plum-soft transition-colors disabled:opacity-40";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-3 py-2">
      <button
        type="button"
        aria-label="Diminuisci"
        className={buttonClass}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="display-sm text-[20px] leading-none">
        {value} <span className="text-[11px] uppercase tracking-widest text-muted">{suffix}</span>
      </span>
      <button
        type="button"
        aria-label="Aumenta"
        className={buttonClass}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function CycleProgress({
  day,
  progress,
}: {
  day: number | null;
  progress: number;
}) {
  const SIZE = 196;
  const STROKE = 4.5;
  const RADIUS = (SIZE - STROKE) / 2 - 7;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const markerAngle = progress * 360;
  const markerX = SIZE / 2 + RADIUS * Math.cos((markerAngle * Math.PI) / 180);
  const markerY = SIZE / 2 + RADIUS * Math.sin((markerAngle * Math.PI) / 180);

  return (
    <div className="ring-in relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <div
        aria-hidden
        className="absolute inset-5 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0) 72%)",
        }}
      />
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        className="-rotate-90"
      >
        <defs>
          <linearGradient id="cycle-arc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--rose)" />
            <stop offset="58%" stopColor="var(--rose-deep)" />
            <stop offset="100%" stopColor="var(--peach)" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(53, 24, 42, 0.09)"
          strokeWidth={STROKE}
        />
        {day === null ? null : (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="url(#cycle-arc)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
            />
            <circle
              cx={markerX}
              cy={markerY}
              r={4}
              fill="var(--rose-deep)"
              stroke="rgba(255, 253, 249, 0.95)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
        {day === null ? (
          <>
            <span className="mb-2 font-sans text-[52px] leading-none text-muted-very">
              −
            </span>
            <span className="label-xs mt-2 max-w-[120px] text-center leading-snug normal-case tracking-normal">
              Nessun ciclo ancora registrato
            </span>
          </>
        ) : (
          <>
            <span className="display-large text-[82px] leading-none tracking-tighter">
              {day}
            </span>
            <span className="label-xs mt-2">giorno del ciclo</span>
          </>
        )}
      </div>
    </div>
  );
}

export function PhaseLine({ phase }: { phase: PhaseId | null }) {
  if (!phase) return null;
  const info = PHASES[phase];
  return (
    <div className="mt-1 px-4 text-center">
      <p className="display-sm text-[17px] leading-none text-plum">
        {info.label}
        <span className="ml-2 align-middle text-[11px] uppercase tracking-[0.14em] text-muted">
          {" "}fase stimata
        </span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        {info.hint}
      </p>
    </div>
  );
}
