// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { guard, verdict, type Probe } from '../src/guard';

const person = (ua: string, p: Partial<Probe> = {}): Probe => ({ webdriver: false, ua, selfTest: false, framedElsewhere: false, ...p });

const BROWSERS = [
  // Chrome on Windows, Mac, Android; Safari on iPhone, iPad, Mac; Firefox; Edge; Samsung; Opera; in-app browsers
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.108]',
  'Mozilla/5.0 (Linux; Android 13; Cubot KingKong) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 DuckDuckGo/7',
];

const BOTS = [
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
  'python-requests/2.32.3',
  'curl/8.7.1',
  'Wget/1.21.4',
  'Scrapy/2.11.2 (+https://scrapy.org)',
  'Go-http-client/2.0',
];

describe('the guard', () => {
  it('lets every ordinary browser through, in-app browsers too', () => {
    for (const ua of BROWSERS) expect(verdict(person(ua)), ua).toBeNull();
  });

  it('turns away AI crawlers, scrapers, SEO crawlers, HTTP libraries and headless browsers', () => {
    for (const ua of BOTS) expect(verdict(person(ua)), ua).toBe('bot');
  });

  it('turns away a browser driven by automation (WebDriver, Puppeteer, Playwright, an agent)', () => {
    expect(verdict(person(BROWSERS[0], { webdriver: true }))).toBe('automation');
  });

  it('lets search engines read the page, unless they come driven by automation', () => {
    const google = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    expect(verdict(person(google))).toBeNull();
    expect(verdict(person('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'))).toBeNull();
    expect(verdict(person(google, { webdriver: true }))).toBe('automation');
    // Apple's AI-training token is not search
    expect(verdict(person('Mozilla/5.0 (compatible; Applebot-Extended/0.1)'))).toBe('bot');
  });

  it('turns away a frame of another site, never our own frames', () => {
    expect(verdict(person(BROWSERS[0], { framedElsewhere: true }))).toBe('framed');
  });

  it('lets our own checks through (scripts/selftest.mjs marks their pages)', () => {
    expect(verdict(person(BOTS[7], { webdriver: true, selfTest: true }))).toBeNull();
  });

  it('shows the notice instead of the app, and a link out of another site’s frame', () => {
    const app = document.createElement('div');
    app.className = 'app';
    app.textContent = 'the app';
    document.body.replaceChildren(app);
    expect(guard(person(BROWSERS[0]))).toBe(false);
    expect(document.body.textContent).toContain('the app');
    expect(guard(person(BOTS[0]))).toBe(true);
    expect(document.querySelector('.app')).toBeNull();
    expect(document.querySelector('h1')?.textContent).toMatch(/Emmanuel/);
    expect(guard(person(BROWSERS[0], { framedElsewhere: true }))).toBe(true);
    expect(document.querySelector('a')?.getAttribute('target')).toBe('_blank');
  });

  it('is the first import of every entry, and every page asks not to be mined', () => {
    for (const [file, imp] of [['src/main.ts', "import './gate';"], ['src/cards/pad/main.ts', "import '../../gate';"], ['game/src/main.ts', "import '../../src/gate';"]] as const) {
      const src = readFileSync(file, 'utf8');
      const first = src.split('\n').find(l => l.startsWith('import '));
      expect(first, file).toBe(imp);
    }
    for (const html of ['index.html', 'pad.html', 'game/index.html']) {
      const s = readFileSync(html, 'utf8');
      expect(s, html).toMatch(/<meta name="robots" content="[^"]*noai, noimageai"/);
      expect(s, html).toContain('<meta name="tdm-reservation" content="1">');
    }
  });

  it('marks every page our scripts open as a self-test', () => {
    for (const f of ['app-smoke', 'arcade-shot', 'arcade-mobile', 'cards-smoke', 'offline-smoke', 'i18n-shot']) {
      const s = readFileSync(`scripts/${f}.mjs`, 'utf8');
      const pages = s.match(/^\s*(?:const|let)\s+\w+\s*=\s*await [^\n;]*newPage\(\);/gm) ?? [];
      const marks = s.match(/await markSelfTest\(/g) ?? [];
      expect(pages.length, f).toBeGreaterThan(0);
      expect(marks.length, f).toBe(pages.length);
    }
  });
});
