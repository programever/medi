// Make one sound file per session: start bell at 0:00, the 15-minute bell at each middle minute,
// the end bell at the last minute, and silence in between. Needs ffmpeg. Run: npm run sounds
// The files are made once and kept in git, because the bells never change.
// Why one long file and not a timer that plays each bell: an iPhone keeps playing a sound file when
// the screen is locked, but it stops the page's own timers. So the file itself is the timer.
// Sound: mono, 24000 per second, MP3 with variable size, so the silence costs almost nothing
// (the 1-hour file is about 4 MB).
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { SESSIONS, END_BELL_SECONDS } from '../src/sessions.ts';

const RATE = 24000;
// pan=mono: the 15 and end bells are stereo, the start bell is mono. Mix both sides into one.
const MONO = 'aresample=24000,pan=mono|c0=0.5*c0+0.5*c1';

for (const s of SESSIONS) {
  const total = s.minutes * 60 + END_BELL_SECONDS;
  const ms = (min: number) => min * 60 * 1000;
  const parts: string[] = ['[1]aresample=24000,pan=mono|c0=c0[start]'];
  const labels = ['[start]'];
  s.middle.forEach((m, i) => {
    parts.push(`[2]${MONO},adelay=${ms(m)}[mid${i}]`);
    labels.push(`[mid${i}]`);
  });
  parts.push(`[3]${MONO},adelay=${ms(s.minutes)}[end]`);
  labels.push('[end]');
  parts.push(`[0]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first`);
  const out = `src/${s.file}`;
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-t', String(total), '-i', `anullsrc=r=${RATE}:cl=mono`,
    '-i', 'sounds/start.mp3', '-i', 'sounds/bell15.mp3', '-i', 'sounds/end.mp3',
    '-filter_complex', parts.join(';'),
    '-ac', '1', '-ar', String(RATE), '-c:a', 'libmp3lame', '-q:a', '4',
    '-metadata', `title=Medi ${s.label}`, '-metadata', 'artist=Medi',
    out,
  ], { stdio: 'inherit' });
  console.log(`${out}: ${(statSync(out).size / 1e6).toFixed(1)} MB, ${total} seconds`);
}
