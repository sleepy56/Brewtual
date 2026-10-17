export function pairDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekday(date: string): number { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function weekStart(date: string): string { return addDays(date, -weekday(date)); }
export function displayDate(date: string, _timezone = 'UTC'): string { const [year, month, day] = date.split('-').map(Number); const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }); return `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday(date)]}, ${monthName} ${day}`; }
