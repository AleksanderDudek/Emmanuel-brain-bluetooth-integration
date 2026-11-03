/**
 * The exercise cards' views (src/cards/DESIGN.md §1): the module's home (#karty), one card
 * (#karty/07), and a game's lobby (#karty/gra/palce, #karty/gra/dzien for the daily workout).
 * They wear the cards' own look — the "Wersja 4K" style: a violet-to-navy frame, white panels, a
 * navy header with a coral number badge, flat colours — inside the app's shell.
 */
import type { Hub, HubStatus } from '../hub';
import { REASON_TEXT } from '../hub';
import { fmtDate, fmtNum } from '../i18n';
import type { SessionDB } from '../storage/db';
import { TOOL_INFO } from '../tools';
import type { TrainingResult } from '../training/score';
import { itemSvg, splitTileSvg } from './art/draw';
import { CardsLayer, legendRows, type SessionPlan } from './board/layer';
import { PaperRun } from './board/paper';
import { CARDS, card, cardFileName, cardImage, fixKey, howKey, playable, titleKey, type CardInfo } from './catalog';
import type { LinkKind } from './duo/link';
import { dailyTrio, GAMES, gameMeta, type GameMeta } from './games';
import { headline, unitOf } from './games/stats';
import type { GameId } from './games/types';
import { t } from './i18n';
import { tc } from './i18n-cards';
import { buildPdf, buildZip, fetchBytes, saveFile, toJpeg } from './print';
import { cardStreak, progressOf, sessionJson, trialsCsv, type CardSession, type CardStore, type GameProgress } from './store';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el;
};
const a = (href: string, cls: string, ...kids: (Node | string)[]): HTMLAnchorElement => {
  const el = h('a', cls, ...kids);
  el.href = href;
  return el;
};
const button = (label: string, fn: () => void, cls = 'k-btn-ui'): HTMLButtonElement => {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
};

export interface CardsDeps {
  hub: Hub;
  db: SessionDB;
  store: CardStore;
  /** a training result was saved in the app (Home's day score and Sesje refresh) */
  onTraining: (r: TrainingResult) => void;
  mark: (label: string) => void;
  record: { start: (name: string, sec: number) => Promise<boolean>; stop: () => Promise<void> };
  openSheet: () => void;
}

interface Prefs { minutes: number; pad: LinkKind; marks: boolean; sound: boolean; band: boolean; raw: boolean }
const DEFAULT_PREFS: Prefs = { minutes: 2, pad: 'local', marks: false, sound: true, band: true, raw: false };
const MINUTES = [1, 2, 3, 5];
const WORKOUT_SEC = 90;

/** Relay availability: the desktop server answers /api/v1/duo/info when it served this page. */
interface RelayInfo { ok: boolean; lan: string | null; error?: string }

export class CardsModule {
  private sessions: CardSession[] = [];
  private progress = new Map<GameId, GameProgress>();
  private prefs: Prefs = { ...DEFAULT_PREFS };
  private relay: RelayInfo | null = null;
  private sub: string | null = null;
  private filter: 'all' | 'play' | 'print' = 'all';
  private readonly layer: CardsLayer;
  private readonly paper: PaperRun;
  private bandLine: HTMLElement | null = null;
  private working = false;

  constructor(private readonly d: CardsDeps, private readonly root: HTMLElement) {
    const saveTraining = async (r: TrainingResult) => {
      await d.db.putTraining(r);
      d.onTraining(r);
    };
    this.layer = new CardsLayer({
      hub: d.hub, store: d.store, saveTraining, mark: d.mark, record: d.record, openSheet: d.openSheet,
      onSaved: () => void this.reload(),
      onClose: () => this.render(),
    });
    this.paper = new PaperRun({ hub: d.hub, store: d.store, saveTraining, mark: d.mark, onSaved: () => void this.reload(), onClose: () => this.render() });
  }

  async init(): Promise<void> {
    this.prefs = { ...DEFAULT_PREFS, ...((await this.d.store.get<Partial<Prefs>>('prefs')) ?? {}) };
    await this.reload(false);
  }

  private async reload(render = true): Promise<void> {
    this.sessions = await this.d.store.list();
    this.progress = progressOf(this.sessions, p => headline(p.game, p.stats));
    if (render) this.render();
  }

  private savePrefs(): void { void this.d.store.set('prefs', this.prefs); }

  get active(): boolean { return this.layer.active || this.paper.active; }
  get busy(): boolean { return this.layer.busy || this.paper.busy; }

  show(sub: string | null): void {
    this.sub = sub;
    this.render();
    window.scrollTo({ top: 0 });
  }

  /** Band status lines follow the hub. */
  renderStatus(s: HubStatus): void {
    if (this.bandLine) this.bandLine.textContent = this.bandText(s);
  }

  private render(): void {
    const sub = this.sub;
    this.bandLine = null;
    let body: HTMLElement;
    if (!sub) body = this.home();
    else if (/^\d{2}$/.test(sub) && card(Number(sub))) body = this.cardView(card(Number(sub))!);
    else if (sub.startsWith('gra/')) {
      const id = sub.slice(4);
      body = id === 'dzien' ? this.lobby(null) : gameMeta(id) ? this.lobby(gameMeta(id)!) : this.home();
    } else body = this.home();
    this.root.replaceChildren(body);
  }

  // ── home ────────────────────────────────────────────────────────

  private home(): HTMLElement {
    const wrap = h('div', 'k-theme k-module');
    // the hero: the cards' header, as a page
    const hero = h('header', 'k-hero');
    hero.append(h('span', 'k-badge', '32'), h('div', null, h('p', 'k-eyebrow', t('home.kicker')), h('h1', null, t('home.title')), h('p', 'k-lede', t('home.lede'))));
    wrap.append(hero);

    // the daily workout
    const trio = dailyTrio(dayKey());
    const daily = h('section', 'k-panel-card k-daily');
    const icons = h('div', 'k-daily-icons');
    for (const g of trio) icons.append(gameArt(g));
    daily.append(h('div', 'k-daily-text', h('h2', null, t('home.daily')),
      h('p', null, t('home.dailyText', { a: t(`game.${trio[0]}.title`), b: t(`game.${trio[1]}.title`), c: t(`game.${trio[2]}.title`) })),
      a('#karty/gra/dzien', 'k-btn-ui primary', t('home.dailyCta'))), icons);
    wrap.append(daily);

    // the games
    const games = h('section', 'k-section');
    games.append(h('div', 'k-section-head', h('h2', null, t('home.games')), h('p', null, t('home.gamesNote'))));
    const grid = h('div', 'k-games');
    for (const g of GAMES) grid.append(this.gameTile(g));
    games.append(grid);
    wrap.append(games);

    // progress
    wrap.append(this.progressSection());

    // the printable cards
    const print = h('section', 'k-section');
    const pdf = button(t('home.pdf'), () => void this.downloadAll('pdf'), 'k-btn-ui primary');
    const zip = button(t('home.zip'), () => void this.downloadAll('zip'));
    const status = h('p', 'k-file-status');
    status.setAttribute('role', 'status');
    this.fileStatus = status;
    const filters = h('div', 'k-chips');
    filters.setAttribute('role', 'radiogroup');
    for (const f of ['all', 'play', 'print'] as const) {
      const b = button(t(f === 'all' ? 'home.filterAll' : f === 'play' ? 'home.filterPlay' : 'home.filterPrint'), () => {
        this.filter = f;
        this.render();
      }, `k-chip${this.filter === f ? ' on' : ''}`);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(this.filter === f));
      filters.append(b);
    }
    print.append(h('div', 'k-section-head', h('h2', null, t('home.print')), h('p', null, t('home.printNote'))),
      h('div', 'k-row-actions', pdf, zip, status), filters);
    const gallery = h('div', 'k-gallery');
    for (const c of CARDS) {
      const games = playable(c);
      if (this.filter === 'play' && !games.length) continue;
      if (this.filter === 'print' && games.length) continue;
      const img = h('img', 'k-thumb');
      img.src = cardImage(c, 'thumb');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      const tags = h('span', 'k-tags', games.length ? h('i', 'k-tag', t('home.cardGame')) : null, c.fixed ? h('i', 'k-tag fixed', t('home.cardFixed')) : null);
      gallery.append(a(`#karty/${c.id}`, 'k-thumbcard', img, h('span', 'k-num', c.id), h('b', null, tc(titleKey(c))), tags));
    }
    print.append(gallery);
    wrap.append(print);

    // how it works
    const how = h('section', 'k-panel-card k-how');
    const ul = h('ul');
    for (const k of ['home.how1', 'home.how2', 'home.how3', 'home.how4'] as const) ul.append(h('li', null, t(k)));
    how.append(h('h2', null, t('home.how')), ul, h('p', 'k-disclaimer', t('home.disclaimer')));
    wrap.append(how);
    return wrap;
  }

  private gameTile(g: GameMeta): HTMLElement {
    const p = this.progress.get(g.id);
    const unit = unitOf(g.id);
    const meta = p
      ? `${t('home.level', { n: p.level })} · ${t('home.best', { v: p.best === null ? '—' : fmtNum(p.best, unit === 'span' ? 0 : 1) })}`
      : t('home.newGame');
    return a(`#karty/gra/${g.id}`, 'k-gametile',
      h('div', 'k-gameart', gameArt(g.id)),
      h('span', 'k-skill', t(`skill.${g.skill}`)),
      h('b', null, t(`game.${g.id}.title`)),
      h('small', null, t(`game.${g.id}.tagline`)),
      h('span', 'k-gamemeta', meta));
  }

  private progressSection(): HTMLElement {
    const sec = h('section', 'k-panel-card k-progress');
    sec.append(h('h2', null, t('home.progress')));
    if (!this.sessions.length) {
      sec.append(h('p', 'k-muted', t('home.noProgress')));
      return sec;
    }
    const minutes = [...this.progress.values()].reduce((s, p) => s + p.minutes, 0);
    sec.append(h('p', 'k-progress-meta', `${t('home.streak', { n: cardStreak(this.sessions) })} · ${t('home.sessions', { n: this.sessions.length })} · ${t('home.minutes', { n: Math.round(minutes) })}`));
    const list = h('div', 'k-progress-list');
    for (const g of GAMES) {
      const p = this.progress.get(g.id);
      if (!p) continue;
      const spark = h('canvas', 'k-spark');
      spark.setAttribute('aria-hidden', 'true');
      list.append(a(`#karty/gra/${g.id}`, 'k-progress-row', h('b', null, t(`game.${g.id}.title`)), spark,
        h('span', null, t('home.best', { v: p.best === null ? '—' : fmtNum(p.best, unitOf(g.id) === 'span' ? 0 : 1) })),
        h('small', null, t('home.sessions', { n: p.sessions }))));
      requestAnimationFrame(() => drawSpark(spark, p.history.map(x => x[1])));
    }
    sec.append(list);
    sec.append(h('div', 'k-row-actions',
      button(t('home.exportCsv'), () => saveFile(trialsCsv(this.sessions), `emmanuel-karty-proby-${dayKey()}.csv`, 'text/csv')),
      button(t('home.exportJson'), () => saveFile(`[${this.sessions.map(sessionJson).join(',\n')}]`, `emmanuel-karty-sesje-${dayKey()}.json`, 'application/json'))));
    return sec;
  }

  private fileStatus: HTMLElement | null = null;

  private async downloadAll(kind: 'pdf' | 'zip'): Promise<void> {
    if (this.working) return;
    this.working = true;
    const status = this.fileStatus;
    const say = (s: string) => { if (status) status.textContent = s; };
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      const pages = [];
      for (let i = 0; i < CARDS.length; i++) {
        say(t('home.preparing', { done: i, total: CARDS.length }));
        const bytes = await fetchBytes(cardImage(CARDS[i], 'full'));
        if (kind === 'zip') files.push({ name: cardFileName(CARDS[i]), data: bytes });
        else pages.push(await toJpeg(bytes));
      }
      say(t('home.preparing', { done: CARDS.length, total: CARDS.length }));
      if (kind === 'zip') saveFile(buildZip(files), 'emmanuel-karty-cwiczen.zip', 'application/zip');
      else saveFile(buildPdf(pages, t('home.kicker')), 'emmanuel-karty-cwiczen.pdf', 'application/pdf');
      say('');
    } catch (e) {
      say(t('home.fileFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      this.working = false;
    }
  }

  // ── one card ────────────────────────────────────────────────────

  private cardView(c: CardInfo): HTMLElement {
    const wrap = h('div', 'k-theme k-module');
    wrap.append(a('#karty', 'k-back', t('card.back')));
    const head = h('header', 'k-hero k-hero-card');
    head.append(h('span', 'k-badge', c.id), h('div', null, h('p', 'k-eyebrow', t('card.number', { n: c.n })), h('h1', null, tc(titleKey(c)))));
    wrap.append(head);
    const layout = h('div', 'k-cardlayout');
    const fig = h('figure', 'k-figure');
    const img = h('img', 'k-cardimg');
    img.alt = tc(titleKey(c));
    img.src = cardImage(c, 'thumb');
    // the 4K picture replaces the preview once it has loaded (offline the preview stays)
    const full = new Image();
    full.onload = () => { img.src = full.src; };
    full.src = cardImage(c, 'full');
    fig.append(img, h('figcaption', null, a(cardImage(c, 'full'), 'k-link', t('card.open'))));
    (fig.querySelector('a') as HTMLAnchorElement).target = '_blank';
    (fig.querySelector('a') as HTMLAnchorElement).rel = 'noopener';
    layout.append(fig);
    const side = h('div', 'k-cardside');
    side.append(h('section', 'k-panel-card', h('h2', null, t('card.how')), h('p', null, tc(howKey(c)))));
    // the card's three target times
    const times = h('section', 'k-panel-card k-times');
    times.append(h('h2', null, t('card.times')));
    const table = h('table');
    const thead = h('tr', null, h('th'), ...(['slow', 'medium', 'fast'] as const).map(s => h('th', null, t(`speed.${s}`))));
    table.append(thead);
    c.times.forEach((row, i) => table.append(h('tr', null, h('th', null, c.times.length > 1 ? t('card.page', { n: i + 1 }) : ''),
      ...row.map(v => h('td', null, t('card.sec', { n: v }))))));
    times.append(table, h('p', 'k-muted', t('card.timesNote')));
    side.append(times);
    side.append(h('section', 'k-panel-card', h('h2', null, t('card.trains')), h('div', 'k-chips', ...c.tags.map(tag => h('span', 'k-chip static', tc(`tag.${tag}`))))));
    const actions = h('section', 'k-panel-card k-cardactions');
    const dl = a(cardImage(c, 'full'), 'k-btn-ui', t('card.download'));
    dl.download = cardFileName(c);
    actions.append(h('h2', null, t('card.paper')), h('p', null, t('card.paperText')),
      h('div', 'k-row-actions', button(t('card.paperStart'), () => this.paper.open(c), 'k-btn-ui primary'), dl));
    const games = playable(c);
    if (games.length) {
      actions.append(h('h2', 'mt', t('card.games')), h('div', 'k-row-actions', ...games.map(g => a(`#karty/gra/${g.id}`, 'k-btn-ui', t(`game.${g.id}.title`)))));
    } else if (c.why) actions.append(h('p', 'k-muted', `${t('card.printOnly')} ${tc(`why.${c.why}`)}`));
    side.append(actions);
    side.append(h('p', 'k-muted', t('card.checked'), c.fixed ? ` ${t('card.fixed', { what: tc(fixKey(c)) })}` : ''));
    layout.append(side);
    wrap.append(layout);
    const nav = h('nav', 'k-cardnav');
    if (c.n > 1) nav.append(a(`#karty/${card(c.n - 1)!.id}`, 'k-btn-ui', t('card.prev')));
    if (c.n < CARDS.length) nav.append(a(`#karty/${card(c.n + 1)!.id}`, 'k-btn-ui', t('card.next')));
    wrap.append(nav);
    return wrap;
  }

  // ── a game's lobby ──────────────────────────────────────────────

  private lobby(g: GameMeta | null): HTMLElement {
    const wrap = h('div', 'k-theme k-module');
    wrap.append(a('#karty', 'k-back', t('lobby.back')));
    const trio = dailyTrio(dayKey());
    const games: GameId[] = g ? [g.id] : trio;
    const head = h('header', 'k-hero k-hero-card');
    const p0 = g ? this.progress.get(g.id) : undefined;
    head.append(h('span', 'k-badge', String(p0?.level ?? 1).padStart(2, '0')),
      h('div', null, h('p', 'k-eyebrow', g ? t(`skill.${g.skill}`) : t('home.daily')),
        h('h1', null, g ? t(`game.${g.id}.title`) : t('home.daily')),
        h('p', 'k-lede', g ? t(`game.${g.id}.tagline`) : t('home.dailyText', { a: t(`game.${trio[0]}.title`), b: t(`game.${trio[1]}.title`), c: t(`game.${trio[2]}.title`) }))));
    wrap.append(head);
    const cols = h('div', 'k-lobby');
    const left = h('div', 'k-lobby-main');
    for (const id of games) {
      const m = gameMeta(id)!;
      const sec = h('section', 'k-panel-card');
      if (!g) sec.append(h('h2', null, t(`game.${id}.title`)));
      sec.append(h('h3', null, t('lobby.how')), h('p', null, t(`game.${id}.how`)), h('h3', null, t('lobby.trains')), h('p', null, t(`game.${id}.trains`)));
      const rule = m.create({ rng: Math.random, level: this.progress.get(id)?.level ?? 1 }).rule();
      if (rule) {
        const box = h('div', 'k-legend k-legend-inline');
        box.append(h('p', 'k-legend-head', t('lobby.rule')), ...legendRows(rule.rows, this.prefs.marks));
        sec.append(box);
      }
      sec.append(h('p', 'k-fromcards', t('lobby.fromCards', { list: '' }), ...m.cards.map(n => a(`#karty/${String(n).padStart(2, '0')}`, 'k-cardref', String(n).padStart(2, '0')))));
      left.append(sec);
    }
    cols.append(left);
    cols.append(this.startCard(g, games));
    wrap.append(cols);
    if (g) wrap.append(this.historyCard(g.id));
    return wrap;
  }

  private startCard(g: GameMeta | null, games: GameId[]): HTMLElement {
    const sec = h('section', 'k-panel-card k-start');
    const seg = (label: string, opts: { v: string; label: string }[], cur: string, pick: (v: string) => void, note?: string) => {
      const row = h('div', 'k-field');
      const group = h('div', 'k-seg');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', label);
      for (const o of opts) {
        const b = button(o.label, () => pick(o.v), `k-chip${o.v === cur ? ' on' : ''}`);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(o.v === cur));
        group.append(b);
      }
      row.append(h('span', 'k-label', label), group);
      if (note) row.append(h('p', 'k-muted', note));
      return row;
    };
    if (g) sec.append(seg(t('lobby.length'), MINUTES.map(m => ({ v: String(m), label: t('lobby.min', { n: m }) })), String(this.prefs.minutes), v => {
      this.prefs.minutes = Number(v);
      this.savePrefs();
      this.render();
    }));
    const padNote = this.prefs.pad === 'local' ? t('lobby.padLocalText') : this.prefs.pad === 'channel' ? t('lobby.padChannelText') : t('lobby.padRelayText');
    sec.append(seg(t('lobby.pad'), [
      { v: 'local', label: t('lobby.padLocal') }, { v: 'channel', label: t('lobby.padChannel') }, { v: 'relay', label: t('lobby.padRelay') },
    ], this.prefs.pad, v => {
      this.prefs.pad = v as LinkKind;
      this.savePrefs();
      this.render();
    }, padNote));
    const startBtn = button(t('lobby.start'), () => this.start(g, games), 'k-btn-ui primary big');
    if (this.prefs.pad === 'relay') {
      const relayNote = h('p', 'k-relay');
      sec.append(relayNote);
      startBtn.disabled = !this.relay?.ok;
      void this.checkRelay().then(info => {
        startBtn.disabled = !info.ok;
        relayNote.textContent = info.ok
          ? t('lobby.relayLan', { url: info.lan ?? location.origin })
          : t('lobby.relayMissing', { url: 'http://localhost:8420/app/' });
        relayNote.dataset.ok = String(info.ok);
      });
    }
    const sw = (label: string, on: boolean, set: (v: boolean) => void, hint?: string) => {
      const l = h('label', 'k-switch');
      const input = h('input');
      input.type = 'checkbox';
      input.checked = on;
      input.addEventListener('change', () => { set(input.checked); this.savePrefs(); });
      l.append(input, h('span', null, label));
      return hint ? h('div', null, l, h('p', 'k-muted', hint)) : l;
    };
    sec.append(sw(t('lobby.marks'), this.prefs.marks, v => { this.prefs.marks = v; this.render(); }, t('lobby.marksHint')));
    sec.append(sw(t('lobby.sound'), this.prefs.sound, v => { this.prefs.sound = v; }));
    // the band
    const band = h('div', 'k-bandbox');
    band.append(h('span', 'k-label', t('lobby.band')));
    this.bandLine = h('p', 'k-bandline', this.bandText(this.d.hub.status));
    band.append(this.bandLine, sw(t('lobby.bandUse'), this.prefs.band, v => { this.prefs.band = v; }));
    if (this.d.hub.tool === 'fnirs') band.append(sw(t('lobby.raw'), this.prefs.raw, v => { this.prefs.raw = v; }));
    sec.append(band);
    const p = g ? this.progress.get(g.id) : undefined;
    if (g) {
      const max = g.create({ rng: Math.random, level: 1 }).maxLevel;
      sec.append(h('p', 'k-muted', p ? t('lobby.startLevel', { n: this.startLevel(g.id), max }) : t('lobby.firstTime')));
    }
    sec.append(startBtn);
    if (g && p && p.level > 1) sec.append(button(t('lobby.resetLevel'), () => {
      this.levelReset.add(g.id);
      this.render();
    }, 'k-btn-ui ghost'));
    return sec;
  }

  private readonly levelReset = new Set<GameId>();

  /** The level a game starts on: one below where the last session ended (a warm-up), at least 1. */
  private startLevel(id: GameId): number {
    if (this.levelReset.has(id)) return 1;
    const p = this.progress.get(id);
    return p ? Math.max(1, p.level - 1) : 1;
  }

  private bandText(s: HubStatus): string {
    if (!s.tool) return t('lobby.bandOff');
    const band = TOOL_INFO[s.tool].band;
    if (s.source === 'simulator') return t('lobby.bandSim', { band });
    if (s.source === 'device' && s.device.streaming) return s.signal.reliable || s.signal.reason === 'baseline'
      ? t('lobby.bandLive', { band }) : t('lobby.bandWait', { band, why: s.signal.reason ? REASON_TEXT[s.signal.reason] : '' });
    return t('lobby.bandOff');
  }

  private async checkRelay(): Promise<RelayInfo> {
    if (this.relay) return this.relay;
    try {
      const r = await fetch(new URL('/api/v1/duo/info', location.origin), { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { lan?: string[] };
      this.relay = { ok: true, lan: j.lan?.[0] ?? null };
    } catch (e) {
      this.relay = { ok: false, lan: null, error: e instanceof Error ? e.message : String(e) };
    }
    return this.relay;
  }

  private start(g: GameMeta | null, games: GameId[]): void {
    if (this.active) return;
    const levels: Partial<Record<GameId, number>> = {};
    const practice: Partial<Record<GameId, boolean>> = {};
    const bests: Partial<Record<GameId, number>> = {};
    for (const id of games) {
      levels[id] = this.startLevel(id);
      const p = this.progress.get(id);
      practice[id] = !p || p.sessions < 3;
      if (p?.best !== null && p?.best !== undefined) bests[id] = p.best;
      this.levelReset.delete(id);
    }
    const plan: SessionPlan = {
      kind: g ? 'game' : 'workout', games, seconds: g ? this.prefs.minutes * 60 : WORKOUT_SEC, pad: this.prefs.pad,
      marks: this.prefs.marks, band: this.prefs.band, raw: this.prefs.raw, levels, practice, bests,
      lanBase: this.relay?.lan ?? undefined,
    };
    this.layer.audioOn = this.prefs.sound;
    this.layer.open(plan);
  }

  private historyCard(id: GameId): HTMLElement {
    const sec = h('section', 'k-panel-card k-history');
    sec.append(h('h2', null, t('lobby.history')));
    const plays = this.sessions.flatMap(s => s.plays.filter(p => p.game === id).map(p => ({ s, p }))).slice(0, 12);
    if (!plays.length) {
      sec.append(h('p', 'k-muted', t('lobby.noHistory')));
      return sec;
    }
    const prog = this.progress.get(id);
    if (prog && prog.history.length > 1) {
      const c = h('canvas', 'k-spark big');
      c.setAttribute('aria-hidden', 'true');
      sec.append(c);
      requestAnimationFrame(() => drawSpark(c, prog.history.map(x => x[1])));
    }
    const unit = unitOf(id);
    const table = h('table', 'k-table');
    table.append(h('tr', null, h('th', null, ''), h('th', null, t(`sum.unit.${unit}`)),
      h('th', null, t('sum.accuracy')), h('th', null, t('sum.medianRt')), h('th', null, t('sum.level')), h('th', null, '')));
    for (const { s, p } of plays) {
      table.append(h('tr', null, h('td', null, fmtDate(s.start * 1000, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        h('td', null, fmtNum(headline(id, p.stats), unit === 'span' ? 0 : 1)), h('td', null, `${Math.round(p.stats.accuracy * 100)}%`),
        h('td', null, p.stats.medianRt === null ? '—' : `${Math.round(p.stats.medianRt)} ms`), h('td', null, String(p.levelEnd)),
        s.band ? h('td', 'k-muted', TOOL_INFO[s.band.tool].band) : h('td')));
    }
    sec.append(h('div', 'k-tablebox', table));
    return sec;
  }
}

/** Today as YYYY-MM-DD (local). */
export const dayKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A small picture of each game, drawn with the cards' own items. */
export function gameArt(id: GameId): HTMLElement {
  const box = h('div', 'k-art');
  const add = (...els: Element[]) => box.append(...els);
  switch (id) {
    case 'palce': add(itemSvg({ id: 'a', color: 'teal' }), itemSvg({ id: 'b', color: 'coral' }), itemSvg({ id: 'c', color: 'navy' })); break;
    case 'gesty': add(itemSvg({ id: 'a', color: 'magenta' }), itemSvg({ id: 'b', glyph: 'palm' }), itemSvg({ id: 'c', glyph: 'fist' })); break;
    case 'znaki': add(itemSvg({ id: 'a', glyph: 'okSign', color: 'coral' }), itemSvg({ id: 'b', glyph: 'vSign', color: 'navy' })); break;
    case 'cwiartki': add(itemSvg({ id: 'a', color: 'teal', look: 'cross' }), itemSvg({ id: 'b', color: 'coral', look: 'cross' })); break;
    case 'obie': add(splitTileSvg({ id: 'l', color: 'yellow' }, { id: 'r', color: 'teal' })); break;
    case 'stroop': add(itemSvg({ id: 'a', label: '2', color: 'coral' }), itemSvg({ id: 'b', label: '3', color: 'teal' })); break;
    case 'sekwencja': add(itemSvg({ id: 'a', color: 'navy' }), itemSvg({ id: 'b', color: 'coral' }), itemSvg({ id: 'c', color: 'purple' }), itemSvg({ id: 'd', color: 'yellow' })); break;
    case 'kod': add(itemSvg({ id: 'a', label: '1', color: 'coral' }), itemSvg({ id: 'b', label: '5', color: 'navy' }), itemSvg({ id: 'c', label: '7', color: 'magenta' })); break;
    case 'szlak': add(itemSvg({ id: 'a', label: '1' }), itemSvg({ id: 'b', label: '2' }), itemSvg({ id: 'c', label: '3' })); break;
    case 'szukaj': add(itemSvg({ id: 'a', color: 'coral' }), itemSvg({ id: 'b', color: 'peach' }), itemSvg({ id: 'c', color: 'coral' }), itemSvg({ id: 'd', color: 'yellow' })); break;
  }
  box.dataset.game = id;
  return box;
}

/** A headline's history as a small line. */
export function drawSpark(c: HTMLCanvasElement, values: readonly number[]): void {
  const r = c.getBoundingClientRect();
  if (!r.width || values.length < 1) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = r.width * dpr;
  c.height = r.height * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const w = r.width, hgt = r.height, pad = 4;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const x = (i: number) => pad + ((w - 2 * pad) * i) / Math.max(1, values.length - 1);
  const y = (v: number) => hgt - pad - ((hgt - 2 * pad) * (v - lo)) / span;
  ctx.strokeStyle = '#7B61FF';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
  ctx.fillStyle = '#FE6F61';
  ctx.beginPath();
  ctx.arc(x(values.length - 1), y(values[values.length - 1]), 3, 0, Math.PI * 2);
  ctx.fill();
}
