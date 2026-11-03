#!/usr/bin/env node
/**
 * End-to-end smoke test of the exercise cards (src/cards) in headless Chrome, on the fNIRS simulator:
 * their home, a card, a game's lobby, a game played on the split screen (band baseline, practice,
 * play, summary, saved to the cards' history and to the app's sessions), the same game with the pad
 * in a second window (pad.html over BroadcastChannel), the day's workout (with its rest), the paper
 * session's first steps, and — when the desktop server's relay answers at RELAY_URL — a game with
 * the pad over the relay.  A robot taps the pad at random: the test checks the plumbing, not the
 * scores.  Every view is checked at desktop and phone width for horizontal overflow; any page
 * error, console error or failed request fails the run.
 *
 *   npm run build && npm run cards:smoke
 *   (CHROME_PATH=… to choose the browser; RELAY_URL=http://127.0.0.1:8420/app/ to include the relay,
 *    after npm run build:desktop and python server.py)
 *
 * Screenshots land in web/.smoke/cards/ (git-ignored).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WEB, 'dist');
const SHOTS = join(WEB, '.smoke', 'cards');
const RELAY = process.env.RELAY_URL ?? '';
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

function chromePath() {
  const found = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find(p => existsSync(p));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH');
  return found;
}

function serve(root) {
  const server = createServer((req, res) => {
    let file;
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
      file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const inside = relative(root, file);
    if (inside.startsWith('..') || isAbsolute(inside) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const t0 = Date.now();
const step = name => console.log(`• ${name}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No build found: run npm run build first.');
  process.exit(1);
}
await mkdir(SHOTS, { recursive: true });
const server = await serve(DIST);
const origin = `http://127.0.0.1:${server.address().port}`;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2 };
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: DESKTOP,
  protocolTimeout: 300_000,
});
const errors = [];
let failed = false;

function watch(page, who) {
  page.setDefaultTimeout(90_000);
  page.on('pageerror', e => errors.push(`${who}: page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${who}: console: ${m.text()}`); });
  page.on('requestfailed', r => { if (!r.url().startsWith('blob:')) errors.push(`${who}: request failed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${who}: HTTP ${r.status()}: ${r.url()}`); });
  page.on('dialog', d => void d.accept());
}

/** Taps the pad's buttons at random, like an impatient player, until stopped. */
const startRobot = page => page.evaluate(() => {
  window.__robot = setInterval(() => {
    const items = [...document.querySelectorAll('.k-pad [data-item]')];
    if (!items.length) return;
    const el = items[Math.floor(Math.random() * items.length)];
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
  }, 260);
});
const stopRobot = page => page.evaluate(() => clearInterval(window.__robot));

try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  watch(page, 'board');
  const shot = (name, fullPage = false, p = page) => p.screenshot({ path: join(SHOTS, `${name}.png`), fullPage });
  const clickText = (sel, label, p = page) => p.evaluate((s, l) => {
    const b = [...document.querySelectorAll(s)].find(x => x.textContent.trim() === l);
    if (!b) throw new Error(`no "${l}" in ${s}`);
    b.click();
  }, sel, label);
  const overflow = async (label, p = page) => {
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
    if (o.sw > o.w + 1) throw new Error(`${label}: page scrolls sideways (${o.sw} > ${o.w})`);
  };
  const both = async (name, label) => {
    await shot(`${name}-desktop`, true);
    await overflow(`${label} (desktop)`);
    await page.setViewport(PHONE);
    await sleep(500);
    await shot(`${name}-phone`, true);
    await overflow(`${label} (phone)`);
    await page.setViewport(DESKTOP);
    await sleep(300);
  };
  const go = async hash => {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForFunction(() => !document.getElementById('view-karty')?.hidden && document.querySelector('#view-karty .k-module'));
    await sleep(500);
  };
  /** Pick the n-th option of the lobby's pad switch (0 this screen, 1 second window, 2 phone). */
  const padMode = async n => {
    await page.evaluate(k => {
      const groups = [...document.querySelectorAll('.k-start .k-seg')];
      groups[groups.length - 1].querySelectorAll('[role=radio]')[k].click();
    }, n);
    await sleep(300);
  };
  const start = () => page.click('.k-start .k-btn-ui.primary.big');
  const summary = async name => {
    await page.waitForSelector('.k-layer .k-summary', { timeout: 150_000 });
    await sleep(900);
    await shot(name);
    const info = await page.evaluate(() => ({
      score: document.querySelector('.k-summary .k-big b')?.textContent ?? document.querySelector('.k-summary .k-score')?.textContent ?? '',
      stats: [...document.querySelectorAll('.k-summary .k-stats div, .k-summary .k-stats li')].map(d => d.textContent.trim()).slice(0, 6),
    }));
    console.log(`  summary: ${info.score} · ${info.stats.join(' | ')}`);
  };

  step('first run: choose fNIRS, use the simulator');
  await page.goto(`${origin}/?trainingSec=20&lang=pl`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#toolPick:not([hidden])');
  await page.click('[data-pick="fnirs"]');
  await page.waitForFunction(() => document.body.dataset.tool === 'fnirs' && !document.getElementById('nextStep').hidden);
  await clickText('#nextActions button', 'Użyj symulatora');
  await page.waitForFunction(() => document.getElementById('chipMeta').textContent.includes('sygnał dobry'), { timeout: 60_000 });

  step('Trening and Start offer the cards');
  await page.evaluate(() => { location.hash = 'trening'; });
  await page.waitForFunction(() => !document.getElementById('view-trening').hidden);
  await sleep(600);
  if (!(await page.$('a[href="#karty"]'))) throw new Error('Trening has no link to the cards');
  await shot('01-trening', true);

  step('the cards: home');
  await go('karty');
  await page.waitForFunction(() => [...document.querySelectorAll('.k-gallery img')].filter(i => i.complete && i.naturalWidth > 0).length >= 8, { timeout: 30_000 });
  const counts = await page.evaluate(() => ({ games: document.querySelectorAll('.k-gametile').length, cards: document.querySelectorAll('.k-thumbcard').length }));
  if (counts.games !== 10 || counts.cards !== 32) throw new Error(`expected 10 games and 32 cards, found ${JSON.stringify(counts)}`);
  await both('02-home', 'cards home');
  await clickText('.k-chips button', 'Tylko druk');
  await sleep(300);
  const printOnly = await page.evaluate(() => document.querySelectorAll('.k-thumbcard').length);
  console.log(`  print-only cards: ${printOnly}`);
  if (printOnly !== 7) throw new Error(`expected 7 print-only cards, found ${printOnly}`);
  await clickText('.k-chips button', 'Wszystkie');

  step('one card: 07 (a game) and 26 (print only)');
  await go('karty/07');
  await page.waitForFunction(() => { const i = document.querySelector('#view-karty img'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 30_000 });
  await both('03-card07', 'card 07');
  await go('karty/26');
  await sleep(400);
  await shot('04-card26', true);

  step('lobby: Palce (finger colours)');
  await go('karty/gra/palce');
  await both('05-lobby', 'lobby');

  step('split screen: baseline, practice, play, summary');
  await padMode(0);
  await start();
  await page.waitForSelector('.k-layer:not([hidden])');
  await sleep(2500);
  await shot('06-baseline');
  await startRobot(page);
  await sleep(4000);
  await shot('07-split-desktop');
  await page.setViewport(PHONE);
  await sleep(800);
  await shot('07-split-phone');
  await overflow('split screen (phone)');
  await page.setViewport({ width: 844, height: 390 });
  await sleep(800);
  await shot('07-split-phone-landscape');
  await page.setViewport(DESKTOP);
  await summary('08-summary');
  await stopRobot(page);
  await page.setViewport(PHONE);
  await sleep(600);
  await shot('08-summary-phone', true);
  await overflow('summary (phone)');
  await page.setViewport(DESKTOP);
  await clickText('.k-summary button', 'Gotowe');
  await sleep(800);

  step('the session is in the cards’ history and in Sesje');
  await go('karty');
  const meta = await page.evaluate(() => [...document.querySelectorAll('.k-gametile')].find(t => t.getAttribute('href') === '#karty/gra/palce')?.querySelector('.k-gamemeta')?.textContent ?? '');
  console.log(`  Palce tile: ${meta}`);
  if (!/poziom/i.test(meta)) throw new Error(`the Palce tile shows no level after a session: "${meta}"`);
  await page.evaluate(() => { location.hash = 'sesje'; });
  await page.waitForSelector('#trainingList .session.training');
  await sleep(600);
  await shot('09-sesje');

  step('second window: pad.html over BroadcastChannel (Gesty)');
  await go('karty/gra/gesty');
  await padMode(1);
  await start();
  await page.waitForSelector('.k-sheet .k-room b');
  const room = await page.evaluate(() => document.querySelector('.k-sheet .k-room b').textContent);
  const padUrl = await page.evaluate(() => document.querySelector('.k-sheet .k-url').textContent);
  console.log(`  room ${room}: ${padUrl}`);
  await shot('10-pairing');
  const pad = await ctx.newPage();
  watch(pad, 'pad');
  await pad.setViewport(PHONE);
  await pad.goto(padUrl, { waitUntil: 'networkidle0' });
  // headless Chrome hides every tab but the front one, and a hidden board pauses (as it should): the
  // board stays in front, the pad works from the back (its timers slow down, its messages still flow)
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('.k-pair-status')?.dataset.ok === 'true', { timeout: 20_000 });
  await shot('11-paired');
  await clickText('.k-sheet button', 'Dalej');
  await startRobot(pad);
  await sleep(6000);
  await shot('12-board-channel');
  await shot('12-pad-channel', false, pad);
  await overflow('pad (phone)', pad);
  await page.bringToFront();   // (a screenshot may have brought the pad to the front: the hidden board pauses)
  await clickText('.k-sheet button', 'Wznów').catch(() => undefined);
  await summary('13-summary-channel');
  await stopRobot(pad);
  await shot('13-pad-done', false, pad);
  await clickText('.k-summary button', 'Gotowe');
  await pad.close();

  step('the pad page asks for a room when opened without one');
  const lone = await ctx.newPage();
  watch(lone, 'pad-join');
  await lone.setViewport(PHONE);
  await lone.goto(`${origin}/pad.html`, { waitUntil: 'networkidle0' });
  await lone.waitForSelector('.k-join input');
  await lone.screenshot({ path: join(SHOTS, '14-pad-join.png') });
  await lone.close();

  step("the day's workout: three games with rests");
  await go('karty');
  await page.click('.k-daily a');
  await page.waitForFunction(() => document.querySelector('.k-start'));
  await sleep(400);
  await padMode(0);
  await start();
  await page.waitForSelector('.k-layer:not([hidden])');
  await clickText('.k-layer button', 'Graj bez opaski').catch(() => undefined);
  await startRobot(page);
  for (let k = 0; k < 2; k++) {
    await page.waitForFunction(() => [...document.querySelectorAll('.k-layer button')].some(b => b.textContent.trim() === 'Pomiń przerwę'), { timeout: 120_000 });
    if (k === 0) await shot('15-workout-rest');
    await clickText('.k-layer button', 'Pomiń przerwę');
  }
  await summary('16-workout-summary');
  await stopRobot(page);
  await clickText('.k-summary button', 'Gotowe');

  step('paper session: card 07 with the band');
  await go('karty/07');
  await clickText('#view-karty button', 'Zacznij sesję z kartą');
  await page.waitForSelector('.k-layer:not([hidden])');
  await sleep(1500);
  await shot('17-paper-intro');
  await page.evaluate(() => document.querySelector('.k-layer .k-icon-btn')?.click());
  await sleep(500);

  if (RELAY) {
    step(`relay: ${RELAY}`);
    const relayPage = await ctx.newPage();
    watch(relayPage, 'relay-board');
    await relayPage.goto(`${RELAY}?trainingSec=20&lang=pl#karty/gra/znaki`, { waitUntil: 'networkidle0' });
    await relayPage.waitForSelector('.k-start');
    await relayPage.evaluate(() => {
      const groups = [...document.querySelectorAll('.k-start .k-seg')];
      groups[groups.length - 1].querySelectorAll('[role=radio]')[2].click();
    });
    await relayPage.waitForFunction(() => !document.querySelector('.k-start .k-btn-ui.primary.big').disabled, { timeout: 15_000 });
    await relayPage.click('.k-start .k-btn-ui.primary.big');
    await relayPage.waitForSelector('.k-sheet .k-qr');
    const rUrl = await relayPage.evaluate(() => document.querySelector('.k-sheet .k-url').textContent);
    console.log(`  pad url: ${rUrl}`);
    await relayPage.screenshot({ path: join(SHOTS, '18-relay-pairing.png') });
    const rPad = await ctx.newPage();
    watch(rPad, 'relay-pad');
    await rPad.setViewport(PHONE);
    // the LAN address may not be reachable from here: open the same path on the relay's own host
    const u = new URL(rUrl);
    await rPad.goto(`${new URL(RELAY).origin}${u.pathname}${u.hash}`, { waitUntil: 'networkidle0' });
    await relayPage.bringToFront();
    await relayPage.waitForFunction(() => document.querySelector('.k-pair-status')?.dataset.ok === 'true', { timeout: 20_000 });
    await clickText('.k-sheet button', 'Dalej', relayPage);
    await clickText('.k-layer button', 'Graj bez opaski', relayPage).catch(() => undefined);
    await startRobot(rPad);
    await relayPage.waitForSelector('.k-layer .k-summary', { timeout: 150_000 });
    await relayPage.screenshot({ path: join(SHOTS, '19-relay-summary.png') });
    await rPad.screenshot({ path: join(SHOTS, '19-relay-pad.png') });
    await stopRobot(rPad);
    console.log('  relay session finished');
  }

  step('other languages: home at phone width');
  for (const lang of ['en', 'de', 'sv']) {
    const p = await ctx.newPage();
    watch(p, lang);
    await p.setViewport(PHONE);
    await p.goto(`${origin}/?lang=${lang}#karty`, { waitUntil: 'networkidle0' });
    await p.waitForSelector('#view-karty .k-module');
    await sleep(600);
    await p.screenshot({ path: join(SHOTS, `20-home-${lang}.png`), fullPage: true });
    await overflow(`cards home (${lang}, phone)`, p);
    await p.goto(`${origin}/?lang=${lang}#karty/gra/obie`, { waitUntil: 'networkidle0' });
    await p.waitForSelector('#view-karty .k-start');
    await overflow(`lobby (${lang}, phone)`, p);
    await p.close();
  }
} catch (e) {
  failed = true;
  console.error(`✗ ${e instanceof Error ? e.stack : e}`);
} finally {
  await browser.close();
  server.close();
}
// the HolyHolyHoly games are built by `npm run build` (not by `vite build` alone): their tiles' art may be missing
const real = errors.filter(e => !/\/holyholyholy(3d)?\//.test(e) && !/Failed to load resource: the server responded with a status of 404/.test(e) || /\/cards\//.test(e));
if (real.length) {
  console.error(`✗ ${real.length} error(s):\n  ${real.join('\n  ')}`);
  failed = true;
}
console.log(failed ? '✗ cards smoke failed' : `✓ cards smoke passed (${((Date.now() - t0) / 1000).toFixed(0)} s) — screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
