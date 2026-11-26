/**
 * Who is looking (DESIGN.md, the app's guard): a person in a browser, or an automated client — an AI crawler, a
 * scraper, a headless browser, an agent driving a browser, or a page that frames the app from another site.
 *
 * The app is a static site (GitHub Pages): there is no server to turn a client away and no headers to set, so the
 * guard does what a page can do: the HTML's own signals (`<meta name="robots" content="noai, noimageai">`, the W3C
 * TDM reservation) ask crawlers not to mine it, and this module — the first thing every entry imports (gate.ts) —
 * keeps automated browsers out: they get a short notice instead of the app (no content, no service worker, no
 * Bluetooth).  Search engines may still read the page, so people can find the app.  A determined scraper can always
 * fetch the files; this is a deterrent, honestly so, not a lock (a real one needs an edge in front of the site).
 *
 * Our own checks (scripts/*.mjs drive headless Chrome) mark their pages as a self-test first (scripts/selftest.mjs).
 */

export type Verdict = 'automation' | 'bot' | 'framed' | null;

export interface Probe {
  /** `navigator.webdriver`: true in a browser driven by WebDriver, Puppeteer, Playwright, an agent */
  webdriver: boolean;
  ua: string;
  /** the page was marked by our own test scripts */
  selfTest: boolean;
  /** shown inside a frame of another site */
  framedElsewhere: boolean;
}

/** Search engines: they may read the page (the app stays findable). */
export const SEARCH_UA = /\b(Googlebot|Google-InspectionTool|bingbot|DuckDuckBot|Applebot(?!-Extended)|YandexBot|Baiduspider|Qwantbot|SeznamBot|Ecosia)\b/i;

/**
 * Automated clients by their user agent: AI crawlers and agents, scrapers, SEO crawlers, HTTP libraries and headless
 * browsers.  (Most crawlers never run the page's script — the HTML's signals are for them; this list catches those
 * that do, and those that render pages in a browser.)
 */
export const BOT_UA = new RegExp([
  'HeadlessChrome', 'PhantomJS', 'puppeteer', 'playwright', 'selenium', 'webdriver',
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'CCBot', 'PerplexityBot', 'Perplexity-User', 'Bytespider', 'Amazonbot', 'Applebot-Extended', 'Google-Extended',
  'meta-externalagent', 'meta-externalfetcher', 'FacebookBot', 'cohere-ai', 'cohere-training-data-crawler', 'Diffbot',
  'ImagesiftBot', 'Omgili', 'YouBot', 'AI2Bot', 'Ai2Bot-Dolma', 'Timpibot', 'PetalBot', 'DataForSeoBot', 'SemrushBot',
  'AhrefsBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'Scrapy', 'python-requests', 'python-urllib', 'aiohttp', 'httpx',
  'curl/', 'Wget', 'Go-http-client', 'node-fetch', 'axios/', 'okhttp', 'Java/', 'libwww-perl', 'HttpClient',
  '\\bbot\\b', 'crawler', 'spider', 'scraper',
].map(s => (s.startsWith('\\') ? s : s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))).join('|'), 'i');

/** What the guard decides for a probe (pure). */
export function verdict(p: Probe): Verdict {
  if (p.selfTest) return null;
  if (SEARCH_UA.test(p.ua) && !p.webdriver) return null;
  if (p.webdriver) return 'automation';
  if (BOT_UA.test(p.ua)) return 'bot';
  if (p.framedElsewhere) return 'framed';
  return null;
}

/** Read the browser. */
export function probe(): Probe {
  const g = globalThis as { __emmanuelSelfTest?: unknown };
  let framedElsewhere = false;
  try {
    if (window.top && window.top !== window.self) framedElsewhere = window.top.location.origin !== location.origin;
  } catch {
    framedElsewhere = true;   // another site's frame: its location cannot be read
  }
  return {
    webdriver: navigator.webdriver === true,
    ua: navigator.userAgent || '',
    selfTest: g.__emmanuelSelfTest === true,
    framedElsewhere,
  };
}

type Words = { title: string; text: string; framed: string; open: string };
const WORDS: Readonly<Record<'pl' | 'en' | 'de' | 'sv', Words>> = {
  pl: {
    title: 'Emmanuel jest dla ludzi',
    text: 'Ta aplikacja nie działa w zautomatyzowanych przeglądarkach, robotach ani agentach. Otwórz ją w zwykłej przeglądarce.',
    framed: 'Emmanuel otwiera się tylko na własnej stronie, nie w ramce innej witryny.',
    open: 'Otwórz Emmanuel w nowej karcie',
  },
  en: {
    title: 'Emmanuel is for people',
    text: 'This app does not run in automated browsers, bots or agents. Open it in an ordinary browser.',
    framed: 'Emmanuel opens only on its own page, not inside another site’s frame.',
    open: 'Open Emmanuel in a new tab',
  },
  de: {
    title: 'Emmanuel ist für Menschen',
    text: 'Diese App läuft nicht in automatisierten Browsern, Bots oder Agenten. Öffne sie in einem normalen Browser.',
    framed: 'Emmanuel öffnet sich nur auf der eigenen Seite, nicht im Rahmen einer anderen Website.',
    open: 'Emmanuel in einem neuen Tab öffnen',
  },
  sv: {
    title: 'Emmanuel är till för människor',
    text: 'Appen fungerar inte i automatiserade webbläsare, botar eller agenter. Öppna den i en vanlig webbläsare.',
    framed: 'Emmanuel öppnas bara på sin egen sida, inte i en ram på en annan webbplats.',
    open: 'Öppna Emmanuel i en ny flik',
  },
};

function wordsFor(langs: readonly string[]): Words {
  for (const l of langs) {
    const k = l.slice(0, 2).toLowerCase();
    if (k === 'pl' || k === 'en' || k === 'de' || k === 'sv') return WORDS[k];
  }
  return WORDS.en;
}

/** Replace the page with the notice (DOM only, no inline styles in markup: the CSP allows the CSSOM). */
function notice(v: Exclude<Verdict, null>): void {
  const w = wordsFor(navigator.languages?.length ? navigator.languages : [navigator.language || 'en']);
  const doc = document;
  doc.title = 'Emmanuel';
  const main = doc.createElement('main');
  Object.assign(main.style, {
    maxWidth: '34rem', margin: '18vh auto 0', padding: '0 24px', font: '16px/1.55 system-ui, sans-serif',
    color: '#e8e4dc', textAlign: 'center',
  });
  const h1 = doc.createElement('h1');
  h1.textContent = w.title;
  Object.assign(h1.style, { font: '600 26px/1.2 Georgia, serif', margin: '0 0 14px' });
  const p = doc.createElement('p');
  p.textContent = v === 'framed' ? w.framed : w.text;
  main.append(h1, p);
  if (v === 'framed') {
    const a = doc.createElement('a');
    a.href = location.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = w.open;
    Object.assign(a.style, { color: '#ffd27a' });
    main.append(a);
  }
  const body = doc.body ?? doc.documentElement.appendChild(doc.createElement('body'));
  body.replaceChildren(main);
  Object.assign(body.style, { background: '#0b0d13', margin: '0' });
  body.removeAttribute('data-tool');
}

/** Guard the page: true when the client was turned away (the notice is shown; the caller must not boot the app). */
export function guard(p: Probe = probe()): boolean {
  const v = verdict(p);
  if (!v) return false;
  notice(v);
  return true;
}
