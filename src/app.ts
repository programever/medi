// Medi page. The sound file of the session is the timer: the page only plays it and shows
// how much time is left, read from the sound's own position. So the time on screen is always the
// same as the bells, also after the phone was locked (the page sleeps, the sound does not).
import { SESSIONS, clock, nextMiddleBell, type Session } from './sessions.ts';
import { markHaba } from './haba-mark.ts';

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

$('back').addEventListener('click', () => show(home));

player.addEventListener('ended', () => finish(true));
for (const e of ['play', 'pause', 'waiting', 'playing', 'error']) player.addEventListener(e, update);

function finish(completed: boolean) {
  clearInterval(timer);
  asking(false);
  player.pause();
  const s = current;
  current = null;
  if (completed && s) {
    $('done-text').textContent = `Xong. Bạn đã ngồi ${s.label}.`;
    show(done);
    // A full session marks "Meditate" in Haba (Iker, 2026-10-21). A stopped session does not.
    const note = $('haba-note');
    note.textContent = 'Đang ghi vào Haba…';
    markHaba('meditate').then(
      () => { note.textContent = 'Đã đánh dấu Meditate trong Haba.'; },
      () => { note.textContent = 'Không ghi được vào Haba. Hãy bấm Meditate trong Haba.'; },
    );
  } else {
    show(home);
  }
  player.removeAttribute('src');
  player.load();
}
