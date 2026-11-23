/**
 * Wiedza (DESIGN.md §15): articles from the research, the first one on the prefrontal cortex — the place the Mendi
 * band measures. The article's texts and its sources load the first time the tab opens (src/content/wiedza, one file
 * per language), so the app's first load stays as it was.
 *
 * #wiedza is the article's top, #wiedza/<section> scrolls to a section ("emotion", "band", "limits", "refs").
 * Citation numbers follow the order in which sources first appear; pressing one scrolls to the source in the list,
 * which then offers the way back to the sentence. A bare #fragment would be read by the router as an unknown route,
 * so citations scroll in place instead of changing the hash.
 */
import { ARCADE } from '../arcade/registry';
import type { AppLink, Article, Point, Ref, Section } from '../content/wiedza/types';
import { fmtDate, lang, type Lang } from '../i18n';
import { t } from '../i18n/shell';
import { h } from './dom';

const ARTICLES: Readonly<Record<Lang, () => Promise<{ default: Article }>>> = {
  pl: () => import('../content/wiedza/pfc-pl'),
  en: () => import('../content/wiedza/pfc-en'),
  de: () => import('../content/wiedza/pfc-de'),
  sv: () => import('../content/wiedza/pfc-sv'),
};

/** The article in a language, with the source list (both lazily). */
export async function loadArticle(l: Lang): Promise<{ article: Article; refs: readonly Ref[] }> {
  const [a, r] = await Promise.all([ARTICLES[l](), import('../content/wiedza/refs')]);
  return { article: a.default, refs: r.REFS };
}

/** The parts of the article besides its sections that #wiedza/<part> can open. */
export const PARTS = ['band', 'limits', 'refs'] as const;

/** Every cited key in reading order (band box, sections' paragraphs and points, limits), each once. */
export function citeOrder(a: Article): string[] {
  const seen = new Set<string>();
  const add = (ps: readonly Point[]) => { for (const p of ps) for (const k of p.refs) seen.add(k); };
  add(a.band.points);
  for (const s of a.sections) { add(s.body); add(s.points); }
  add(a.limits.points);
  return [...seen];
}

const LINK_KEYS = {
  '#sygnal': 'wiedza.link.sygnal', '#trening': 'wiedza.link.trening', '#trening/focus': 'wiedza.link.focus', '#gry': 'wiedza.link.gry',
} as const;

/** The words on a link into the app: a game by its title, a view by its name; '' for a game that does not exist. */
export function linkLabel(href: AppLink): string {
  if (href.startsWith('#gra/')) {
    const game = ARCADE.find(g => g.id === href.slice('#gra/'.length));
    return game ? t('wiedza.link.game', { name: game.title }) : '';
  }
  return t(LINK_KEYS[href as keyof typeof LINK_KEYS]);
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Polish typography: a one-letter word (a, i, o, u, w, z…) is not left at the end of a line — it is tied to the next
 * word with a no-break space. Other languages are left as they are.
 */
export function tieShortWords(text: string, l: Lang): string {
  if (l !== 'pl') return text;
  return text.replace(/(?<=^|[\s(„—])([aiouwzAIOUWZ]|m\.in\.) +/g, '$1\u00a0');
}
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A decorative head in profile: the band over the forehead, light reaching the cortex behind it. */
function heroArt(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag: string, attrs: Record<string, string>, ...kids: SVGElement[]) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    n.append(...kids);
    return n;
  };
  const glow = el('radialGradient', { id: 'wzGlow', cx: '0.5', cy: '0.5', r: '0.5' },
    el('stop', { offset: '0', class: 'wz-glow-in' }), el('stop', { offset: '1', class: 'wz-glow-out' }));
  return el('svg', { class: 'wiedza-art', viewBox: '0 0 220 180', 'aria-hidden': 'true', focusable: 'false' },
    el('defs', {}, glow),
    // the head, facing right
    el('path', { class: 'wz-head', d: 'M66 170c-3-22-22-34-22-66 0-44 34-76 78-76 42 0 70 28 72 64l-1 9 12 19c2 4-1 6-5 6h-4l1 10c0 5-4 7-9 7l4 4-4 4c2 9-5 15-17 15h-14l-2 10' }),
    // the brain, a calm outline with a few folds
    el('path', { class: 'wz-brain', d: 'M74 98c-3-30 20-52 50-52 30 0 50 18 52 42 1 15-10 24-26 24-10 8-36 9-48 0-16 0-27-5-28-14z' }),
    el('path', { class: 'wz-fold', d: 'M100 58c6 8 4 18-4 24M128 50c-2 12 6 20 18 20M110 96c4-10 14-14 24-10M88 84c8 0 14 4 16 10' }),
    // the prefrontal cortex lit from within
    el('ellipse', { class: 'wz-pfc', cx: '160', cy: '74', rx: '24', ry: '28', fill: 'url(#wzGlow)' }),
    el('path', { class: 'wz-pfc-line', d: 'M150 50c14 4 24 16 26 32' }),
    // the band across the forehead and its light path (fNIRS: in through the skin, back out a little further on)
    el('path', { class: 'wz-band', d: 'M128 30c22 2 40 14 48 34' }),
    el('path', { class: 'wz-light', d: 'M174 58c-12 2-14 14-4 20' }),
    el('circle', { class: 'wz-sensor', cx: '174', cy: '58', r: '2.6' }),
    el('circle', { class: 'wz-sensor', cx: '171', cy: '79', r: '2.6' }),
  ) as SVGSVGElement;
}

/** Renders the article; `onCite` gets the pressed number and its key. */
export function renderArticle(a: Article, refs: readonly Ref[], onCite: (key: string, from: HTMLElement) => void,
  onToc: (part: string) => void, l: Lang = lang): { el: HTMLElement; sections: HTMLElement[]; toc: Map<string, HTMLAnchorElement> } {
  const tx = (s: string) => tieShortWords(s, l);
  const order = citeOrder(a);
  const num = new Map(order.map((k, i) => [k, i + 1]));
  const byKey = new Map(refs.map(r => [r.key, r]));

  const cites = (keys: readonly string[]) => {
    const known = keys.filter(k => byKey.has(k));
    if (!known.length) return null;
    const links = known.flatMap((k, i) => {
      const r = byKey.get(k)!, n = num.get(k)!;
      const link = h('a', {
        class: 'wiedza-cite', href: '#wiedza/refs', 'data-ref': k,
        title: `${t(`wiedza.type.${r.type}`)} · ${r.authors} ${r.year}`,
        'aria-label': t('wiedza.cite', { n, name: `${r.authors} ${r.year}` }),
        on: { click: (e: Event) => { e.preventDefault(); onCite(k, e.currentTarget as HTMLElement); } },
      }, String(n));
      return i ? [', ', link] : [link];
    });
    return h('span', { class: 'wiedza-cites' }, '[', links, ']');
  };
  const point = (p: Point) => [tx(p.text), p.refs.length ? ['\u00a0', cites(p.refs)] : null];
  const label = (text: string) => h('span', { class: 'wiedza-label' }, text);

  // ── the table of contents: every section, then the band box, the limits and the sources ──
  const toc = new Map<string, HTMLAnchorElement>();
  const tocItem = (part: string, n: string, title: string) => {
    const link = h('a', { class: 'wiedza-toc-link', href: `#wiedza/${part}`, on: { click: (e: Event) => { e.preventDefault(); onToc(part); } } },
      h('span', { class: 'wiedza-toc-num', 'aria-hidden': 'true' }, n), h('span', null, title));
    toc.set(part, link);
    return h('li', null, link);
  };
  const nav = h('nav', { class: 'wiedza-toc', 'aria-label': t('wiedza.tocAria') },
    h('p', { class: 'wiedza-toc-title' }, t('wiedza.toc')),
    h('ol', null,
      tocItem('band', '◉', a.band.title),
      a.sections.map((s, i) => tocItem(s.id, two(i + 1), s.title)),
      tocItem('limits', '!', a.limits.title),
      tocItem('refs', '§', t('wiedza.refs'))));

  // ── the hero ──
  const [y, m] = a.reviewed.split('-').map(Number);
  const reviewed = fmtDate(new Date(y, m - 1, 1), { month: 'long', year: 'numeric' });
  const metas = refs.filter(r => num.has(r.key) && r.type === 'meta').length;
  const hero = h('header', { class: 'wiedza-hero' },
    h('div', { class: 'wiedza-hero-text' },
      h('p', { class: 'eyebrow' }, a.kicker),
      h('h2', { class: 'wiedza-title' }, a.title),
      h('p', { class: 'wiedza-lede' }, tx(a.lede)),
      h('ul', { class: 'wiedza-stats' },
        h('li', null, t('wiedza.sources', { n: order.length })),
        h('li', null, t('wiedza.metas', { n: metas })),
        h('li', null, t('wiedza.reviewed', { date: reviewed })))),
    heroArt());

  // ── what the band sees ──
  const band = h('section', { class: 'wiedza-band card', id: 'wz-band', 'aria-labelledby': 'wzh-band' },
    h('h3', { id: 'wzh-band', tabindex: '-1' }, a.band.title),
    h('p', { class: 'wiedza-band-intro' }, tx(a.band.intro)),
    h('div', { class: 'wiedza-band-grid' },
      h('div', { class: 'wiedza-band-tool', 'data-tool': 'fnirs' }, h('h4', null, a.band.fnirs.title), h('p', null, tx(a.band.fnirs.text))),
      h('div', { class: 'wiedza-band-tool', 'data-tool': 'eeg' }, h('h4', null, a.band.eeg.title), h('p', null, tx(a.band.eeg.text)))),
    h('ul', { class: 'wiedza-points' }, a.band.points.map(p => h('li', null, point(p)))));

  // ── the sections ──
  const section = (s: Section, i: number) => h('section', { class: 'wiedza-sec card', id: `wz-${s.id}`, 'aria-labelledby': `wzh-${s.id}` },
    h('header', { class: 'wiedza-sec-head' },
      h('span', { class: 'wiedza-num', 'aria-hidden': 'true' }, two(i + 1)),
      h('h3', { id: `wzh-${s.id}`, tabindex: '-1' }, s.title)),
    h('p', { class: 'wiedza-short' }, label(t('wiedza.inShort')), ' ', tx(s.short)),
    h('div', { class: 'wiedza-text' }, s.body.map(p => h('p', null, point(p)))),
    h('div', { class: 'wiedza-research' },
      h('div', { class: 'wiedza-research-head' },
        h('h4', null, t('wiedza.research')),
        s.strength ? h('span', { class: 'wiedza-strength', 'data-level': s.strength }, t('wiedza.strength', { level: t(`wiedza.level.${s.strength}`) })) : null),
      h('ul', { class: 'wiedza-points' }, s.points.map(p => h('li', null, point(p))))),
    h('p', { class: 'wiedza-foryou' }, label(t('wiedza.forYou')), ' ', tx(s.forYou),
      s.link && linkLabel(s.link) ? [' ', h('a', { class: 'wiedza-go', href: s.link }, linkLabel(s.link))] : null));
  const sections = a.sections.map(section);

  // ── the limits ──
  const limits = h('section', { class: 'wiedza-limits card', id: 'wz-limits', 'aria-labelledby': 'wzh-limits' },
    h('h3', { id: 'wzh-limits', tabindex: '-1' }, a.limits.title),
    h('ul', { class: 'wiedza-points' }, a.limits.points.map(p => h('li', null, point(p)))));

  // ── the sources, in citation order ──
  const refItem = (k: string) => {
    const r = byKey.get(k)!;
    return h('li', { id: `wz-ref-${k}`, class: 'wiedza-ref', tabindex: '-1' },
      h('span', { class: 'wiedza-refnum' }, `[${num.get(k)}]`),
      h('div', { class: 'wiedza-refbody' },
        h('span', { class: 'wiedza-type', 'data-type': r.type }, t(`wiedza.type.${r.type}`)),
        h('p', { class: 'wiedza-reftext' }, h('b', null, r.authors), ` (${r.year}). ${r.title}. `, h('i', null, r.journal), '.'),
        h('p', { class: 'wiedza-reflinks' },
          h('a', { href: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, target: '_blank', rel: 'noopener' }, `PubMed ${r.pmid}`),
          ' · ',
          h('a', { href: `https://doi.org/${r.doi}`, target: '_blank', rel: 'noopener' }, `DOI ${r.doi}`)),
        h('button', { class: 'btn ghost wiedza-back', type: 'button', hidden: true }, t('wiedza.back'))));
  };
  const sources = h('section', { class: 'wiedza-refs card', id: 'wz-refs', 'aria-labelledby': 'wzh-refs' },
    h('h3', { id: 'wzh-refs', tabindex: '-1' }, t('wiedza.refs')),
    h('p', { class: 'muted' }, t('wiedza.refsNote')),
    h('ol', { class: 'wiedza-reflist' }, order.filter(k => byKey.has(k)).map(refItem)));

  const el = h('article', { class: 'wiedza-article' },
    hero,
    h('div', { class: 'wiedza-layout' },
      nav,
      h('div', { class: 'wiedza-body' }, band, sections, limits, sources,
        h('p', { class: 'wiedza-reviewed disclaimer' }, t('wiedza.reviewed', { date: reviewed })))));
  return { el, sections: [band, ...sections, limits, sources], toc };
}

/** The Wiedza view: loads the article once, renders it, scrolls to the part a route names. */
export class WiedzaView {
  private loaded = false;
  private loading = false;
  private pending: string | null = null;
  private from: HTMLElement | null = null;
  private spy: IntersectionObserver | null = null;

  constructor(private readonly root: HTMLElement, private readonly go: (hash: string) => void, private readonly language: Lang = lang) {}

  /** The view is shown at #wiedza (part null) or #wiedza/<part>. */
  show(part: string | null): void {
    this.pending = part;
    if (this.loaded) this.open(part);
    else void this.load();
  }

  private async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.root.replaceChildren(h('p', { class: 'muted wiedza-loading', role: 'status' }, t('wiedza.loading')));
    try {
      const { article, refs } = await loadArticle(this.language);
      const r = renderArticle(article, refs, (k, from) => this.cite(k, from), part => this.go(`wiedza/${part}`), this.language);
      this.root.replaceChildren(r.el);
      this.loaded = true;
      this.watch(r.sections, r.toc);
      this.open(this.pending);
    } catch (e) {
      console.error(e);
      this.root.replaceChildren(h('div', { class: 'card wiedza-failed', role: 'alert' },
        h('p', null, t('wiedza.failed')),
        h('button', { class: 'btn', type: 'button', on: { click: () => void this.load() } }, t('wiedza.retry'))));
    } finally {
      this.loading = false;
    }
  }

  /** Scroll to a part (and put the focus on its heading); the top for none. */
  private open(part: string | null): void {
    if (!part) {
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    const target = /^[\w-]+$/.test(part) ? document.getElementById(`wz-${part}`) : null;
    if (target) this.scrollTo(target, target.querySelector<HTMLElement>('h3') ?? target);
  }

  private scrollTo(el: HTMLElement, focus: HTMLElement): void {
    const bar = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - bar - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
    focus.focus({ preventScroll: true });
  }

  /** A citation pressed: to its source, which offers the way back. */
  private cite(key: string, from: HTMLElement): void {
    const item = document.getElementById(`wz-ref-${key}`);
    if (!item) return;
    this.from = from;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.wiedza-back')) b.hidden = true;
    const back = item.querySelector<HTMLButtonElement>('.wiedza-back')!;
    back.hidden = false;
    back.onclick = () => {
      back.hidden = true;
      if (this.from?.isConnected) this.scrollTo(this.from.closest<HTMLElement>('li, p') ?? this.from, this.from);
    };
    item.classList.remove('flash');
    void item.offsetWidth;   // restart the highlight
    item.classList.add('flash');
    this.scrollTo(item, item);
  }

  /** The contents follow the reading: the section in view is marked (desktop: the contents stay beside the text). */
  private watch(sections: HTMLElement[], toc: Map<string, HTMLAnchorElement>): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.spy?.disconnect();
    this.spy = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const part = e.target.id.replace(/^wz-/, '');
        for (const [k, a] of toc) {
          if (k === part) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    for (const s of sections) this.spy.observe(s);
  }
}
