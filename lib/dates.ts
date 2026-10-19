/**
 * Small, dependency-free date helpers.
 * Everything works on local dates and `YYYY-MM-DD` keys so a day never
 * shifts because of time zones.
 */

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const MONTHS_SHORT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

/** Monday first, like Italian calendars. */
export const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

const WEEKDAYS_LONG = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function isValidKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = fromKey(key);
  return !Number.isNaN(date.getTime()) && toKey(date) === key;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, amount: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + amount);
  return toKey(date);
}

function utc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

/** Whole days between two day keys (`a - b`). */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(a) - utc(b)) / 86400000);
}

export function range(from: string, to: string): string[] {
  const days: string[] = [];
  for (let key = from; diffDays(key, to) <= 0; key = addDays(key, 1)) {
    days.push(key);
    if (days.length > 400) break;
  }
  return days;
}

export function monthTitle(key: string): string {
  const date = fromKey(key);
  const name = MONTHS[date.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
}

export function formatLong(key: string): string {
  const date = fromKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShort(key: string): string {
  const date = fromKey(key);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "23 ottobre" — day and month, no year. */
export function formatDayMonth(key: string): string {
  const date = fromKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Italian wants "l'8", "l'11", "l'18" and "il" for the other days.
 * Used for every date the interface shows on its own.
 */
function dayArticle(day: number): string {
  return day === 8 || day === 11 || day === 18 ? "l'" : "il ";
}

/**
 * Human range for estimates: "tra il 23 e il 27 ottobre" or, across months,
 * "tra il 30 ottobre e il 3 novembre". Never phrased as a certainty.
 */
export function formatRange(from: string, to: string): string {
  const a = fromKey(from);
  const b = fromKey(to);
  const dayA = a.getDate();
  const dayB = b.getDate();

  if (from === to) return `${dayArticle(dayA)}${formatDayMonth(from)}`;

  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `tra ${dayArticle(dayA)}${dayA} e ${dayArticle(dayB)}${dayB} ${
      MONTHS[a.getMonth()]
    }`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `tra ${dayArticle(dayA)}${formatDayMonth(
      from
    )} e ${dayArticle(dayB)}${formatDayMonth(to)}`;
  }
  return `tra ${dayArticle(dayA)}${formatDayMonth(from)} ${a.getFullYear()} e ${dayArticle(
    dayB
  )}${formatDayMonth(to)} ${b.getFullYear()}`;
}

export function formatWithWeekday(key: string): string {
  const date = fromKey(key);
  const weekday = WEEKDAYS_LONG[(date.getDay() + 6) % 7];
  return `${weekday} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

export function shiftMonth(key: string, amount: number): string {
  const date = fromKey(key);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return toKey(date);
}

export function isWeekend(key: string): boolean {
  const day = fromKey(key).getDay();
  return day === 0 || day === 6;
}

/**
 * Weeks (Monday first) covering the given month.
 * Cells outside the month are `null` so the grid stays calm.
 */
export function monthWeeks(monthStartKey: string): (string | null)[][] {
  const date = fromKey(monthStartKey);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function daysInMonth(monthStartKey: string): number {
  const date = fromKey(monthStartKey);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
