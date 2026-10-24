#!/usr/bin/env node
/**
 * Look at the app in every language: headless Chrome opens a running server (a Vite dev server, or
 * `vite preview` of a build), picks Mendi on the simulator, then for each language visits every tab
 * and lobby at desktop and phone size, saves screenshots, and reports what looks wrong: a page that
 * scrolls sideways, an element whose text overflows its box, a missing translation (the app logs
 * "i18n: …"), Polish left in a non-Polish page, and page errors.
 *
 *   node scripts/i18n-shot.mjs --port 5184 --out /tmp/i18n [--langs pl,en,de,sv] [--views start,gry,gra/geoda]
 *   (BASE=/repo/ when the server serves a build made for a sub-path)
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
const out = arg('out', '.smoke/i18n');
const langs = arg('langs', 'pl,en,de,sv').split(',');
const views = arg('views', 'start,trening,trening/focus,trening/balance,gry,gra/geoda,gra/latarnik,gra/motylarnia,sygnal,sesje,ustawienia').split(',');
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(p => existsSync(p));
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// words that only Polish uses: a non-Polish page that shows them still has an untranslated text
const POLISH = /[ąęłńśźż]|\b(się|oraz|albo|który|która|opaska|opaskę|Trening|Ustawienia|Sesje|Graj)\b/;

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
const problems = [];
try {
  const page = await (await browser.createBrowserContext()).newPage();
  page.setDefaultTimeout(45_000);
  let lang = langs[0];
  page.on('pageerror', e => problems.push(`[${lang}] page error: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' || m.text().startsWith('i18n:')) problems.push(`[${lang}] console: ${m.text()}`);
  });
  const url = (l, hash) => `http://localhost:${port}${base}?debug&lang=${l}#${hash}`;
  await page.goto(url(lang, 'start'), { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const bl = globalThis.brainlink;
    if (bl.hub.tool !== 'fnirs') await bl.hub.setTool('fnirs');
    await bl.hub.useSimulator();
  });
  await page.waitForFunction(() => globalThis.brainlink.hub.status.signal.reliable, { timeout: 40_000 });
  for (lang of langs) {
    await page.goto(url(lang, 'start'), { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => globalThis.brainlink?.hub.status.signal.reliable, { timeout: 40_000 });
    for (const [size, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      await page.setViewport(vp);
      for (const v of views) {
        await page.evaluate(h => { location.hash = h; }, v);
        await sleep(900);
        const found = await page.evaluate((isPl, re) => {
          const polish = new RegExp(re);
          const view = [...document.querySelectorAll('.view')].find(el => !el.hidden);
          const res = { sideways: document.documentElement.scrollWidth - innerWidth, overflow: [], polish: [] };
          if (!view) return res;
          const scope = [document.querySelector('.appbar'), document.querySelector('.rail'), view].filter(Boolean);
          for (const root of scope) {
            for (const el of root.querySelectorAll('button, a, .badge, .tile b, .tile small, h1, h2, .card-head, .stat .k, .tag, label, .seg button')) {
              const cs = getComputedStyle(el);
              if (el.offsetParent === null || cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis' && el.scrollWidth <= el.clientWidth + 1) continue;
              if (el.scrollWidth > el.clientWidth + 1 && cs.whiteSpace === 'nowrap') res.overflow.push(`${el.tagName.toLowerCase()}.${el.className}: "${el.textContent.trim().slice(0, 40)}"`);
            }
            if (!isPl) {
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                const s = n.textContent.trim();
                if (s && polish.test(s) && n.parentElement?.offsetParent !== null && !n.parentElement?.closest('[lang="pl"]')) res.polish.push(s.slice(0, 60));
              }
            }
          }
          return res;
        }, lang === 'pl', POLISH.source);
        if (found.sideways > 1) problems.push(`[${lang} ${size}] #${v}: page scrolls sideways by ${found.sideways} px`);
        for (const o of found.overflow) problems.push(`[${lang} ${size}] #${v}: text cut off: ${o}`);
        for (const p of [...new Set(found.polish)].slice(0, 6)) problems.push(`[${lang} ${size}] #${v}: Polish text: "${p}"`);
        await page.screenshot({ path: join(out, `${lang}-${size}-${v.replace('/', '-')}.png`), fullPage: size === 'phone' });
      }
    }
    console.log(`✓ ${lang}`);
  }
} finally {
  await browser.close();
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`✓ no problems — screenshots in ${out}`);
