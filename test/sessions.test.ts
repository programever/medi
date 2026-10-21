// Checks the session list, the clock text, and (when ffmpeg is on the machine) that every bell is
// at the right second inside each sound file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { SESSIONS, END_BELL_SECONDS, clock, nextMiddleBell } from '../src/sessions.ts';

const byId = (id: string) => SESSIONS.find((s) => s.id === id)!;

test('the three sessions Iker asked for', () => {
  assert.deepEqual(SESSIONS.map((s) => [s.minutes, s.middle]), [
    [10, []],
    [30, [15]],
    [60, [15, 30, 45]],
  ]);
});

test('clock text', () => {
  assert.equal(clock(600), '10:00');
  assert.equal(clock(65), '1:05');
  assert.equal(clock(64.2), '1:05');
  assert.equal(clock(3600), '1:00:00');
  assert.equal(clock(-3), '0:00');
});

test('next bell', () => {
  assert.equal(nextMiddleBell(byId('10'), 0), null);
  assert.equal(nextMiddleBell(byId('30'), 0), 15);
  assert.equal(nextMiddleBell(byId('30'), 900), null);
  assert.equal(nextMiddleBell(byId('60'), 901), 30);
  assert.equal(nextMiddleBell(byId('60'), 2700), null);
});

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

test('bells are at the right seconds in each sound file', { skip: !hasFfmpeg() && 'no ffmpeg here' }, () => {
  for (const s of SESSIONS) {
    const file = `src/${s.file}`;
    assert.ok(existsSync(file), `${file} is missing, run npm run sounds`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=n=-60dB:d=2', '-f', 'null', '-'],
      { encoding: 'utf8' });
    // A bell starts where a silence ends. The start bell is at 0, so it has no silence before it.
    const starts = [...r.stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Math.round(Number(m[1])));
    assert.deepEqual(starts, [...s.middle, s.minutes].map((m) => m * 60), file);
    assert.ok(!/silence_start: 0\b/.test(r.stderr), `${file}: no start bell at 0:00`);
    const [h, m, sec] = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr)!.slice(1).map(Number) as [number, number, number];
    const d = h * 3600 + m * 60 + sec;
    assert.ok(Math.abs(d - (s.minutes * 60 + END_BELL_SECONDS)) < 1, `${file} is ${d} seconds`);
  }
});
