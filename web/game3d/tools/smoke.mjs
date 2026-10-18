#!/usr/bin/env node
/**
 * End-to-end smoke test of the exported game in headless Chrome: the title loads its content,
 * a chapter is played through (a level-up gift, a Samson strike, a tongue of fire, three short
 * waves, the stronghold), the revelation saves the progress, and the Tree opens the next sphere.
 * Fails on any page error or console error.
 *
 *   npm run game3d:export && npm run game3d:smoke     (CHROME_PATH=… to choose the browser)
 *
 * Input goes through GDevelop's own keyboard handlers (document.onkeydown/onkeyup), the same path
 * a real key press takes, so the test does not depend on window focus in a headless browser.
 * Screenshots land in web/game3d/.smoke/ (git-ignored).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';
import puppeteer from 'puppeteer-core';
import { EXPORT_DIR, GAME3D } from './paths.mjs';

const SHOTS = join(GAME3D, '.smoke');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.css': 'text/css' };

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

const step = (name) => console.log(`• ${name}`);

if (!existsSync(join(EXPORT_DIR, 'index.html'))) {
  console.error('No export found: run npm run game3d:export first.');
  process.exit(1);
}
await mkdir(SHOTS, { recursive: true });
const server = await serve(EXPORT_DIR);
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=960,540'],
  defaultViewport: { width: 960, height: 540 },
  protocolTimeout: 400_000,
});
const errors = [];
let failed = false;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(180_000);
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });

  // helpers that run in the page
  await page.waitForFunction(() => window.HolyHolyHoly3D?.game?.getSceneStack().getCurrentScene(), { timeout: 60_000 });
  await page.evaluate(() => {
    const h = (window.HHH = {});
    h.game = window.HolyHolyHoly3D.game;
    h.scene = () => h.game.getSceneStack().getCurrentScene();
    h.v = name => h.scene().getVariables().get(name);
    h.g = name => h.game.getVariables().get(name);
    h.wait = ms => new Promise(r => setTimeout(r, ms));
    h.frames = n => new Promise(resolve => {
      const tick = () => (--n <= 0 ? resolve() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    // held for a few frames, so the game sees it as pressed even when headless rendering is slow
    h.press = async (keyCode, code) => {
      const event = { keyCode, code, location: 0, repeat: false, target: document.body, metaKey: false, preventDefault() {} };
      document.onkeydown(event);
      await h.frames(3);
      document.onkeyup(event);
      await h.frames(2);
    };
    h.snapshot = () => {
      const scene = h.scene();
      const out = { scene: scene.getName(), fps: Math.round(1000 / Math.max(1, scene.getTimeManager().getElapsedTime())) };
      for (const name of ['State', 'Wave', 'WaveTime', 'Still', 'Hearts', 'Flames']) {
        try { out[name] = scene.getVariables().get(name).getValue(); } catch { /* not in this scene */ }
      }
      out.run = h.g('Run').toJSObject();
      out.traumas = Object.keys(scene._instances.items || {}).filter(n => n.startsWith('Trauma_')).reduce((n, k) => n + scene.getObjects(k).length, 0);
      return out;
    };
    h.until = async (test, ms = 20_000) => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        if (test()) return true;
        await h.wait(100);
      }
      return false;
    };
  });
  const check = async (name, fn, ...args) => {
    const result = await page.evaluate(fn, ...args);
    const ok = typeof result === 'object' && result !== null ? result.ok : result;
    if (!ok) throw new Error(`failed: ${name}\n  result: ${JSON.stringify(result)}\n  state: ${JSON.stringify(await page.evaluate(() => window.HHH.snapshot()))}`);
    step(name);
  };

  await page.waitForFunction(() => window.HHH.g('Content').getChild('chapters').getChildrenCount() === 12, { timeout: 30_000 });
  await check('title scene with the content loaded', () => window.HHH.scene().getName() === 'Title');
  await page.screenshot({ path: join(SHOTS, '1-title.png') });

  // a fresh save, short waves for the test
  await page.evaluate(() => {
    const h = window.HHH;
    localStorage.removeItem('holyholyholy3d.save.v1');
    h.g('Save').getChild('settings').getChild('effects').setBoolean(false); // light graphics: headless rendering is slow
    h.g('Tuning').getChild('waveSeconds').setNumber(40);
    h.g('Run').getChild('chapter').setNumber(0);
    h.game.getSceneStack().replace('Arena', true);
  });
  await check('arena starts with the chapter card', async () => {
    const h = window.HHH;
    await h.wait(500);
    return h.scene().getName() === 'Arena' && h.v('State').getAsString() === 'intro';
  });
  await check('a key starts the fight', async () => {
    const h = window.HHH;
    await h.until(() => h.v('StateT').getAsNumber() > 0.9, 10_000);
    await h.press(13, 'Enter');
    return h.until(() => h.v('State').getAsString() === 'play', 3000);
  });
  await check('standing still, the Word destroys traumas and their light is collected', async () => {
    const h = window.HHH;
    return h.until(() => h.g('Run').getChild('destroyed').getAsNumber() >= 2 && h.g('Run').getChild('light').getAsNumber() > 0, 60_000);
  });
  await check('standing still is focus: it charges the Fire of the Spirit without a band', async () => {
    const h = window.HHH;
    const before = h.v('Flames').getAsNumber();
    await h.until(() => window.MendiFocus.source() === 'still' && window.MendiFocus.focused(), 10_000);
    await h.wait(1500);
    return { ok: window.MendiFocus.source() === 'still' && h.v('Flames').getAsNumber() > before, source: window.MendiFocus.source(), before, after: h.v('Flames').getAsNumber() };
  });
  await page.screenshot({ path: join(SHOTS, '2-arena.png') });
  await check('a level brings 1 of 3 gifts, chosen with a key', async () => {
    const h = window.HHH;
    h.v('Xp').setNumber(h.v('XpNext').getAsNumber() + 1);
    if (!(await h.until(() => h.v('State').getAsString() === 'levelup', 3000))) return false;
    const before = JSON.stringify(h.g('Run').getChild('gifts').toJSObject());
    await h.press(49, 'Digit1');
    return (await h.until(() => h.v('State').getAsString() === 'play', 3000)) && JSON.stringify(h.g('Run').getChild('gifts').toJSObject()) !== before;
  });
  await check('Samson strikes a trauma in reach and builds a combo; a strike at nothing breaks it', async () => {
    const h = window.HHH;
    h.v('XpNext').setNumber(1e9);
    const kinds = ['Trauma_lek', 'Trauma_samotnosc', 'Trauma_odrzucenie'];
    const traumas = () => kinds.flatMap(k => h.scene().getObjects(k));
    await h.until(() => traumas().length > 0, 8000);
    const p = h.scene().getObjects('Player')[0];
    const t = traumas()[0];
    t.getVariables().get('Hp').setNumber(9999);
    // gifts such as the Shield of Faith may push it away: put it back in reach until a strike lands
    let hit = 0;
    for (let attempt = 0; attempt < 8 && hit < 1; attempt++) {
      for (const other of traumas()) if (other !== t) other.setX(p.getX() + 1500);
      t.setPosition(p.getX() + 100, p.getY());
      t.getVariables().get('KnockT').setNumber(0);
      await h.until(() => h.v('StrikeCD').getAsNumber() <= 0, 3000);
      await h.press(32, 'Space');
      hit = h.v('Combo').getAsNumber();
    }
    for (const any of traumas()) any.setX(p.getX() + 1500);
    await h.until(() => h.v('StrikeCD').getAsNumber() <= 0, 3000);
    await h.press(32, 'Space');
    const after = h.v('Combo').getAsNumber();
    const best = h.g('Run').getChild('bestCombo').getAsNumber();
    return { ok: hit >= 1 && after === 0 && best >= 1, hit, after, best };
  });
  await check('a flame of the Fire of the Spirit becomes a tongue of fire', async () => {
    const h = window.HHH;
    h.v('Flames').setNumber(1.2);
    await h.press(69, 'KeyE');
    return h.v('Flames').getAsNumber() < 1;
  });
  await check('three waves, each followed by a Sabbath, lead to the stronghold', async () => {
    const h = window.HHH;
    h.g('Tuning').getChild('waveSeconds').setNumber(4);
    h.v('WaveTime').setNumber(0.5);
    const end = performance.now() + 150_000;
    while (performance.now() < end) {
      h.v('Hearts').setNumber(5);
      if (h.v('State').getAsString() === 'levelup') await h.press(49, 'Digit1');
      if (h.scene().getObjects('Stronghold').length > 0 && h.v('State').getAsString() === 'play') return true;
      await h.wait(150);
    }
    return false;
  });
  await page.screenshot({ path: join(SHOTS, '3-stronghold.png') });
  await check('the stronghold binds itself with chains, then falls', async () => {
    const h = window.HHH;
    h.v('XpNext').setNumber(1e9);
    const boss = () => h.scene().getObjects('Stronghold')[0];
    const max = boss().getVariables().get('MaxHp').getAsNumber();
    boss().getVariables().get('Hp').setNumber(max * 0.6);
    if (!(await h.until(() => h.scene().getObjects('ChainPylon').length === 4, 3000))) return false;
    for (const pylon of h.scene().getObjects('ChainPylon')) pylon.getVariables().get('Hp').setNumber(-1);
    if (!(await h.until(() => boss().getVariables().get('Armor').getAsNumber() > 0, 3000))) return false;
    boss().getVariables().get('Hp').setNumber(-1);
    return h.until(() => h.scene().getName() === 'Revelation', 12_000);
  });
  await check('the revelation saves the progress: chapter done, light and manna', async () => {
    const h = window.HHH;
    await h.wait(1500);
    const saved = JSON.parse(localStorage.getItem('holyholyholy3d.save.v1') || '{}');
    return saved.done?.malkut === true && saved.light > 0 && saved.manna > 0;
  });
  await page.screenshot({ path: join(SHOTS, '4-revelation.png') });
  await check('Enter skips through the pages to the Tree, where the next sphere is open', async () => {
    const h = window.HHH;
    for (let i = 0; i < 4 && h.scene().getName() === 'Revelation'; i++) {
      await h.press(13, 'Enter');
      await h.wait(300);
    }
    if (!(await h.until(() => h.scene().getName() === 'Tree', 5000))) return false;
    await h.wait(800);
    return h.scene().getObjects('OrbDone').length === 1 && h.scene().getObjects('OrbOpen').length === 1;
  });
  await page.screenshot({ path: join(SHOTS, '5-tree.png') });

  const real = errors.filter(e => !/favicon/.test(e));
  if (real.length) throw new Error(`errors in the page:\n${real.join('\n')}`);
  console.log(`✓ smoke test passed — screenshots in ${SHOTS}`);
} catch (error) {
  failed = true;
  console.error(`✗ ${error.message}`);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
