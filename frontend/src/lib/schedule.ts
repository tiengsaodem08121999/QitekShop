export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

// Monday = 0, Sunday = 6
function dayIndexMondayFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  return addDays(d, -dayIndexMondayFirst(d));
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDayRange(d: Date): DateRange {
  return { start: d, end: d };
}

export function getWeekRange(d: Date): DateRange {
  return { start: startOfWeek(d), end: endOfWeek(d) };
}

// Month grid range: first Monday on or before day 1, last Sunday on or after last day
export function getMonthGridRange(d: Date): DateRange {
  return { start: startOfWeek(startOfMonth(d)), end: endOfWeek(endOfMonth(d)) };
}

// Returns 42 dates (6 weeks x 7 days) spanning the month grid
export function getMonthGridDates(d: Date): Date[] {
  const { start } = getMonthGridRange(d);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Convert "HH:MM:SS" to fractional hours from midnight
export function timeToHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

// Pad "HH:MM:SS" → "HH:MM" for inputs
export function trimSeconds(t: string): string {
  return t.slice(0, 5);
}

// Add ":00" to "HH:MM" so backend gets a full time string
export function withSeconds(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}
