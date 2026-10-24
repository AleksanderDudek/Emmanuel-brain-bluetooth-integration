#!/usr/bin/env node
/**
 * End-to-end smoke test of the BrainLink app (dist/) in headless Chrome, on the simulators:
 * the first run (choose fNIRS, use the simulator, wait for the baseline), a short focus
 * training from the mood check to its summary and the result on Start and in Sesje, the
 * balance trainer, the signal view, every arcade game from its lobby through a simulated session
 * to its summary, both HolyHolyHoly games inside the app receiving the app's frames,
 * then a switch to EEG and its signal view. Every view is checked at desktop and phone width
 * for horizontal overflow. Fails on any page error, console error or failed request.
 *
 *   npm run build && npm run app:smoke        (CHROME_PATH=… to choose the browser; BASE_PATH=/repo/
 *                                             when the build was made for a sub-path, as on GitHub Pages)
 *
 * Screenshots land in web/.smoke/ (git-ignored).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WEB, 'dist');
const SHOTS = join(WEB, '.smoke');
// the build's base path (GitHub Pages: /<repo>/): the server answers under it, like the real host
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.map': 'application/json',
};

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH');
  return found;
}

function serve(root) {
  const server = createServer((req, res) => {
    let file;
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!path.startsWith(BASE)) throw new Error('outside the base path');
      path = normalize(`/${path.slice(BASE.length)}`);
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
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: DESKTOP,
  protocolTimeout: 300_000,
});
const errors = [];
let failed = false;
try {
  const ctx = await browser.createBrowserContext();   // a fresh profile: first run
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('dialog', d => void d.accept());   // confirm() when ending a session, switching tools

  const shot = (name, fullPage = false) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage });
  // #gra/holyholyholy* opens the game layer over Gry; #gra/<arcade id> is that game's lobby
  const viewOf = hash => (hash.startsWith('trening/') ? hash.split('/')[1]
    : hash.startsWith('gra/') ? (hash.startsWith('gra/holyholyholy') ? 'gry' : 'arcade') : hash);
  const go = async hash => {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForFunction(v => !document.getElementById(`view-${v}`)?.hidden, {}, viewOf(hash));
    await sleep(650);   // the reveal animation
  };
  const text = sel => page.evaluate(s => document.querySelector(s)?.textContent ?? '', sel);
  const clickText = (sel, label) => page.evaluate((s, l) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l).click(), sel, label);
  const overflow = async label => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
    if (o.sw > o.w + 1) throw new Error(`${label}: page scrolls sideways (${o.sw} > ${o.w})`);
  };

  step('first run: Start asks for a band');
  // the smoke clicks Polish labels: pin the language (the other languages get their own pass below)
  await page.goto(`${origin}${BASE}?debug&trainingSec=40&lang=pl`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#toolPick:not([hidden])');
  await shot('01-start-first-run');
  await overflow('start');

  step('choose fNIRS, use the simulator');
  await page.click('[data-pick="fnirs"]');
  await page.waitForFunction(() => document.body.dataset.tool === 'fnirs' && !document.getElementById('nextStep').hidden);
  await clickText('#nextActions button', 'Użyj symulatora');
  await page.waitForFunction(() => /linia bazowa|sygnał/.test(document.getElementById('chipMeta').textContent));
  await shot('02-start-baseline');
  await page.waitForFunction(() => document.getElementById('chipMeta').textContent.includes('sygnał dobry'), { timeout: 40_000 });
  await shot('03-start-ready', true);
  const startGames = await page.evaluate(() => document.querySelectorAll('#gameTiles .tile').length);
  const arcadeIds = await page.evaluate(() => [...document.querySelectorAll('#gameTiles .tile')].map(t => t.getAttribute('href').replace('#gra/', ''))
    .filter(id => !id.startsWith('holyholyholy')));
  if (startGames !== 2 + arcadeIds.length || arcadeIds.length < 3) throw new Error(`Start should offer every game, found ${startGames} (${arcadeIds})`);

  step('Trening hub');
  await go('trening');
  await shot('04-trening', true);
  await overflow('trening');

  step('focus training: setup');
  await go('trening/focus');
  await page.waitForFunction(() => !document.getElementById('btnFocusStart').disabled);
  await shot('05-focus-setup');
  await overflow('focus setup');

  step('focus training: mood, breath, calibration');
  await page.click('#btnFocusStart');
  await page.waitForSelector('.immersive .faces');
  await page.click('.face:nth-child(4)');
  await page.click('.words .btn:nth-child(3)');
  await shot('06-mood');
  await clickText('.immersive .btn', 'Dalej');
  await page.waitForSelector('.immersive .breath');
  await sleep(2500);
  await shot('07-breath');
  await sleep(22_500);   // longer than the 20 s calibration window: the signal must not be used before the calibration screen
  if (!(await page.$('.immersive .breath')) || await page.$('.immersive .game')) throw new Error('the training left the breathing screen by itself');
  await clickText('.immersive .btn', 'Pomiń');
  await page.waitForSelector('.immersive .calib-brain');
  await sleep(4000);
  await shot('08-calibration');

  step('focus training: the game (simulated focus)');
  await page.waitForSelector('.immersive .game canvas', { timeout: 40_000 });
  await page.click('.sim-focus');
  await sleep(16_000);   // the haemodynamic response takes seconds to rise
  const hud = await page.evaluate(() => [...document.querySelectorAll('.hud-nums b')].map(b => b.textContent));
  console.log(`  HUD: tlen ${hud[0]}, aktywność ${hud[1]}, kontrola ${hud[2]}`);
  if (!(Number(hud[0]) > 0)) throw new Error(`no points earned while the simulator "focused" (HUD ${hud})`);
  await shot('09-game');
  await page.setViewport({ width: 844, height: 390 });   // (isMobile/hasTouch would reload the page)
  await sleep(1200);
  await shot('10-game-phone-landscape');
  await page.setViewport(DESKTOP);

  step('focus training: summary');
  await page.waitForSelector('.immersive .summary', { timeout: 60_000 });
  await sleep(800);
  await shot('11-summary');
  console.log(`  summary: ${await text('.summary h2')} · ${await text('.summary .ring b')}/100`);
  await clickText('.summary .btn', 'Gotowe');
  await page.waitForFunction(() => !document.getElementById('today').hidden && !document.getElementById('view-start').hidden);
  await sleep(700);
  await shot('12-start-today', true);

  step('Sesje lists the result');
  await go('sesje');
  await page.waitForSelector('#trainingList .session.training');
  await shot('13-sesje');

  step('balance trainer and signal view');
  await go('trening/balance');
  await shot('14-balance');
  await go('sygnal');
  await sleep(1200);
  await shot('15-sygnal-fnirs');
  await overflow('sygnal');

  step('device sheet');
  await page.click('#devChip');
  await page.waitForSelector('#deviceSheet[open]');
  await sleep(400);
  await shot('16-device-sheet');
  await page.click('#sheetClose');

  step('Gry');
  await go('gry');
  await page.waitForFunction(() => document.getElementById('gamesStatus').textContent.includes('symulatora'));
  await shot('16b-gry', true);

  // the arcade games: lobby → calibration (the first one) → play on the simulator → summary → Sesje
  for (const [i, id] of arcadeIds.entries()) {
    step(`arcade game ${id}: lobby`);
    await go(`gra/${id}`);
    await page.waitForFunction(() => !document.getElementById('btnArcadePlay').disabled, { timeout: 30_000 });
    await sleep(900);
    await shot(`30-${id}-lobby`);
    await overflow(`lobby ${id}`);
    step(`arcade game ${id}: calibration and play`);
    await page.click('#btnArcadePlay');
    await page.waitForSelector('#arcadeLayer:not([hidden]) .arcade canvas');
    if (i === 0) {
      await page.waitForSelector('#arcadeLayer .arcade-card .calib-bar');
      await sleep(3000);
      await shot(`31-${id}-calibration`);
    }
    await page.waitForFunction(() => globalThis.brainlink.arcade.debug?.stage === 'play', { timeout: 60_000 });
    await page.click('#arcadeLayer .sim-focus');
    // generic input: a tap in the middle and Space now and then; the games make progress with it
    const box = await page.evaluate(() => { const r = document.querySelector('#arcadeLayer canvas').getBoundingClientRect(); return { x: r.width / 2, y: r.height * 0.6 }; });
    let tapped = 0;
    const deadline = Date.now() + 22_000;
    while (Date.now() < deadline) {
      await page.mouse.click(box.x, box.y);
      if (tapped++ % 3 === 0) await page.keyboard.press('Space');
      await sleep(650);
    }
    const mid = await page.evaluate(() => globalThis.brainlink.arcade.debug);
    console.log(`  ${id}: t ${mid.t.toFixed(0)} s, focus ${mid.level.toFixed(2)}, score ${mid.outcome?.score} ${mid.outcome?.unit}`);
    await shot(`32-${id}-play`);
    if (!(mid.outcome && mid.outcome.score > 0)) throw new Error(`${id}: no score after 22 s of simulated focus and taps`);
    await page.setViewport({ width: 390, height: 844 });
    await sleep(900);
    await shot(`33-${id}-play-phone`);
    await page.setViewport(DESKTOP);
    step(`arcade game ${id}: summary`);
    await page.waitForSelector('#arcadeLayer .arcade-summary', { timeout: 90_000 });
    await sleep(800);
    await shot(`34-${id}-summary`);
    console.log(`  summary: ${await text('#arcadeLayer .arcade-big')} · ${await text('#arcadeLayer .summary h2')}`);
    await clickText('#arcadeLayer .btn', 'Gotowe');
    await page.waitForFunction(() => document.getElementById('arcadeLayer').hidden);
    await sleep(500);
    await shot(`35-${id}-lobby-after`, true);
  }
  await go('sesje');
  const gameRows = await page.evaluate(() => [...document.querySelectorAll('#trainingList .session .name')].filter(n => n.textContent.startsWith('Gra ·')).length);
  if (gameRows !== arcadeIds.length) throw new Error(`Sesje should list ${arcadeIds.length} game sessions, found ${gameRows}`);
  await shot('36-sesje-games');

  if (existsSync(join(DIST, 'holyholyholy', 'index.html'))) {
    step("HolyHolyHoly from the Start tile, inside the app, on the app's simulator");
    await go('start');
    await page.click('#gameTiles .tile[href="#gra/holyholyholy"]');
    await page.waitForSelector('#gameLayer:not([hidden]) iframe');
    await page.waitForFunction(() => !document.getElementById('gameLink').textContent.includes('wczytuje'), { timeout: 30_000 });
    const sent0 = await page.evaluate(() => globalThis.brainlink.hub.games.sent);
    await sleep(4000);
    const sent1 = await page.evaluate(() => globalThis.brainlink.hub.games.sent);
    console.log(`  ${await text('#gameLink')} · frames lent ${sent0} → ${sent1}`);
    if (!(sent1 > sent0)) throw new Error('the embedded game took no frames from the app');
    await shot('17-game-holyholyholy');
    await page.click('#gameClose');
    await page.waitForFunction(() => document.getElementById('gameLayer').hidden);
  } else console.log('  (dist/holyholyholy not built: skipped the game)');

  if (existsSync(join(DIST, 'holyholyholy3d', 'index.html'))) {
    step("HolyHolyHoly 3D (GDevelop) inside the app");
    await go('gra/holyholyholy3d');
    await page.waitForFunction(() => globalThis.brainlink.hub.games.connected, { timeout: 120_000 });
    const sent0 = await page.evaluate(() => globalThis.brainlink.hub.games.sent);
    await sleep(5000);
    const sent1 = await page.evaluate(() => globalThis.brainlink.hub.games.sent);
    console.log(`  ${await text('#gameLink')} · frames lent ${sent0} → ${sent1}`);
    if (!(sent1 > sent0)) throw new Error('the GDevelop game took no frames from the app');
    await shot('17b-game-holyholyholy3d');
    await page.click('#gameClose');
    await page.waitForFunction(() => document.getElementById('gameLayer').hidden);
  }

  step('switch to EEG, simulator, signal view');
  await page.click('.toolswitch [data-tool="eeg"]');
  await page.waitForFunction(() => document.body.dataset.tool === 'eeg');
  await page.click('#devChip');
  await page.waitForSelector('#deviceSheet[open]');
  await page.click('#sourcePick [data-src="simulator"]');
  await page.waitForSelector('#simCard:not([hidden]) [data-sim="focus"]');
  await page.click('#simStates [data-sim="focus"]');
  await page.click('#sheetClose');
  await go('sygnal');
  await page.waitForFunction(() => document.getElementById('chipMeta').textContent.includes('sygnał'), { timeout: 20_000 });
  await sleep(2500);
  await shot('18-sygnal-eeg', true);
  console.log(`  EEG simulator "focus": skupienie ${await text('#eegStats .stat .v span')}%`);
  await go('start');
  await shot('19-start-eeg');

  step('phone width: every view');
  await page.setViewport(PHONE);
  for (const v of ['start', 'trening', 'trening/focus', 'gry', ...arcadeIds.map(id => `gra/${id}`), 'sygnal', 'sesje', 'ustawienia']) {
    await go(v);
    await overflow(`phone ${v}`);
    await shot(`20-phone-${v.replace('/', '-')}`, true);
  }
  await page.setViewport(DESKTOP);
  await go('ustawienia');
  await shot('21-ustawienia');
} catch (e) {
  failed = true;
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
} finally {
  await browser.close();
  server.close();
}
const real = errors.filter(e => !/favicon/.test(e));
if (real.length) {
  failed = true;
  console.error('✗ errors in the page:');
  for (const e of real) console.error(`  ${e}`);
}
if (failed) process.exit(1);
console.log(`✓ app smoke passed — screenshots in ${relative(process.cwd(), SHOTS) || SHOTS}`);
