#!/usr/bin/env node
/**
 * The mobile-first audit of one arcade game (src/arcade/DESIGN.md §12): headless Chrome emulates real devices
 * from the first page load — a small Android phone, an iPhone in Safari, a large Android phone, a phone
 * on its side, a tablet and a desktop — starts the game on the simulator and plays it with touch
 * (taps on the game's own targets, taps and drags in the play area, the simulator's focus switch),
 * then reports, per device:
 *
 *   text      every string the game draws on its canvas at its largest size (CSS px): under MIN_TEXT
 *             (11) fails, under MIN_READ (13) is listed as small
 *   targets   the game's `targets()`: each at least 44 px on its short side, inside the insets, no overlaps
 *   frames    frames per second and the game's own update + draw time, with the CPU slowed like a phone's
 *   layout    the canvas, the HUD band, the share left for play; the calibration card fits; no sideways scroll
 *
 * and saves screenshots (lobby, calibration, play, summary) per device.
 *
 *   npx vite --port 5281 --strictPort &
 *   node scripts/arcade-mobile.mjs --port 5281 --game <id> --out /tmp/mobile [--devices small,iphone,android,side,tablet,desktop]
 *        [--sec 50] [--lang pl] [--tool fnirs|eeg] [--throttle <x>]
 *
 * Exits 1 on page errors or a failed check (text under 11 px, a target under 44 px or out of bounds,
 * overlapping targets).  Prints a JSON report and writes it to <out>/<game>-mobile.json.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const port = arg('port', '5173');
const game = arg('game');
const out = arg('out', '.smoke/mobile');
const sec = Math.max(30, Number(arg('sec', '50')) || 50);
const lang = arg('lang', 'pl');
const tool = arg('tool', 'fnirs');
const throttleArg = arg('throttle');
if (!game || !['fnirs', 'eeg'].includes(tool)) {
  console.error('usage: node scripts/arcade-mobile.mjs --port <dev server port> --game <id> --out <dir> [--devices small,iphone,android,side,tablet,desktop]');
  process.exit(2);
}

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
/** The page's size after the browser's own bars (CSS px), the pixel ratio, and how much slower than this machine. */
const DEVICES = {
  small: { name: 'small Android phone', w: 360, h: 600, dpr: 3, mobile: true, ua: ANDROID_UA, throttle: 4 },
  iphone: { name: 'iPhone in Safari', w: 390, h: 664, dpr: 3, mobile: true, ua: IOS_UA, throttle: 2 },
  android: { name: 'large Android phone', w: 412, h: 780, dpr: 2.625, mobile: true, ua: ANDROID_UA, throttle: 3 },
  side: { name: 'phone on its side', w: 812, h: 360, dpr: 3, mobile: true, ua: IOS_UA, throttle: 2, landscape: true },
  tablet: { name: 'tablet', w: 820, h: 1180, dpr: 2, mobile: true, ua: IPAD_UA, throttle: 2 },
  desktop: { name: 'desktop', w: 1280, h: 800, dpr: 1, mobile: false, ua: null, throttle: 1 },
};
const picked = arg('devices', 'small,iphone,android,side,tablet,desktop').split(',').filter(Boolean);
for (const d of picked) if (!DEVICES[d]) { console.error(`unknown device "${d}" (${Object.keys(DEVICES).join(', ')})`); process.exit(2); }

const MIN_TAP = 44, MIN_TEXT = 11, MIN_READ = 13;
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(p => existsSync(p));
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`);

/** In the page, before anything runs: note every string drawn on the game's canvas at its largest size. */
function auditHooks() {
  const A = globalThis.__mobileAudit = { texts: {}, on: false };
  const P = CanvasRenderingContext2D.prototype;
  const SIZE = /(\d+(?:\.\d+)?)px/;
  for (const name of ['fillText', 'strokeText']) {
    const orig = P[name];
    P[name] = function (text, x, y, maxW) {
      const c = this.canvas;
      if (A.on && c && c.parentElement && c.parentElement.classList.contains('arcade') && this.globalAlpha > 0.05) {
        const m = String(this.font).match(SIZE);
        const str = String(text);
        if (m && str.trim()) {
          const tr = this.getTransform();
          const dpr = c.width / Math.max(1, c.clientWidth);
          let px = (Number(m[1]) * Math.hypot(tr.a, tr.b)) / dpr;
          if (maxW !== undefined && maxW > 0) {
            const w = this.measureText(str).width;
            if (w > maxW) px *= maxW / w;
          }
          const key = str.slice(0, 48);
          const cur = A.texts[key];
          if (cur === undefined || px > cur) A.texts[key] = Math.round(px * 10) / 10;
        }
      }
      return orig.call(this, text, x, y, maxW);
    };
  }
}

const report = { game, lang, tool, devices: {} };
let failed = false;
const browser = await puppeteer.launch({
  executablePath: chrome, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  protocolTimeout: 180_000,
});
try {
  for (const key of picked) {
    const dev = DEVICES[key];
    const throttle = throttleArg ? Number(throttleArg) : dev.throttle;
    const errors = [];
    const r = { device: dev.name, size: `${dev.w}×${dev.h}`, errors, problems: [], notes: [] };
    report.devices[key] = r;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    try {
      if (dev.ua) await page.setUserAgent(dev.ua);
      await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, isMobile: dev.mobile, hasTouch: dev.mobile, isLandscape: !!dev.landscape });
      const cdp = await page.createCDPSession();
      page.on('pageerror', e => errors.push(`page error: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error' && !/status of 500/.test(m.text())) errors.push(`console: ${m.text()}`); });
      page.on('dialog', d => void d.accept());
      await page.evaluateOnNewDocument(auditHooks);
      await page.evaluateOnNewDocument(() => {
        const kill = () => document.querySelectorAll('vite-error-overlay').forEach(e => e.remove());
        new MutationObserver(kill).observe(document, { childList: true, subtree: true });
      });
      const shot = name => page.screenshot({ path: join(out, `${game}-${key}-${name}.png`) });
      const tapEl = async sel => {
        const el = await page.waitForSelector(sel, { visible: true });
        if (dev.mobile) await el.tap(); else await el.click();
      };
      const tap = async (x, y) => { if (dev.mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
      /** a finger (or the mouse) pressed at one point, moved to another over `ms`, and lifted */
      const drag = async (x0, y0, x1, y1, ms = 420) => {
        const steps = Math.max(4, Math.round(ms / 40));
        if (dev.mobile) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
          for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k }] });
            await sleep(ms / steps);
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(x0, y0);
          await page.mouse.down();
          await page.mouse.move(x1, y1, { steps });
          await page.mouse.up();
        }
      };
      const state = () => page.evaluate(() => globalThis.brainlink?.arcade?.debug ?? null);

      await page.goto(`http://localhost:${port}/?debug&trainingSec=${sec}&lang=${lang}`, { waitUntil: 'networkidle0' });
      r.coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      await tapEl(`[data-pick="${tool}"]`);
      await page.waitForFunction(() => !document.getElementById('nextStep').hidden);
      await page.evaluate(() => globalThis.brainlink.hub.useSimulator());
      await page.waitForFunction(() => globalThis.brainlink.hub.status.signal.reliable, { timeout: 40_000 });
      await page.evaluate(id => { location.hash = `gra/${id}`; }, game);
      await page.waitForFunction(() => !document.getElementById('btnArcadePlay').disabled, { timeout: 30_000 });
      await sleep(900);
      await shot('1-lobby');
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (sideways > 1) r.problems.push(`the lobby scrolls sideways by ${sideways} px`);
      await page.evaluate(() => document.getElementById('btnArcadePlay').scrollIntoView({ block: 'center' }));
      await sleep(300);
      await tapEl('#btnArcadePlay');
      await page.waitForSelector('#arcadeLayer:not([hidden]) .arcade canvas');
      await sleep(2500);
      await shot('2-calibration');
      const card = await page.evaluate(() => {
        const c = document.querySelector('#arcadeLayer .arcade-card');
        if (!c) return null;
        const b = c.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, h: innerHeight, scroll: c.scrollHeight - c.clientHeight };
      });
      if (card && (card.top < -1 || card.bottom > card.h + 1)) r.problems.push(`the calibration card leaves the screen (${Math.round(card.top)}..${Math.round(card.bottom)} of ${card.h})`);
      if (card && card.scroll > 0) r.notes.push(`the calibration card scrolls by ${card.scroll} px`);
      await page.waitForFunction(() => globalThis.brainlink.arcade.debug?.stage === 'play', { timeout: 60_000 });
      await page.evaluate(() => { globalThis.__mobileAudit.on = true; });
      const hasSim = !!(await page.$('#arcadeLayer .sim-focus'));
      if (hasSim) await tapEl('#arcadeLayer .sim-focus');
      const geo = await page.evaluate(() => {
        const c = document.querySelector('#arcadeLayer .arcade > canvas').getBoundingClientRect();
        return { w: c.width, h: c.height, top: c.top, left: c.left };
      });
      const first = await state();
      const ins = first?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
      r.layout = {
        canvas: `${Math.round(geo.w)}×${Math.round(geo.h)}`, hudTop: Math.round(ins.top), insets: ins,
        playShare: `${Math.round(((geo.h - ins.top - ins.bottom) / dev.h) * 100)} % of the screen's height`, touch: first?.touch,
      };
      // play: the game's own targets, taps and drags in the free area, the simulator's switch every ~16 s
      const end = Date.now() + (sec - 9) * 1000;
      let n = 0, perfDone = false;
      const allTargets = new Map();
      const bannersShot = new Set();
      const fieldY0 = ins.top + 10, fieldY1 = geo.h - ins.bottom - 10;
      while (Date.now() < end) {
        const s = await state();
        if (!s || s.stage !== 'play') break;
        for (const t of s.targets ?? []) allTargets.set(`${t.label}|${Math.round(t.x)}|${Math.round(t.y)}|${Math.round(t.w)}|${Math.round(t.h)}`, t);
        const targets = s.targets ?? [];
        const pick = n % 3;
        if (pick === 0 && targets.length) {
          const t = targets[n % targets.length];
          await tap(geo.left + t.x + t.w / 2, geo.top + t.y + t.h / 2);
        } else if (pick === 1) {
          const ang = (n * 2.39996) % (Math.PI * 2);
          const cx = geo.left + geo.w / 2, cy = geo.top + (fieldY0 + fieldY1) / 2;
          await drag(cx, cy, cx + Math.cos(ang) * 70, cy + Math.sin(ang) * 70, 500);
        } else await tap(geo.left + geo.w / 2, geo.top + fieldY0 + (fieldY1 - fieldY0) * 0.62);
        if (hasSim && n > 0 && n % 24 === 0) await tapEl('#arcadeLayer .sim-focus');
        const ban = await page.evaluate(() => document.querySelector('#arcadeLayer .arcade-banner:not([hidden])')?.getAttribute('data-kind') ?? null);
        if (ban && !bannersShot.has(ban)) {
          bannersShot.add(ban);
          await shot(`3-banner-${ban}`);
        }
        if (n === 9) await shot('3-play-1');
        if (n === 26) await shot('3-play-2');
        // the frame rate with the CPU slowed like a phone's, over 6 s of play
        if (!perfDone && n === 14) {
          perfDone = true;
          if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
          const fps = await page.evaluate(() => new Promise(res => {
            let k = 0;
            const t1 = performance.now();
            const f = () => { k++; if (performance.now() - t1 < 6000) requestAnimationFrame(f); else res((k * 1000) / (performance.now() - t1)); };
            requestAnimationFrame(f);
          }));
          const after = await state();
          if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
          r.frames = { cpuSlowdown: throttle, fps: Math.round(fps * 10) / 10, gameMs: after?.frameMs ?? null, dpr: after?.dpr ?? null };
          if (fps < 40) r.notes.push(`${Math.round(fps)} fps at ${throttle}× CPU slowdown`);
        }
        n++;
        await sleep(450);
      }
      const last = await state();
      r.frames = { ...(r.frames ?? {}), dprEnd: last?.dpr ?? null };
      // text: each string at its largest size
      const texts = await page.evaluate(() => globalThis.__mobileAudit.texts);
      const tiny = Object.entries(texts).filter(([, px]) => px < MIN_TEXT).sort((a, b) => a[1] - b[1]);
      const small = Object.entries(texts).filter(([, px]) => px >= MIN_TEXT && px < MIN_READ).sort((a, b) => a[1] - b[1]);
      r.text = { strings: Object.keys(texts).length, under11: tiny.length, under13: small.length, tiny: tiny.slice(0, 14), small: small.slice(0, 14) };
      if (tiny.length) r.problems.push(`${tiny.length} strings under ${MIN_TEXT} px: ${tiny.slice(0, 6).map(([t, px]) => `"${t}" ${px}`).join(', ')}`);
      // targets: as seen during play
      const W = geo.w, H = geo.h;
      const tlist = [...allTargets.values()];
      r.targets = { seen: tlist.length, labels: [...new Set(tlist.map(t => t.label))].slice(0, 30) };
      if (!tlist.length) r.notes.push('the game reports no targets() (none, or not implemented)');
      for (const t of tlist) {
        if (Math.min(t.w, t.h) < MIN_TAP - 0.5) r.problems.push(`target "${t.label}" is ${Math.round(t.w)}×${Math.round(t.h)} px`);
        if (t.x < ins.left - 0.5 || t.x + t.w > W - ins.right + 0.5 || t.y < ins.top - 0.5 || t.y + t.h > H - ins.bottom + 0.5) {
          r.problems.push(`target "${t.label}" at ${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.w)}×${Math.round(t.h)} leaves the play area`);
        }
      }
      // overlaps among the targets of one frame
      const frameTargets = last?.targets ?? [];
      for (let i = 0; i < frameTargets.length; i++) for (let j = i + 1; j < frameTargets.length; j++) {
        const a = frameTargets[i], b = frameTargets[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) r.problems.push(`targets "${a.label}" and "${b.label}" overlap`);
      }
      r.score = last?.outcome ? `${last.outcome.score} ${last.outcome.unit}` : null;
      await page.waitForSelector('#arcadeLayer .arcade-summary', { timeout: 90_000 });
      await sleep(700);
      await shot('4-summary');
    } catch (e) {
      errors.push(`run: ${e instanceof Error ? e.message : e}`);
    } finally {
      await ctx.close();
    }
    r.problems = [...new Set(r.problems)];
    if (errors.length || r.problems.length) failed = true;
    log(`${key} (${dev.name}): ${errors.length ? 'ERRORS' : r.problems.length ? `${r.problems.length} problems` : 'ok'} · text ${r.text?.under11 ?? '?'} <11, ${r.text?.under13 ?? '?'} <13 · targets ${r.targets?.seen ?? '?'} · ${r.frames?.fps ?? '?'} fps @${r.frames?.cpuSlowdown ?? '?'}× (game ${r.frames?.gameMs ?? '?'} ms, dpr ${r.frames?.dpr ?? '?'}→${r.frames?.dprEnd ?? '?'}) · ${r.layout?.playShare ?? ''}`);
  }
} finally {
  await browser.close();
}
await writeFile(join(out, `${game}-mobile.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(failed ? `✗ problems found (screenshots and ${game}-mobile.json in ${out})` : `✓ mobile checks passed (screenshots in ${out})`);
process.exit(failed ? 1 : 0);
