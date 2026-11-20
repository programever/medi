// Tests for src/plan.ts, the 30-day meditation plan. Run: node --test test/plan.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/plan.ts';

test('30 days from Saturday 21 November, 30 minutes a day', () => {
  assert.equal(P.DAYS, 30);
  assert.equal(P.GOAL_MIN, 30);
  assert.equal(P.dayOf(1), '2026-11-21');
  assert.equal(P.dayOf(30), '2026-12-20');
  assert.equal(P.dayNumber('2026-11-20'), 0);
  assert.equal(P.dayNumber('2026-12-10'), 20);
  assert.equal(P.dayName('2026-11-21'), 'Thứ Bảy 21/11');
  assert.equal(P.dm(P.dayOf(30)), '20/12');
  assert.equal(P.weekday('2026-11-21'), 5, 'Saturday');
});

test('calendar: done, missed, today, to come', () => {
  const done = new Set(['2026-11-21', '2026-11-23', '2026-11-06']);
  const cal = P.calendar(done, '2026-11-24');
  assert.equal(cal.length, 30);
  assert.deepEqual(cal.slice(0, 5).map(c => c.state), ['done', 'missed', 'done', 'open', 'future']);
  assert.ok(cal[3]!.today);
  assert.equal(P.calendar(new Set(['2026-11-24']), '2026-11-24')[3]!.state, 'done', 'today with 30 minutes');
  assert.ok(P.calendar(new Set(), '2026-11-20').every(c => c.state === 'future'), 'before the start');
});

test('minutes add up over the day, a new day starts from 0', () => {
  let t = P.addTime(null, '2026-11-17', 600);
  assert.equal(P.minutesToday(t, '2026-11-17'), 10);
  t = P.addTime(t, '2026-11-17', 20 * 60 + 30);       // a stopped session counts too
  assert.equal(P.minutesToday(t, '2026-11-17'), 30);
  assert.equal(P.minutesToday(t, '2026-11-18'), 0);
  t = P.addTime(t, '2026-11-18', 300);
  assert.deepEqual(t, { day: '2026-11-18', sec: 300 });
  assert.equal(P.addTime(null, '2026-11-17', -5).sec, 0);
});
