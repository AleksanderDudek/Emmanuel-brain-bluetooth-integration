#!/usr/bin/env node
/**
 * The app works offline (DESIGN.md §16): headless Chrome loads the build (dist/) once online, lets the service
 * worker take over, picks Mendi on the simulator and downloads the separate packs (both HolyHolyHoly games and the
 * exercise cards) from Ustawienia → Praca offline.  Then the server goes away for real — every network request
 * fails — and the app reloads and is walked: Start, Trening, every arcade game's lobby (each game is its own chunk),
 * one game played for a few seconds, the knowledge article, the cards with their images, and both embedded games
 * inside the app.  Last, the 3D game is removed again and opening it offline must show the plain note, not the
 * browser's error page.  Fails on any page error.
 *
 *   npm run build && npm run offline:smoke          (BASE_PATH=/repo/ for a sub-path build, as app:smoke)
 *
 * Screenshots in web/.smoke/offline-*.png.
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
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.map': 'application/json',
  '.jpg': 'image/jpeg', '.txt': 'text/plain',
};
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find(p => existsSync(p));
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');

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
if (!existsSync(join(DIST, 'index.html')) || !existsSync(join(DIST, 'offline-files.json'))) {
  console.error('No full build found (dist/index.html, dist/offline-files.json): run npm run build first.');
  process.exit(1);
}
await mkdir(SHOTS, { recursive: true });
const server = await serve(DIST);
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: chrome, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900 },
  protocolTimeout: 300_000,
});
const errors = [];
let failed = false;
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('dialog', d => void d.accept());
  // the console's last lines, printed when something fails
  const consoleTail = [];
  page.on('console', m => { consoleTail.push(`${m.type()}: ${m.text()}`); if (consoleTail.length > 30) consoleTail.shift(); });
  page.on('requestfailed', r => { consoleTail.push(`failed: ${r.url()} ${r.failure()?.errorText}`); if (consoleTail.length > 30) consoleTail.shift(); });
  globalThis.__tail = consoleTail;
  globalThis.__page = page;
  const shot = name => page.screenshot({ path: join(SHOTS, `offline-${name}.png`) });
  const go = async (hash, view) => {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForFunction(v => !document.getElementById(`view-${v}`)?.hidden, {}, view);
    await sleep(500);
  };

  step('online: load, let the service worker take over');
  await page.goto(`${origin}${BASE}?lang=pl`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }
  step('online: Mendi on the simulator');
  await page.click('[data-pick="fnirs"]');
  await page.waitForFunction(() => document.body.dataset.tool === 'fnirs' && !document.getElementById('nextStep').hidden);
  await page.evaluate(() => [...document.querySelectorAll('#nextActions button')].find(b => b.textContent.trim() === 'Użyj symulatora').click());
  await page.waitForFunction(() => document.getElementById('chipMeta').textContent.includes('sygnał dobry'), { timeout: 60_000 });

  step('online: Ustawienia → Praca offline → download everything');
  await go('ustawienia', 'ustawienia');
  await page.waitForFunction(() => document.querySelectorAll('#offlineCard .off-pack').length >= 3, { timeout: 30_000 });
  const packs = await page.evaluate(() => document.querySelectorAll('#offlineCard .off-pack').length);
  await page.evaluate(() => [...document.querySelectorAll('#offlineCard .btn.primary')].find(b => b.textContent.startsWith('Pobierz wszystko'))?.click());
  await page.waitForFunction(n => document.querySelectorAll('#offlineCard .off-pack.got').length === n, { timeout: 240_000, polling: 500 }, packs);
  await shot('1-settings');
  console.log(`  ${await page.evaluate(() => [...document.querySelectorAll('#offlineCard .off-pack')].map(li => li.textContent).join(' | '))}`);

  step('offline: the server is gone, the page reloads');
  await new Promise(r => { server.close(r); server.closeAllConnections(); });
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('.view:not([hidden])'));
  await go('start', 'start');
  if (await page.evaluate(() => navigator.onLine)) throw new Error('the page still thinks it is online');
  await shot('2-start');

  step('offline: Trening, Gry, Sygnał, Sesje');
  for (const v of ['trening', 'gry', 'sygnal', 'sesje']) await go(v, v);

  step('offline: every arcade game\'s lobby loads its chunk');
  const ids = await page.evaluate(() => [...document.querySelectorAll('#gameTiles .tile')].map(t => t.getAttribute('href').replace('#gra/', ''))
    .filter(id => !id.startsWith('holyholyholy')));
  if (ids.length < 30) throw new Error(`only ${ids.length} arcade games on Start`);
  for (const id of ids) {
    await go(`gra/${id}`, 'arcade');
    await page.waitForFunction(() => {
      const body = document.getElementById('arcadeProgressBody');
      return body && body.children.length > 0 && !/Wczytuję/.test(body.textContent);
    }, { timeout: 30_000 });
  }
  console.log(`  ${ids.length} lobbies`);

  step('offline: one game played for a while');
  const playId = ids.includes('koty') ? 'koty' : ids[0];
  await go(`gra/${playId}`, 'arcade');
  await page.waitForFunction(() => !document.getElementById('btnArcadePlay').disabled, { timeout: 60_000 });
  await page.click('#btnArcadePlay');
  await page.waitForSelector('#arcadeLayer canvas');
  await sleep(12_000);
  await shot('3-game');
  await page.keyboard.press('Escape');
  await sleep(600);
  await page.evaluate(() => [...document.querySelectorAll('#arcadeLayer .btn')].find(b => /Porzuć|Zakończ/.test(b.textContent))?.click());
  await sleep(1500);

  if (await page.evaluate(() => !!document.getElementById('view-wiedza'))) {
    step('offline: the knowledge article');
    await go('wiedza', 'wiedza');
    await page.waitForFunction(() => (document.getElementById('view-wiedza')?.textContent ?? '').length > 2000, { timeout: 30_000 });
    await shot('4-wiedza');
  }

  step('offline: exercise cards with their images');
  await go('karty', 'karty');
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#view-karty img')];
    return imgs.length > 0 && imgs.slice(0, 6).every(i => i.complete && i.naturalWidth > 0);
  }, { timeout: 30_000 });
  await shot('5-cards');

  for (const g of ['holyholyholy3d', 'holyholyholy']) {
    step(`offline: ${g} inside the app`);
    await go(`gra/${g}`, 'gry');
    await page.waitForSelector('#gameFrame iframe');
    const frameEl = await page.$('#gameFrame iframe');
    const frame = await frameEl.contentFrame();
    await frame.waitForFunction(() => document.readyState === 'complete' && document.body && document.body.children.length > 0, { timeout: 60_000 });
    await sleep(g === 'holyholyholy3d' ? 8000 : 3000);
    if (await page.$('#gameFrame .game-offline')) throw new Error(`${g}: the offline note showed although it was downloaded`);
    const title = await frame.evaluate(() => document.title);
    console.log(`  ${g}: "${title}"`);
    await shot(`6-${g}`);
    await page.click('#gameClose');
    await sleep(500);
  }

  step('offline: a removed game says so plainly');
  await go('ustawienia', 'ustawienia');
  await page.waitForFunction(() => document.querySelectorAll('#offlineCard .off-pack.got').length >= 1);
  await page.evaluate(() => document.querySelector('#offlineCard .off-pack .btn.ghost')?.click());   // the first pack: the 3D game
  await page.waitForFunction(() => !document.querySelector('#offlineCard .off-pack')?.classList.contains('got'));
  await go('gra/holyholyholy3d', 'gry');
  await page.waitForSelector('#gameFrame .game-offline', { timeout: 15_000 });
  await shot('7-missing');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('✓ the app works offline');
} catch (e) {
  failed = true;
  console.error(`✗ ${e.message}`);
  if (globalThis.__tail?.length) console.error(`console:\n  ${globalThis.__tail.join('\n  ')}`);
  await globalThis.__page?.screenshot({ path: join(SHOTS, 'offline-failed.png') }).catch(() => undefined);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
