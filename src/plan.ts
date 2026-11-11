// The 30-day meditation plan (Iker, 2026-11-11: "tomorrow I will also start meditation, minimum 30 minutes
// a day for the next 30 days"). Day 1 is Thursday 12 November 2026. A day starts at 04:00, like Haba.
//
// How a day counts: Medi adds up the minutes of every session of the day, finished or stopped, on this phone.
// When the day reaches 30 minutes, Medi marks Meditate in Haba. The calendar reads the Meditate marks in Haba,
// so a day Iker marks by hand in Haba (meditation without Medi) is green too. No new data, no rules change.
// No browser things in here, so it can be tested with node (see test/plan.test.ts).

export const START = '2026-11-12';
export const DAYS = 30;
export const GOAL_MIN = 30;

const pad = (n: number): string => String(n).padStart(2, '0');
function utcOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/** The plan day of a Haba day: 1 for START, 0 the day before, 31 the day after the plan. */
export function dayNumber(day: string): number { return Math.round((utcOf(day) - utcOf(START)) / 86400000) + 1; }

/** The Haba day of plan day n. */
export function dayOf(n: number): string {
  const x = new Date(utcOf(START) + (n - 1) * 86400000);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: string): number { return (new Date(utcOf(day)).getUTCDay() + 6) % 7; }

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
export const WEEKDAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** "Thứ Năm 12/11" */
export function dayName(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[weekday(day)]} ${d}/${m}`;
}

/** done: 30 minutes (a Meditate mark in Haba). open: today, not yet. missed: a past day without. future: to come. */
export type CellState = 'done' | 'open' | 'missed' | 'future';
export interface Cell { n: number; day: string; state: CellState; today: boolean }

/** The 30 days, from the Haba days that have a Meditate mark. */
export function calendar(doneDays: ReadonlySet<string>, today: string): Cell[] {
  const cells: Cell[] = [];
  for (let n = 1; n <= DAYS; n++) {
    const day = dayOf(n);
    const state: CellState = doneDays.has(day) ? 'done' : day > today ? 'future' : day === today ? 'open' : 'missed';
    cells.push({ n, day, state, today: day === today });
  }
  return cells;
}

/** The meditation time of one day, kept on the phone. */
export interface DayTime { day: string; sec: number }

/** Add `sec` seconds to the day's time. A new day starts again from 0. */
export function addTime(saved: DayTime | null, day: string, sec: number): DayTime {
  const before = saved && saved.day === day ? saved.sec : 0;
  return { day, sec: before + Math.max(0, Math.round(sec)) };
}

/** Whole minutes meditated today (0 when the saved time is from another day). */
export function minutesToday(saved: DayTime | null, day: string): number {
  return saved && saved.day === day ? Math.floor(saved.sec / 60) : 0;
}
