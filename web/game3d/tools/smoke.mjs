#!/usr/bin/env node
/**
 * End-to-end smoke test of the exported game in headless Chrome, the way a new player goes: the
 * safety note, who you protect (a woman), how to play, the prologue, the Ladder, the archangels,
 * the chapter's story, the fight (a true sentence from each broken shadow, a level-up card, a
 * strike, the archangel's prayer, a voice silenced with its negation and truth, healing at a
 * spring, by a word of truth and by a breath, a memory found, the recognition card, three
 * stages, the lie in its own figure, the praise), the healing scene with Christ's own words, the
 * worked thought record, the tool kept in the toolbox, and the breathing practice. Fails on any
 * page error or console error, and on any two texts of a panel that overlap or a text that runs
 * out of its panel (the layout check runs on every screen it photographs).
 *
 *   npm run game3d:export && npm run game3d:smoke     (CHROME_PATH=… to choose the browser,
 *                                                     SMOKE_CPU_THROTTLE=4 to run as slowly as CI,
 *                                                     SMOKE_SLACK=4 to give every wait 4× longer, the
 *                                                     default on CI,
 *                                                     SMOKE_SIZE=864x540 for a 16:10 screen)
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
// SMOKE_SIZE=864x540 plays on a 16:10 screen (the game is 1152×720 there), 720x540 on 4:3
const [viewW, viewH] = (process.env.SMOKE_SIZE || '960x540').split('x').map(Number);
const VIEW = { width: viewW, height: viewH };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.css': 'text/css' };

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
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', `--window-size=${VIEW.width},${VIEW.height}`],
  defaultViewport: VIEW,
  protocolTimeout: 400_000,
});
const errors = [];
let failed = false;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(180_000);
  // SMOKE_CPU_THROTTLE=4 runs the game as slowly as a CI runner does
  if (Number(process.env.SMOKE_CPU_THROTTLE) > 1) await page.emulateCPUThrottling(Number(process.env.SMOKE_CPU_THROTTLE));
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
      for (const name of ['State', 'Wave', 'WaveTime', 'Still', 'Hearts', 'Prayer', 'Page', 'Line']) {
        try { out[name] = scene.getVariables().get(name).getValue(); } catch { /* not in this scene */ }
      }
      out.run = h.g('Run').toJSObject();
      out.top = h.g('Ui').getChild('top').getAsString();
      return out;
    };
    // a real mouse click on the button of the top panel with this action (and argument)
    h.click = async (action, arg) => {
      const top = h.g('Ui').getChild('top').getAsString();
      const button = h.scene().getObjects('UiButton').find(b => b.getVariables().get('Action').getAsString() === action
        && b.getVariables().get('Panel').getAsString() === top && (arg === undefined || b.getVariables().get('Arg').getAsNumber() === arg));
      if (!button) return false;
      const input = h.game.getInputManager();
      input.onMouseMove(button.getX() + button.getWidth() / 2, button.getY() + button.getHeight() / 2);
      await h.frames(2);
      input.onMouseButtonPressed(0);
      await h.frames(3);
      input.onMouseButtonReleased(0);
      await h.frames(3);
      return true;
    };
    // holds a key down (released by h.release)
    h.hold = (keyCode, code) => document.onkeydown({ keyCode, code, location: 0, repeat: false, target: document.body, metaKey: false, preventDefault() {} });
    h.release = (keyCode, code) => document.onkeyup({ keyCode, code, location: 0, repeat: false, target: document.body, metaKey: false, preventDefault() {} });
    h.voice = () => ['lek', 'zwatpienie', 'samotnosc'].flatMap(k => h.scene().getObjects(`Enemy_${k}`)).find(t => t.getVariables().get('Voice').getAsBoolean());
    h.keyed = (object, key) => h.scene().getObjects(object).filter(o => o.getVariables().get('Key').getAsString() === key);
    /**
     * The layout of one panel ('' is the HUD): the drawn box of every visible text (from its
     * alignment and rendered width), then every pair that overlaps and every text outside the
     * panel's frame or the screen. World-anchored texts (sentences over shadows) are left out.
     */
    h.layout = panel => {
      const scene = h.scene(), game = h.game;
      const floating = new Set(['truth', 'thought', 'voiceSays', 'lieSays', 'pointerText', 'breathCue', 'banner', 'combo']);
      const boxes = [];
      for (const kind of ['UiText', 'UiSmall', 'UiTitle', 'UiLabel', 'UiBig']) {
        for (const t of scene.getObjects(kind)) {
          const vars = t.getVariables();
          if (vars.get('Panel').getAsString() !== panel || !t.isVisible() || t.getOpacity() < 30 || !t.getText().trim()) continue;
          const key = vars.get('Key').getAsString();
          if (floating.has(key)) continue;
          const tw = t._renderer._text.width, th = t.getHeight();
          const wrap = t.isWrapping() ? t.getWrappingWidth() : tw;
          const f = t.getTextAlignment() === 'right' ? 1 : t.getTextAlignment() === 'center' ? 0.5 : 0;
          boxes.push({ kind, key, text: t.getText().replace(/\s+/g, ' ').slice(0, 48), x: t.getX() + (wrap - tw) * f, y: t.getY(), w: tw, h: th, action: vars.get('Action').getAsString() });
        }
      }
      const pad = 7, issues = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.x + pad < b.x + b.w && b.x + pad < a.x + a.w && a.y + pad < b.y + b.h && b.y + pad < a.y + a.h) issues.push(`overlap: "${a.text}" × "${b.text}"`);
        }
      }
      const W = game.getGameResolutionWidth(), H = game.getGameResolutionHeight();
      const frames = panel ? scene.getObjects('UiPanel').filter(o => o.getVariables().get('Panel').getAsString() === panel) : [];
      for (const b of boxes) {
        if (b.x < -2 || b.y < -2 || b.x + b.w > W + 2 || b.y + b.h > H + 2) issues.push(`off screen: "${b.text}"`);
        if (frames.length && !frames.some(f => b.x >= f.getX() - 4 && b.y >= f.getY() - 4 && b.x + b.w <= f.getX() + f.getWidth() + 4 && b.y + b.h <= f.getY() + f.getHeight() + 4)) issues.push(`outside its panel: "${b.text}"`);
      }
      const buttons = scene.getObjects('UiButton').filter(o => o.getVariables().get('Panel').getAsString() === panel && o.isVisible());
      buttons.forEach((a, i) => buttons.slice(i + 1).forEach(b => {
        if (a.getX() + 2 < b.getX() + b.getWidth() && b.getX() + 2 < a.getX() + a.getWidth() && a.getY() + 2 < b.getY() + b.getHeight() && b.getY() + 2 < a.getY() + a.getHeight()) {
          issues.push(`buttons overlap: ${a.getVariables().get('Action').getAsString()} × ${b.getVariables().get('Action').getAsString()}`);
        }
      }));
      for (const button of buttons) {
        const caption = boxes.find(b => b.kind === 'UiLabel' && b.action === button.getVariables().get('Action').getAsString() && Math.abs(b.y + b.h / 2 - (button.getY() + button.getHeight() / 2)) < 30);
        if (caption && caption.h > button.getHeight() + 2) issues.push(`caption taller than its button: "${caption.text}"`);
      }
      return issues;
    };
    // the waits are in wall-clock time, but the game counts game time, which falls behind when frames are slow
    // (≈20 fps on a shared CI runner): `slack` stretches every wait there
    h.until = async (test, ms = 20_000) => {
      const end = performance.now() + ms * (h.slack ?? 1);
      while (performance.now() < end) {
        let passed = false;
        try { passed = test(); } catch { /* between scenes: nothing to read yet */ }
        if (passed) return true;
        await h.wait(100);
      }
      return false;
    };
  });
  const slack = Number(process.env.SMOKE_SLACK) || (process.env.CI ? 4 : 1);
  await page.evaluate(k => { window.HHH.slack = k; }, slack);
  const check = async (name, fn, ...args) => {
    const result = await page.evaluate(fn, ...args);
    const ok = typeof result === 'object' && result !== null ? result.ok : result;
    if (!ok) throw new Error(`failed: ${name}\n  result: ${JSON.stringify(result)}\n  state: ${JSON.stringify(await page.evaluate(() => window.HHH.snapshot()))}`);
    step(name);
  };
  const layoutIssues = [];
  /** Photographs a screen and checks the layout of the given panels ('' is the HUD). */
  const shot = async (file, panels = [], ms = 0) => {
    if (ms) await page.evaluate(t => window.HHH.wait(t), ms);
    await page.screenshot({ path: join(SHOTS, file) });
    for (const panel of panels) {
      const issues = await page.evaluate(p => window.HHH.layout(p), panel);
      for (const issue of issues) layoutIssues.push(`${file} [${panel || 'HUD'}] ${issue}`);
    }
  };

  await page.waitForFunction(() => window.HHH.g('Content').getChild('chapters').getChildrenCount() === 10, { timeout: 30_000 });
  await check('title scene with the content loaded', () => window.HHH.scene().getName() === 'Title');
  await shot('01-title.png', ['']);

  await check('first launch: the safety note, then who you protect (a woman named Ewa)', async () => {
    const h = window.HHH;
    if (!(await h.until(() => h.g('Ui').getChild('top').getAsString() === 'help', 5000))) return { ok: false, top: h.g('Ui').getChild('top').getAsString() };
    h.g('Save').getChild('settings').getChild('effects').setBoolean(false); // light graphics: headless rendering is slow
    if (!(await h.click('helpDone'))) return { ok: false, step: 'helpDone' };
    if (!(await h.click('play'))) return { ok: false, step: 'play' };
    if (!(await h.until(() => h.g('Ui').getChild('top').getAsString() === 'profile', 3000))) return { ok: false, step: 'profile' };
    if (!(await h.click('gender', 1))) return { ok: false, step: 'gender' };
    await h.frames(5);
    return { ok: h.g('Save').getChild('profile').getChild('gender').getAsString() === 'f' };
  });
  await shot('02-profile.png', ['profile']);
  await check('the profile is kept, how to play is shown, then the prologue', async () => {
    const h = window.HHH;
    if (!(await h.click('profileDone'))) return { ok: false, step: 'profileDone' };
    if (!(await h.until(() => h.g('Ui').getChild('top').getAsString() === 'howto', 3000))) return { ok: false, step: 'howto' };
    if (!(await h.click('howtoDone'))) return { ok: false, step: 'howtoDone' };
    if (!(await h.until(() => h.scene().getName() === 'Story', 8000))) return { ok: false, step: 'story' };
    await h.wait(1500);
    const saved = JSON.parse(localStorage.getItem('holyholyholy3d.save.v2') || '{}');
    return { ok: saved.profile?.set === true && saved.profile?.gender === 'f', profile: saved.profile };
  });
  await shot('03-prologue.png', ['']);
  await check('the prologue reads line by line, in the woman\'s forms, and leads to the Ladder', async () => {
    const h = window.HHH;
    const lines = h.g('Run').getChild('lines').toJSObject();
    const text = lines.map(l => l.text + l.quote + l.panel).join(' ');
    if (/[{}|]/.test(text) || !/Ewa/.test(text)) return { ok: false, lines };
    await h.press(32, 'Space');
    await h.wait(400);
    const line = h.v('Line').getAsNumber();
    await h.press(27, 'Escape');
    return { ok: line === 1 && (await h.until(() => h.scene().getName() === 'Ladder', 8000)), line };
  });
  await shot('04-ladder.png', [''], 1500);
  await check('the first rung is open; entering it leads to the archangels', async () => {
    const h = window.HHH;
    if (h.scene().getObjects('OrbOpen').length !== 1 || h.scene().getObjects('OrbLocked').length !== 9) return { ok: false, open: h.scene().getObjects('OrbOpen').length };
    if (!(await h.click('enter'))) return { ok: false, step: 'enter' };
    return h.until(() => h.scene().getName() === 'Synaxis', 8000);
  });
  await shot('05-synaxis.png', ['info'], 2000);
  await check('Uriel is open, Gabriel can be tried once; choosing Uriel tells the chapter\'s story', async () => {
    const h = window.HHH;
    if (!(await h.click('choose'))) return { ok: false, step: 'choose' };
    if (!(await h.until(() => h.scene().getName() === 'Story', 8000))) return { ok: false, step: 'story' };
    await h.wait(1500);
    return { ok: h.g('Run').getChild('hero').getAsString() === 'uriel' && h.g('Run').getChild('lines').getChildrenCount() >= 3 };
  });
  await shot('06-story-intro.png', ['']);
  await check('the fight starts with the chapter card', async () => {
    const h = window.HHH;
    h.g('Tuning').getChild('stageSeconds').setNumber(60);
    await h.press(27, 'Escape');
    if (!(await h.until(() => h.scene().getName() === 'Arena', 10_000))) return false;
    await h.wait(500);
    return h.v('State').getAsString() === 'intro' && h.scene().getObjects('Hero_uriel').length === 1;
  });
  await check('a key starts the fight', async () => {
    const h = window.HHH;
    await h.until(() => h.v('StateT').getAsNumber() > 0.9, 10_000);
    await h.press(13, 'Enter');
    return h.until(() => h.v('State').getAsString() === 'play', 3000);
  });
  await check('standing still, Uriel\'s flame breaks shadows; each leaves a true sentence and light', async () => {
    const h = window.HHH;
    const ok = await h.until(() => h.g('Run').getChild('destroyed').getAsNumber() >= 2 && h.g('Run').getChild('light').getAsNumber() > 0, 60_000);
    const truths = h.scene().getObjects('UiText').filter(t => t.getVariables().get('Key').getAsString() === 'truth').map(t => t.getText());
    return { ok: ok && h.g('Run').getChild('reframes').getAsNumber() >= 2, truths };
  });
  await shot('07-arena.png', ['']);
  await check('a level brings cards of gifts and virtues; one is chosen with a key', async () => {
    const h = window.HHH;
    h.v('Xp').setNumber(h.v('XpNext').getAsNumber() + 1);
    if (!(await h.until(() => h.v('State').getAsString() === 'levelup', 3000))) return false;
    await h.wait(600);
    return true;
  });
  await shot('08-levelup.png', ['levelup']);
  await check('the chosen card is taken (a slot, a level, or a consumable like manna)', async () => {
    const h = window.HHH;
    // the three cards are random: a gift or virtue fills a slot, a known one levels up, manna takes no slot at all,
    // so count the levels of all gifts — every choice adds one
    const levels = () => Object.values(h.g('Run').getChild('gifts').toJSObject()).reduce((a, b) => a + Number(b), 0);
    const choice = h.g('Run').getChild('choices').getChild(0).getChild('id').getAsString();
    const before = levels();
    await h.press(49, 'Digit1');
    if (!(await h.until(() => h.v('State').getAsString() === 'play', 6000))) return false;
    return { ok: levels() === before + 1, choice, before, after: levels() };
  });
  await check('a strike in reach builds a combo; a strike at nothing breaks it', async () => {
    const h = window.HHH;
    h.v('XpNext').setNumber(1e9);
    const traumas = () => h.scene().getObjects('Enemy_lek').concat(h.scene().getObjects('Enemy_zwatpienie'), h.scene().getObjects('Enemy_samotnosc'));
    await h.until(() => traumas().length > 0, 8000);
    const p = h.scene().getObjects('Player')[0];
    const t = traumas()[0];
    t.getVariables().get('Hp').setNumber(9999);
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
    return { ok: hit >= 1 && h.v('Combo').getAsNumber() === 0, hit };
  });
  await check('a full prayer is prayed with E: Uriel\'s fire from heaven', async () => {
    const h = window.HHH;
    h.v('Prayer').setNumber(100);
    await h.frames(3);
    await h.press(69, 'KeyE');
    return { ok: h.v('Prayer').getAsNumber() < 50 };
  });
  await check('a voice speaks one of the person\'s thoughts aloud, above it', async () => {
    const h = window.HHH;
    h.v('VoiceT').setNumber(0.1);
    if (!(await h.until(() => h.voice(), 8000))) return { ok: false, step: 'no voice' };
    await h.wait(400);
    const says = h.g('Run').getChild('voice').getChild('says').getAsString();
    const label = h.keyed('UiText', 'voiceSays')[0];
    return { ok: says.length > 5 && !!label && label.getText().includes(says), says };
  });
  await shot('09-voice.png', ['']);
  await check('silenced, the thought is crossed out, named, negated, and the truth rises; it leaves a word of truth', async () => {
    const h = window.HHH;
    const voice = h.voice();
    const p = h.scene().getObjects('Player')[0];
    // out of the angel's reach, so the word of truth stays on the ground until it is taken
    voice.setPosition(p.getX() + 650, p.getY());
    voice.getVariables().get('Hp').setNumber(-1);
    // game seconds: on a slow runner (≈20 fps) the game clock runs behind the wall clock, so wait generously
    if (!(await h.until(() => h.v('SilT').getAsNumber() > 3, 25_000))) return { ok: false, step: 'no silenced block', silT: h.v('SilT').getAsNumber() };
    const run = h.g('Run').getChild('voice').toJSObject();
    const texts = ['silSays', 'silPattern', 'silNo', 'silYes'].map(k => h.keyed(k === 'silPattern' ? 'UiSmall' : 'UiText', k)[0]?.getText() ?? '');
    const strike = h.keyed('UiBar', 'silStrike')[0];
    const ok = texts[0].includes(run.says) && texts[1].includes(run.patternName) && texts[2].includes(run.no) && texts[3] === run.yes && strike && strike.getWidth() > 20 && h.scene().getObjects('Truth').length === 1;
    return { ok, texts, strike: strike?.getWidth() };
  });
  await shot('10-silenced.png', ['']);
  await check('healing: a word of truth, a spring of living water, and one breath', async () => {
    const h = window.HHH;
    const p = h.scene().getObjects('Player')[0];
    const far = () => { for (const t of ['lek', 'zwatpienie', 'samotnosc'].flatMap(k => h.scene().getObjects(`Enemy_${k}`))) t.setX(p.getX() + 2500); };
    h.v('Invuln').setNumber(1000);
    h.v('Hearts').setNumber(2);
    const truth = h.scene().getObjects('Truth')[0];
    truth.setPosition(p.getX(), p.getY());
    if (!(await h.until(() => h.v('Hearts').getAsNumber() === 3, 4000))) return { ok: false, step: 'truth', hearts: h.v('Hearts').getAsNumber() };
    const spring = h.scene().getObjects('Spring').find(o => o.getVariables().get('Water').getAsNumber() > 0);
    p.setPosition(spring.getX(), spring.getY());
    far();
    if (!(await h.until(() => h.v('Hearts').getAsNumber() >= 4, 8000))) return { ok: false, step: 'spring', hearts: h.v('Hearts').getAsNumber() };
    p.setPosition(spring.getX() + 900, spring.getY());
    h.v('Hearts').setNumber(2);
    await h.wait(400);
    h.hold(81, 'KeyQ');
    return { ok: await h.until(() => h.v('BreathT').getAsNumber() > 1.5, 4000), breath: h.v('BreathT').getAsNumber() };
  });
  await shot('11-breath.png', ['']);
  await check('the breath completes and gives a heart', async () => {
    const h = window.HHH;
    const healed = await h.until(() => h.v('Hearts').getAsNumber() === 3, 9000);
    h.release(81, 'KeyQ');
    return { ok: healed && h.g('Run').getChild('healed').getAsNumber() >= 3, hearts: h.v('Hearts').getAsNumber(), healed: h.g('Run').getChild('healed').getAsNumber() };
  });
  await check('a memory found on the map tells a piece of the story', async () => {
    const h = window.HHH;
    const p = h.scene().getObjects('Player')[0];
    const memory = h.scene().getObjects('Memory_f')[0];
    if (!memory) return { ok: false, step: 'no memory' };
    p.setPosition(memory.getX(), memory.getY() + 20);
    if (!(await h.until(() => h.g('Run').getChild('memories').getAsNumber() >= 1, 4000))) return { ok: false, step: 'not found' };
    await h.wait(300);
    const text = h.keyed('UiText', 'memory')[0]?.getText() ?? '';
    return { ok: text.length > 20 && !/[{}|]/.test(text), text };
  });
  await shot('12-memory.png', ['']);
  await check('after a stage, the recognition card shows a thought with its answer (nothing to guess)', async () => {
    const h = window.HHH;
    h.v('StageTime').setNumber(0.2);
    if (!(await h.until(() => h.v('State').getAsString() === 'recognize' && h.g('Ui').getChild('top').getAsString() === 'recog', 8000))) return { ok: false, state: h.v('State').getAsString() };
    await h.wait(500);
    const voice = h.g('Run').getChild('voice').toJSObject();
    const texts = h.scene().getObjects('UiText').filter(t => t.getVariables().get('Panel').getAsString() === 'recog').map(t => t.getText());
    return { ok: texts.some(t => t.includes(voice.no)) && texts.some(t => t.includes(voice.yes)), texts };
  });
  await shot('13-recognition.png', ['recog']);
  await check('saying the truth gives a heart, then the next stage begins at another hour', async () => {
    const h = window.HHH;
    const hearts = h.v('Hearts').getAsNumber();
    if (!(await h.click('recogSay'))) return { ok: false, step: 'recogSay' };
    if (!(await h.until(() => h.v('State').getAsString() === 'sabbath', 3000))) return { ok: false, state: h.v('State').getAsString() };
    const healed = h.v('Hearts').getAsNumber() >= Math.min(h.v('MaxHearts').getAsNumber(), hearts + 1);
    if (!(await h.until(() => h.v('Stage').getAsNumber() === 2 && h.v('State').getAsString() === 'play', 9000))) return { ok: false, step: 'stage 2' };
    await h.wait(800);
    const title = h.keyed('UiTitle', 'stageTitle')[0]?.getText() ?? '';
    return { ok: healed && /^\d\d:\d\d · /.test(title), title };
  });
  await shot('14-stage2.png', ['']);
  await check('three stages lead to the lie of the chapter in its own figure', async () => {
    const h = window.HHH;
    h.g('Tuning').getChild('stageSeconds').setNumber(4);
    h.v('StageTime').setNumber(0.5);
    const end = performance.now() + 150_000;
    while (performance.now() < end) {
      h.v('Hearts').setNumber(5);
      const state = h.v('State').getAsString();
      if (state === 'levelup') await h.press(49, 'Digit1');
      if (state === 'recognize' && h.g('Ui').getChild('top').getAsString() === 'recog') await h.click('recogSay');
      if (h.scene().getObjects('Liar').length > 0 && state === 'play') return true;
      await h.wait(150);
    }
    return false;
  });
  await shot('15-liar.png', [''], 1200);
  await check('the lie binds the person with chains, then falls silent; praise; the healing scene', async () => {
    const h = window.HHH;
    h.v('XpNext').setNumber(1e9);
    const boss = () => h.scene().getObjects('Liar')[0];
    const max = boss().getVariables().get('MaxHp').getAsNumber();
    boss().getVariables().get('Hp').setNumber(max * 0.6);
    if (!(await h.until(() => h.scene().getObjects('ChainPylon').length === 4, 3000))) return false;
    for (const pylon of h.scene().getObjects('ChainPylon')) pylon.getVariables().get('Hp').setNumber(-1);
    if (!(await h.until(() => boss().getVariables().get('Armor').getAsNumber() > 0, 3000))) return false;
    boss().getVariables().get('Hp').setNumber(-1);
    if (!(await h.until(() => h.v('State').getAsString() === 'praise', 12_000))) return { ok: false, state: h.v('State').getAsString() };
    h.v('PraiseT').setNumber(0.5);
    return h.until(() => h.scene().getName() === 'Story', 12_000);
  });
  await shot('17-healing.png', [], 2500);
  await check('Christ speaks His own words, with the reference', async () => {
    const h = window.HHH;
    const lines = h.g('Run').getChild('lines').toJSObject();
    const christ = lines.filter(l => l.who === 'christ');
    return { ok: christ.length > 0 && christ.every(l => l.quote.length > 5 && /\d/.test(l.ref)), christ };
  });
  await check('the worked thought record shows all three answers named; the person takes the balanced one', async () => {
    const h = window.HHH;
    await h.press(27, 'Escape');
    if (!(await h.until(() => h.scene().getName() === 'Revelation', 10_000))) return false;
    await h.wait(1200);
    const kinds = ['kind0', 'kind1', 'kind2'].map(k => h.keyed('UiSmall', k)[0]?.getText() ?? '');
    return { ok: /Zniekształcona/.test(kinds[0]) && /Lukrowana/.test(kinds[1]) && /Zrównoważona/.test(kinds[2]), kinds };
  });
  await shot('16-thought-record.png', ['page']);
  await check('taking the balanced answer leads to the truth', async () => {
    const h = window.HHH;
    if (!(await h.click('cbtTake'))) return { ok: false, step: 'cbtTake' };
    return h.until(() => h.v('Wait').getAsNumber() > 0 || h.v('Page').getAsNumber() === 2, 3000);
  });
  await check('the truth, the tool for life, the report; the toolbox keeps the tool', async () => {
    const h = window.HHH;
    if (!(await h.until(() => h.v('Page').getAsNumber() === 2, 12_000))) return { ok: false, page: h.v('Page').getAsNumber(), wait: h.v('Wait').getAsNumber() };
    const saved = JSON.parse(localStorage.getItem('holyholyholy3d.save.v2') || '{}');
    return { ok: saved.done?.noc === true && saved.tools?.oddech === true && saved.light > 0 && saved.manna > 0, done: saved.done, tools: saved.tools };
  });
  await shot('18-truth.png', ['page'], 4200);
  await check('Enter skips through the pages to the Ladder, where the next rung is open', async () => {
    const h = window.HHH;
    for (let i = 0; i < 8 && h.scene().getName() === 'Revelation'; i++) {
      await h.press(13, 'Enter');
      await h.wait(300);
    }
    if (!(await h.until(() => h.scene().getName() === 'Ladder', 5000))) return false;
    await h.wait(800);
    return h.scene().getObjects('OrbDone').length === 1 && h.scene().getObjects('OrbOpen').length === 1;
  });
  await check('the Fruits of the Spirit open', async () => {
    const h = window.HHH;
    if (!(await h.click('fruits'))) return { ok: false, step: 'fruits' };
    return h.until(() => h.g('Ui').getChild('top').getAsString() === 'fruits', 3000);
  });
  await shot('20-fruits.png', ['fruits'], 400);
  await check('the Book of Truth keeps the lie that fell silent and its truth', async () => {
    const h = window.HHH;
    if (!(await h.click('close'))) return { ok: false, step: 'close' };
    await h.wait(300);
    if (!(await h.click('book'))) return { ok: false, step: 'book', top: h.g('Ui').getChild('top').getAsString(), buttons: h.scene().getObjects('UiButton').map(b => b.getVariables().get('Action').getAsString() + '@' + b.getVariables().get('Panel').getAsString()) };
    await h.wait(500);
    const texts = h.scene().getObjects('UiText').filter(t => t.getVariables().get('Panel').getAsString() === 'book').map(t => t.getText());
    return { ok: texts.some(t => t.startsWith('Trwoga')), texts };
  });
  await shot('21-book.png', ['book']);
  await check('the toolbox opens with the breathing practice', async () => {
    const h = window.HHH;
    if (!(await h.click('close'))) return { ok: false, step: 'close book' };
    await h.wait(300);
    if (!(await h.click('tools'))) return { ok: false, step: 'tools' };
    if (!(await h.click('breathe'))) return { ok: false, step: 'breathe' };
    await h.wait(2500);
    return h.v('Breathing').getAsBoolean();
  });
  await shot('19-breathing.png', ['breath']);

  const real = errors.filter(e => !/favicon/.test(e));
  if (real.length) throw new Error(`errors in the page:\n${real.join('\n')}`);
  if (layoutIssues.length) throw new Error(`texts that do not fit:\n${layoutIssues.join('\n')}`);
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
