// Tests for src/plan.ts, the 30-day meditation plan. Run: node --test test/plan.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/plan.ts';

test('30 days from Monday 7 December, 30 minutes a day', () => {
  assert.equal(P.DAYS, 30);
  assert.equal(P.GOAL_MIN, 30);
  assert.equal(P.dayOf(1), '2026-12-07');
  assert.equal(P.dayOf(30), '2027-01-05');
  assert.equal(P.dayNumber('2026-12-06'), 0);
  assert.equal(P.dayNumber('2026-12-26'), 20);
  assert.equal(P.dayName('2026-12-07'), 'Thứ Hai 7/12');
  assert.equal(P.dm(P.dayOf(30)), '5/1');
  assert.equal(P.weekday('2026-12-07'), 0, 'Monday');
});

test('calendar: done, missed, today, to come', () => {
  const done = new Set(['2026-12-07', '2026-12-09', '2026-11-22']);
  const cal = P.calendar(done, '2026-12-10');
  assert.equal(cal.length, 30);
  assert.deepEqual(cal.slice(0, 5).map(c => c.state), ['done', 'missed', 'done', 'open', 'future']);
  assert.ok(cal[3]!.today);
  assert.equal(P.calendar(new Set(['2026-12-10']), '2026-12-10')[3]!.state, 'done', 'today with 30 minutes');
  assert.ok(P.calendar(new Set(), '2026-12-06').every(c => c.state === 'future'), 'before the start');
});

test('minutes add up over the day, a new day starts from 0', () => {
  let t = P.addTime(null, '2026-12-03', 600);
  assert.equal(P.minutesToday(t, '2026-12-03'), 10);
  t = P.addTime(t, '2026-12-03', 20 * 60 + 30);       // a stopped session counts too
  assert.equal(P.minutesToday(t, '2026-12-03'), 30);
  assert.equal(P.minutesToday(t, '2026-12-04'), 0);
  t = P.addTime(t, '2026-12-04', 300);
  assert.deepEqual(t, { day: '2026-12-04', sec: 300 });
  assert.equal(P.addTime(null, '2026-12-03', -5).sec, 0);
});
