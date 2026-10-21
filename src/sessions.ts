// The three sessions. A bell rings at minute 0 (start bell), at every minute in `middle`
// (the 15-minute bell) and at the last minute (end bell).
// tools/make-sounds.ts reads this list to make one sound file per session, and the page reads it
// to show the time and the next bell. Change the list, then run `npm run sounds`.

export interface Session {
  id: string;
  label: string; // text on the button
  note: string; // small line under the button
  minutes: number;
  middle: number[]; // minutes where the 15-minute bell rings
  file: string; // sound file in src/ (made by tools/make-sounds.ts)
}

export const SESSIONS: Session[] = [
  { id: '10', label: '10 phút', note: 'Chuông đầu và chuông cuối', minutes: 10, middle: [], file: 'medi-10.mp3' },
  { id: '30', label: '30 phút', note: 'Thêm chuông ở phút 15', minutes: 30, middle: [15], file: 'medi-30.mp3' },
  { id: '60', label: '1 giờ', note: 'Chuông mỗi 15 phút', minutes: 60, middle: [15, 30, 45], file: 'medi-60.mp3' },
];

/** Length of end.mp3 in seconds, rounded up. The sound file is this much longer than the session. */
export const END_BELL_SECONDS = 12;

/** "9:05" or "1:00:00". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** The minute of the next bell after `elapsed` seconds, or null if only the end bell is left. */
export function nextMiddleBell(session: Session, elapsed: number): number | null {
  for (const m of session.middle) if (m * 60 > elapsed) return m;
  return null;
}
