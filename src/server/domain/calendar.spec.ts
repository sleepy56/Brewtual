import {
  addLocalDays,
  isWeekClosed,
  localDate,
  localWeekday,
  nextMondayAfter,
  weekStart,
} from './calendar';

describe('pair-local calendar rules', () => {
  it('uses the pair timezone when the UTC date differs', () => {
    expect(localDate(new Date('2026-01-05T01:00:00.000Z'), 'America/Los_Angeles')).toBe('2026-01-04');
    expect(localDate(new Date('2026-01-04T18:30:00.000Z'), 'Asia/Kolkata')).toBe('2026-01-05');
  });

  it('maps local dates to ISO weekdays and Monday week starts', () => {
    expect(localWeekday('2026-10-11')).toBe(7);
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });

  it('starts on the first Monday strictly after the approval local date', () => {
    expect(nextMondayAfter(new Date('2026-10-05T02:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-10-12');
    expect(nextMondayAfter(new Date('2026-10-11T18:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-10-12');
    expect(nextMondayAfter(new Date('2026-10-06T02:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-10-12');
  });

  it('closes a week only after its Sunday in the pair timezone', () => {
    expect(isWeekClosed('2026-10-05', new Date('2026-10-11T18:29:00.000Z'), 'Asia/Kolkata')).toBe(false);
    expect(isWeekClosed('2026-10-05', new Date('2026-10-11T18:30:00.000Z'), 'Asia/Kolkata')).toBe(true);
  });

  it('adds calendar days across month and year boundaries', () => {
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});
