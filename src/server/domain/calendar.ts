const DAY_MS = 24 * 60 * 60 * 1000;

function parts(date: Date, timeZone: string): Record<string, string> {
  const entries = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(entries.map(({ type, value }) => [type, value]));
}

export function localDate(date: Date, timeZone: string): string {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localWeekday(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function weekStart(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function addLocalDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function nextMondayAfter(date: Date, timeZone: string): string {
  const today = localDate(date, timeZone);
  const weekday = localWeekday(today);
  return addLocalDays(today, weekday === 1 ? 7 : 8 - weekday);
}

export function isWeekClosed(weekStartDate: string, now: Date, timeZone: string): boolean {
  return addLocalDays(weekStartDate, 6) < localDate(now, timeZone);
}

export function weeksBetween(firstMonday: string, lastMonday: string): string[] {
  const weeks: string[] = [];
  for (let cursor = firstMonday; cursor <= lastMonday; cursor = addLocalDays(cursor, 7)) {
    weeks.push(cursor);
  }
  return weeks;
}

export function compareLocalDates(left: string, right: string): number {
  return left.localeCompare(right);
}

export function epochDays(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
