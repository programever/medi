// Test of the whole page in a headless browser. It starts the 30-minute session, checks that the
// sound plays and the time goes down, pauses and goes on, then jumps near the end and checks the
// end bell, the "done" screen and the Haba mark (to a fake Haba). It also takes phone-size pictures into test-shots/.
// Build first (npm run build), then: npm run test:browser
// To test the live site instead: MEDI_URL=https://programever.github.io/medi/ npm run test:browser
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium, type Browser } from 'playwright';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json',
};

// A small file server that can send part of a file ("range"), like GitHub Pages does.
// The browser needs this to jump inside a sound file.
function serve(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').split('?')[0]!.replace(/^\/$/, '/index.html');
    const file = join('dist', name);
    let size: number;
    try { size = statSync(file).size; } catch { res.writeHead(404).end(); return; }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
      createReadStream(file).pipe(res);
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const a = server.address();
    ok({ server, url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}/` });
  }));
}

test('a 30-minute session from start to done', async () => {
  let url = process.env['MEDI_URL'];
  let server: Server | null = null;
  if (!url) ({ server, url } = await serve());
  mkdirSync('test-shots', { recursive: true });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // Haba's database is faked here, so the test never writes to Iker's real data.
    const habaWrites: string[] = [];
    await page.route('https://firestore.googleapis.com/**', async (route) => {
      const req = route.request();
      if (req.url().includes(':runQuery')) return route.fulfill({ json: [{ readTime: 'x' }] });
      habaWrites.push(req.postDataJSON().fields.item.stringValue);
      return route.fulfill({ json: {} });
    });

    await page.goto(url);
    assert.deepEqual(await page.locator('.choice .label').allTextContents(), ['10 phút', '30 phút', '1 giờ']);
    await page.screenshot({ path: 'test-shots/home.png' });

    await page.click('[data-session="30"]');
    await page.waitForFunction(() => (document.getElementById('player') as HTMLAudioElement).currentTime > 1.5, null, { timeout: 20000 });
    assert.equal(await page.isVisible('#run'), true);
    const t = await page.textContent('#time');
    assert.match(t!, /^29:5\d$/, `time is ${t}`);
    assert.equal(await page.textContent('#next'), 'Chuông tiếp theo ở phút 15');
    await page.screenshot({ path: 'test-shots/run.png' });

    // Pause, then go on.
    await page.click('#pause');
    assert.equal(await page.textContent('#pause'), 'Tiếp tục');
    assert.equal(await page.textContent('#next'), 'Đang tạm dừng');
    const pausedAt = await page.evaluate(() => (document.getElementById('player') as HTMLAudioElement).currentTime);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => (document.getElementById('player') as HTMLAudioElement).currentTime), pausedAt);
    await page.click('#pause');
    assert.equal(await page.textContent('#pause'), 'Tạm dừng');

    // After the 15-minute bell: the mark on the ring turns on, only the end bell is left.
    await page.evaluate(() => { (document.getElementById('player') as HTMLAudioElement).currentTime = 905; });
    await page.waitForFunction(() => document.getElementById('next')!.textContent === 'Tiếp theo: chuông cuối', null, { timeout: 10000 });
    assert.equal(await page.locator('.mark.past').count(), 1);
    assert.match((await page.textContent('#time'))!, /^14:5\d$/);
    await page.screenshot({ path: 'test-shots/run-after-15.png' });

    // Jump to just before the end: the end bell rings, then the done screen.
    await page.evaluate(() => { (document.getElementById('player') as HTMLAudioElement).currentTime = 1798; });
    await page.waitForFunction(() => document.getElementById('next')!.textContent === 'Chuông cuối', null, { timeout: 10000 });
    assert.equal(await page.textContent('#time'), '0:00');
    await page.waitForSelector('#done:not([hidden])', { timeout: 30000 });
    assert.equal(await page.textContent('#done-text'), 'Xong. Bạn đã ngồi 30 phút.');
    await page.waitForFunction(() => document.getElementById('haba-note')!.textContent!.startsWith('Đã đánh dấu'), null, { timeout: 10000 });
    assert.deepEqual(habaWrites, ['meditate']);
    await page.screenshot({ path: 'test-shots/done.png' });
    await page.click('#back');
    assert.equal(await page.isVisible('#home'), true);

    // Stop in the middle: back to the first screen, no sound.
    await page.click('[data-session="10"]');
    await page.waitForFunction(() => (document.getElementById('player') as HTMLAudioElement).currentTime > 0.5, null, { timeout: 20000 });
    await page.click('#stop');
    assert.equal(await page.isVisible('#ask-stop'), true);
    await page.click('#stop-no');
    assert.equal(await page.isVisible('#ask-stop'), false);
    assert.equal(await page.evaluate(() => (document.getElementById('player') as HTMLAudioElement).paused), false);
    await page.click('#stop');
    await page.click('#stop-yes');
    assert.equal(await page.isVisible('#home'), true);
    assert.equal(await page.evaluate(() => (document.getElementById('player') as HTMLAudioElement).paused), true);
    assert.deepEqual(habaWrites, ['meditate'], 'a stopped session does not mark Haba');

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.close();
  }
});
