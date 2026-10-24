#!/usr/bin/env node
/**
 * Look at one arcade game while working on it: headless Chrome opens the app from a running Vite
 * dev server, picks fNIRS on the simulator, starts the game from its lobby, plays it with the
 * simulator's focus switch and generic taps (like scripts/app-smoke.mjs), and saves screenshots
 * of the lobby, the calibration intro, play (desktop, phone portrait and landscape) and the summary.
 *
 *   npx vite --port 5181 --strictPort &            (one dev server per game is fine)
 *   node scripts/arcade-shot.mjs --port 5181 --game <id> --out /tmp/shots [--sec 40] [--focus on|off|toggle] [--lang pl|en|de|sv]
 *
 * Prints the game's debug state every few seconds and fails on page errors.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const port = arg('port', '5173');
const game = arg('game');
const out = arg('out', '.smoke/arcade');
// the app ignores ?trainingSec below 10 (it would play a full-length session), so neither do we go there
const sec = Math.max(10, Number(arg('sec', '40')) || 40);
const focus = arg('focus', 'toggle');
// the script clicks Polish labels on the way in; --lang switches the language for the game itself
const lang = arg('lang', 'pl');
if (!game) {
  console.error('usage: node scripts/arcade-shot.mjs --port <dev server port> --game <id> --out <dir>');
  process.exit(2);
}
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(p => existsSync(p));
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`);

const browser = await puppeteer.launch({
  executablePath: chrome, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 800 },
  protocolTimeout: 180_000,
});
const errors = [];
let code = 0;
try {
  const page = await (await browser.createBrowserContext()).newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('dialog', d => void d.accept());
  const shot = name => page.screenshot({ path: join(out, `${game}-${name}.png`) });
  const state = () => page.evaluate(() => globalThis.brainlink?.arcade?.debug ?? null);

  await page.goto(`http://localhost:${port}/?debug&trainingSec=${sec}&lang=${lang}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-pick="fnirs"]');
  await page.click('[data-pick="fnirs"]');
  await page.waitForFunction(() => !document.getElementById('nextStep').hidden);
  await page.evaluate(() => globalThis.brainlink.hub.useSimulator());
  await page.waitForFunction(() => globalThis.brainlink.hub.status.signal.reliable, { timeout: 40_000 });
  log('simulator ready');
  await page.evaluate(id => { location.hash = `gra/${id}`; }, game);
  await page.waitForFunction(() => !document.getElementById('btnArcadePlay').disabled, { timeout: 30_000 });
  await sleep(1200);
  await shot('1-lobby');
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  await page.screenshot({ path: join(out, `${game}-1b-lobby-phone.png`), fullPage: true });
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (sideways > 1) errors.push(`the phone lobby scrolls sideways by ${sideways} px`);
  await page.setViewport({ width: 1280, height: 800 });
  await sleep(400);
  await page.click('#btnArcadePlay');
  await page.waitForSelector('#arcadeLayer:not([hidden]) .arcade canvas');
  await sleep(4000);
  await shot('2-calibration');
  await page.waitForFunction(() => globalThis.brainlink.arcade.debug?.stage === 'play', { timeout: 60_000 });
  log('playing');
  if (focus !== 'off') await page.click('#arcadeLayer .sim-focus');
  const box = await page.evaluate(() => { const r = document.querySelector('#arcadeLayer canvas').getBoundingClientRect(); return { x: r.width / 2, y: r.height * 0.6 }; });
  let n = 0, shots = 0;
  const end = Date.now() + (sec - 6) * 1000;
  while (Date.now() < end) {
    await page.mouse.click(box.x, box.y);
    if (n % 3 === 0) await page.keyboard.press('Space');
    if (focus === 'toggle' && n > 0 && n % 30 === 0) await page.click('#arcadeLayer .sim-focus');   // ~20 s blocks
    if (n % 8 === 0) {
      const s = await state();
      if (s) log(`t ${s.t.toFixed(1)} · focus ${s.level.toFixed(2)}${s.reliable ? '' : ' (unreliable)'} · ${s.outcome?.score} ${s.outcome?.unit} · ${JSON.stringify(s.outcome?.stats ?? [])}`);
    }
    if (n === 12 || n === 34) await shot(`3-play-${++shots}`);
    if (n === 20) {
      await page.setViewport({ width: 390, height: 844 });
      await sleep(700);
      await shot('4-play-phone');
      await page.setViewport({ width: 844, height: 390 });
      await sleep(700);
      await shot('5-play-phone-landscape');
      await page.setViewport({ width: 1280, height: 800 });
      await sleep(300);
    }
    n++;
    await sleep(650);
  }
  await page.waitForSelector('#arcadeLayer .arcade-summary', { timeout: 90_000 });
  await sleep(900);
  await shot('6-summary');
  log(`summary: ${await page.evaluate(() => document.querySelector('#arcadeLayer .arcade-big')?.textContent)}`);
  await page.evaluate(() => [...document.querySelectorAll('#arcadeLayer .arcade-again .btn')].at(-1).click());   // "Gotowe" in any language
  await sleep(800);
  await page.screenshot({ path: join(out, `${game}-7-lobby-after.png`), fullPage: true });
} catch (e) {
  code = 1;
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
} finally {
  await browser.close();
}
if (errors.length) {
  code = 1;
  console.error('✗ errors in the page:\n  ' + errors.join('\n  '));
}
console.log(code ? '✗ failed' : `✓ screenshots in ${out}`);
process.exit(code);
