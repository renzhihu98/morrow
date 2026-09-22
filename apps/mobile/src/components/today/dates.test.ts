import { chatDayLabel, dayMonthLabel, todayDateLine } from './dates';

describe('today date labels', () => {
  it('formats day and short month in sentence case', () => {
    expect(dayMonthLabel('2026-09-21')).toBe('21 Sept');
    expect(dayMonthLabel('2026-06-03')).toBe('3 June');
  });

  it('builds the Today date line in the user timezone', () => {
    expect(todayDateLine('2026-09-21T07:12:00Z', 'UTC')).toBe('Mon · 21 Sept · 07:12');
  });

  it('labels the first chat divider', () => {
    expect(chatDayLabel('2026-09-21', '06:43', '2026-09-21')).toBe('Today · 06:43');
    expect(chatDayLabel('2026-09-16', '06:43', '2026-09-21')).toBe('Wed 16 Sept · 06:43');
  });
});
