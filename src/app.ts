// Medi page. The sound file of the session is the timer: the page only plays it and shows
// how much time is left, read from the sound's own position. So the time on screen is always the
// same as the bells, also after the phone was locked (the page sleeps, the sound does not).
// The first screen also shows the 30-day plan (see plan.ts): today's minutes and a calendar of the days.
import { SESSIONS, clock, nextMiddleBell, type Session } from './sessions.ts';
import { habaDay, markHaba } from './haba-mark.ts';
import { meditateDays } from './haba-days.ts';
import * as P from './plan.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const home = $('home'), run = $('run'), done = $('done');
const player = $<HTMLAudioElement>('player');
const timeEl = $('time'), nextEl = $('next'), titleEl = $('run-title');
const pauseBtn = $<HTMLButtonElement>('pause');
const bar = document.getElementById('bar') as unknown as SVGCircleElement;
const marks = document.getElementById('marks') as unknown as SVGGElement;

const R = 90;
const CIRCLE = 2 * Math.PI * R;
bar.style.strokeDasharray = String(CIRCLE);

let current: Session | null = null;
let timer = 0;

function show(which: HTMLElement) {
  for (const s of [home, run, done]) s.hidden = s !== which;
}

// Home: one button per session.
const choices = $('choices');
for (const s of SESSIONS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'choice';
  b.dataset.session = s.id;
  b.innerHTML = `<span class="label"></span><span class="note"></span>`;
  (b.querySelector('.label') as HTMLElement).textContent = s.label;
  (b.querySelector('.note') as HTMLElement).textContent = s.note;
  b.addEventListener('click', () => start(s));
  choices.append(b);
}

function drawMarks(s: Session) {
  marks.replaceChildren();
  for (const m of s.middle) {
    const a = (m / s.minutes) * 2 * Math.PI;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', String(100 + R * Math.cos(a)));
    c.setAttribute('cy', String(100 + R * Math.sin(a)));
    c.setAttribute('r', '5');
    c.setAttribute('class', 'mark');
    c.dataset.minute = String(m);
    marks.append(c);
  }
}

function start(s: Session) {
  current = s;
  titleEl.textContent = `Medi · ${s.label}`;
  drawMarks(s);
  player.src = s.file;
  player.currentTime = 0;
  // play() must run inside the tap, or the phone blocks the sound.
  player.play().catch(() => {
    nextEl.textContent = 'Không phát được chuông. Bấm Tiếp tục.';
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Medi · ${s.label}`,
      artist: 'Medi',
      artwork: [{ src: 'icon-180.png', sizes: '180x180', type: 'image/png' }],
    });
  }
  show(run);
  update();
  clearInterval(timer);
  timer = window.setInterval(update, 250);
}

function update() {
  if (!current) return;
  const total = current.minutes * 60;
  const elapsed = Math.min(player.currentTime || 0, total);
  timeEl.textContent = clock(total - elapsed);
  bar.style.strokeDashoffset = String(CIRCLE * (1 - elapsed / total));
  for (const c of Array.from(marks.children)) {
    c.classList.toggle('past', Number((c as SVGElement).dataset.minute) * 60 <= elapsed);
  }
  if (player.error) {
    nextEl.textContent = 'Không tải được tiếng chuông. Kiểm tra mạng rồi thử lại.';
  } else if (elapsed >= total) {
    nextEl.textContent = 'Chuông cuối';
  } else if (player.paused) {
    nextEl.textContent = 'Đang tạm dừng';
  } else if (player.readyState < 3 && !player.ended) {
    nextEl.textContent = 'Đang tải…';
  } else {
    const m = nextMiddleBell(current, elapsed);
    nextEl.textContent = m === null ? 'Tiếp theo: chuông cuối' : `Chuông tiếp theo ở phút ${m}`;
  }
  pauseBtn.textContent = player.paused ? 'Tiếp tục' : 'Tạm dừng';
  pauseBtn.hidden = elapsed >= total;
}

pauseBtn.addEventListener('click', () => {
  if (player.paused) void player.play();
  else player.pause();
  update();
});

// Stop asks first, inside the page (a pop-up question does not work everywhere).
const runButtons = $('run-buttons'), askStop = $('ask-stop');
function asking(on: boolean) {
  runButtons.hidden = on;
  askStop.hidden = !on;
}
$('stop').addEventListener('click', () => asking(true));
$('stop-no').addEventListener('click', () => asking(false));
$('stop-yes').addEventListener('click', () => finish(false));

$('back').addEventListener('click', () => { renderPlan(); show(home); });

player.addEventListener('ended', () => finish(true));
for (const e of ['play', 'pause', 'waiting', 'playing', 'error']) player.addEventListener(e, update);

function finish(completed: boolean) {
  clearInterval(timer);
  asking(false);
  player.pause();
  const s = current;
  current = null;
  // Every minute counts towards today's 30, also from a stopped session.
  const sec = s ? (completed ? s.minutes * 60 : Math.min(player.currentTime || 0, s.minutes * 60)) : 0;
  const reached = addToday(sec);
  if (completed && s) {
    $('done-text').textContent = `Xong. Bạn đã ngồi ${s.label}.`;
    const min = todayMinutes();
    $('day-note').textContent = min >= P.GOAL_MIN ? `Hôm nay: ${min} phút. Đã đủ ${P.GOAL_MIN} phút.`
      : `Hôm nay: ${min} / ${P.GOAL_MIN} phút. Còn ${P.GOAL_MIN - min} phút nữa.`;
    show(done);
    showHaba($('haba-note'), reached);
  } else {
    showHaba($('home-note'), reached);
    renderPlan();
    show(home);
  }
  player.removeAttribute('src');
  player.load();
}

// ---------- the 30-day plan ----------
// Today's minutes are kept on this phone. When the day has 30 minutes, Medi marks Meditate in Haba
// (once per day, Haba's rule). Before the plan, any full session marked it; now it needs the 30 minutes.
const STORE = 'medi-today';
let doneDays = new Set<string>();

function loadToday(): P.DayTime | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as P.DayTime | null;
    return v && typeof v.day === 'string' && typeof v.sec === 'number' ? v : null;
  } catch { return null; }
}
function todayMinutes(): number { return P.minutesToday(loadToday(), habaDay(new Date())); }

/** Add the seconds to today. Answers true when today has 30 minutes now. */
function addToday(sec: number): boolean {
  const t = P.addTime(loadToday(), habaDay(new Date()), sec);
  try { localStorage.setItem(STORE, JSON.stringify(t)); } catch { /* no storage: only this visit counts */ }
  return Math.floor(t.sec / 60) >= P.GOAL_MIN;
}

/** Mark Meditate in Haba when today has 30 minutes, and say so in `note`. */
function showHaba(note: HTMLElement, reached: boolean) {
  if (!reached) {
    note.textContent = sessionsNote();
    return;
  }
  if (doneDays.has(habaDay(new Date()))) { note.textContent = 'Đã có Meditate trong Haba hôm nay.'; return; }
  note.textContent = 'Đang ghi vào Haba…';
  markHaba('meditate').then(
    () => { note.textContent = 'Đã đánh dấu Meditate trong Haba.'; doneDays.add(habaDay(new Date())); renderPlan(); },
    () => { note.textContent = 'Không ghi được vào Haba. Hãy bấm Meditate trong Haba.'; },
  );
}
function sessionsNote(): string { return `Đủ ${P.GOAL_MIN} phút trong ngày thì Medi đánh dấu Meditate trong Haba.`; }

function renderPlan() {
  const today = habaDay(new Date());
  const n = P.dayNumber(today);
  const min = todayMinutes();
  const ok = min >= P.GOAL_MIN || doneDays.has(today);
  $('dayno').textContent = n < 1 ? `30 ngày thiền bắt đầu ${P.dayName(P.START)}` : n <= P.DAYS ? `Ngày ${n} / ${P.DAYS}` : 'Đã xong 30 ngày';
  $('today-min').textContent = n < 1 ? `Mỗi ngày ít nhất ${P.GOAL_MIN} phút.`
    : ok ? `Hôm nay: ${min} phút. Đã đủ ✓` : `Hôm nay: ${min} / ${P.GOAL_MIN} phút`;
  $('pbar').hidden = n < 1;
  $('pbar-fill').style.width = `${ok ? 100 : Math.min(100, (min / P.GOAL_MIN) * 100)}%`;

  const cells = P.calendar(doneDays, today);
  const doneCount = cells.filter((c) => c.state === 'done').length;
  $('cal-sum').textContent = n < 1 ? `Từ ${P.dm(P.dayOf(1))} đến ${P.dm(P.dayOf(P.DAYS))}.` : `Đã đủ ${P.GOAL_MIN} phút: ${doneCount} ngày.`;
  let html = P.WEEKDAYS_SHORT.map((w) => `<span class="wd">${w}</span>`).join('') + '<span></span>'.repeat(P.weekday(P.START));
  for (const c of cells) {
    const [, m, d] = c.day.split('-').map(Number);
    const month = c.n === 1 || d === 1 ? `<span class="mo">Th${m}</span>` : '';
    const words = c.state === 'done' ? `đủ ${P.GOAL_MIN} phút` : c.state === 'future' ? 'chưa đến' : c.state === 'open' ? 'hôm nay' : 'chưa đủ';
    html += `<span class="c st-${c.state}${c.today ? ' today' : ''}" role="img" aria-label="Ngày ${c.n}, ${P.dayName(c.day)}, ${words}">${month}${d}</span>`;
  }
  $('cal').innerHTML = html;
}

async function loadDays() {
  try {
    doneDays = await meditateDays();
    // 30 minutes already today but no mark yet (no network at the time): try again now.
    if (todayMinutes() >= P.GOAL_MIN && !doneDays.has(habaDay(new Date()))) showHaba($('home-note'), true);
  } catch {
    $('home-note').textContent = 'Không đọc được Haba. Lịch có thể chưa đủ.';
  }
  renderPlan();
}

renderPlan();
void loadDays();
// A new day starts at 04:00: draw again when the page comes back, and every minute.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !current) void loadDays(); });
window.setInterval(() => { if (!current) renderPlan(); }, 60000);
