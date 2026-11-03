/**
 * The paper session (src/cards/DESIGN.md §6.2): a printed card (or one open on a tablet) done
 * with the band on, as a small block-design experiment.  Rest, slow attempt, rest, medium, rest,
 * fast, rest — the book's own three paces, each timed against the target it prints under its
 * tortoise, dog and cheetah, with the band's activity kept per block.  The first rest is the
 * band's reference; the rests between attempts give the contrast that a single task cannot.
 */
import type { Hub, HubSample } from '../../hub';
import { REASON_TEXT } from '../../hub';
import { fmtNum } from '../../i18n';
import { TOOL_INFO } from '../../tools';
import type { TrainingResult } from '../../training/score';
import { cardImage, titleKey, type CardInfo } from '../catalog';
import { t } from '../i18n';
import { tc } from '../i18n-cards';
import type { CardSession, CardStore, PaperRecord, PaperSpeed } from '../store';
import { BandTrack } from './band';
import { drawSeries } from './layer';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k !== null) el.append(k);
  return el;
};
const button = (label: string, fn: () => void, cls = 'k-btn-ui'): HTMLButtonElement => {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
};

export interface PaperDeps {
  hub: Hub;
  store: CardStore;
  saveTraining: (r: TrainingResult) => Promise<void>;
  mark: (label: string) => void;
  onSaved: (s: CardSession) => void;
  onClose: () => void;
}

const FIRST_REST = 20;
const REST = 15;
const SPEEDS: PaperSpeed[] = ['slow', 'medium', 'fast'];

type Phase = { kind: 'intro' } | { kind: 'rest'; until: number; next: PaperSpeed | null; first: boolean } | { kind: 'task'; speed: PaperSpeed; from: number; max: number } | { kind: 'rate' };

export class PaperRun {
  private root: HTMLElement | null = null;
  private card: CardInfo | null = null;
  private phase: Phase = { kind: 'intro' };
  private band: BandTrack | null = null;
  private bandMeta: { source: 'device' | 'simulator'; device: string } | null = null;
  private blocks: PaperRecord['blocks'] = [];
  private raf = 0;
  private startedAt = 0;
  private body: HTMLElement | null = null;
  private clock: HTMLElement | null = null;
  private why: HTMLElement | null = null;
  private readonly onSample = (e: Event) => {
    const s = (e as CustomEvent<HubSample>).detail;
    this.band?.onSample(s);
    if (this.why && this.band) this.why.textContent = !this.band.reliable && this.band.reason ? t('run.baseWaiting', { why: REASON_TEXT[this.band.reason] }) : '';
  };

  constructor(private readonly d: PaperDeps) {}

  get active(): boolean { return this.root !== null; }

  open(c: CardInfo): void {
    if (this.root) return;
    this.card = c;
    this.blocks = [];
    this.startedAt = Date.now() / 1000;
    const root = h('div', 'k-layer k-theme k-paper');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    const cardEl = h('div', 'k-card k-board');
    const head = h('header', 'k-head', h('span', 'k-badge', c.id), h('div', 'k-titles', h('h1', 'k-title', t('paper.title', { n: c.n })), h('p', 'k-sub', tc(titleKey(c)))));
    this.clock = h('span', 'k-clock');
    head.append(h('div', 'k-meta', this.clock, button('✕', () => this.close(), 'k-icon-btn')));
    this.body = h('div', 'k-stagebox k-paper-body');
    cardEl.append(head, this.body);
    root.append(h('div', 'k-shell', cardEl));
    document.body.append(root);
    this.root = root;
    document.querySelector('.app')?.setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    this.d.hub.addEventListener('sample', this.onSample);
    this.intro();
    this.raf = requestAnimationFrame(this.frame);
  }

  private close(): void {
    cancelAnimationFrame(this.raf);
    this.d.hub.removeEventListener('sample', this.onSample);
    this.root?.remove();
    this.root = null;
    this.band = null;
    document.querySelector('.app')?.removeAttribute('inert');
    document.documentElement.style.overflow = '';
    this.d.onClose();
  }

  private live(): boolean {
    const s = this.d.hub.status;
    return !!s.tool && (s.source === 'simulator' || (s.source === 'device' && s.device.streaming));
  }

  private intro(): void {
    const c = this.card!;
    this.phase = { kind: 'intro' };
    const img = h('img', 'k-paper-img');
    img.src = cardImage(c, 'thumb');
    img.alt = '';
    const s = this.d.hub.status;
    const bandText = s.tool && this.live() ? (s.source === 'simulator' ? t('lobby.bandSim', { band: TOOL_INFO[s.tool].band }) : t('lobby.bandLive', { band: TOOL_INFO[s.tool].band })) : t('lobby.bandOff');
    this.body!.replaceChildren(h('div', 'k-paper-intro', img, h('div', null, h('p', 'k-lede', t('paper.lede')), h('p', 'k-bandline', bandText),
      button(t('paper.start'), () => this.begin(), 'k-btn-ui primary big'))));
  }

  private begin(): void {
    const s = this.d.hub.status;
    if (s.tool && this.live()) {
      this.band = new BandTrack(s.tool);
      this.bandMeta = { source: s.source === 'simulator' ? 'simulator' : 'device', device: s.device.name ?? TOOL_INFO[s.tool].device };
      this.band.startBaseline();
    }
    this.d.mark(`karty:papier:${this.card!.id}:start`);
    this.rest(SPEEDS[0], true);
  }

  private target(speed: PaperSpeed): number | null {
    const row = this.card!.times[0];
    return row ? row[SPEEDS.indexOf(speed)] : null;
  }

  private rest(next: PaperSpeed | null, first = false): void {
    this.phase = { kind: 'rest', until: performance.now() + (first ? FIRST_REST : REST) * 1000, next, first };
    if (!first) this.band?.setPhase('rest');
    const bar = h('div', 'k-bar');
    bar.append(h('i'));
    this.why = h('p', 'k-why');
    this.body!.replaceChildren(h('div', 'k-message', h('h2', null, t('paper.rest')),
      h('p', null, t('paper.restText', { next: next ? t(`speed.${next}`) : t('paper.rate') })), bar, this.why));
  }

  private task(speed: PaperSpeed): void {
    const target = this.target(speed);
    // an attempt that runs three times its target (at least two minutes) is closed as not finished
    this.phase = { kind: 'task', speed, from: performance.now(), max: Math.max(120, (target ?? 40) * 3) * 1000 };
    this.band?.blockStart(`papier:${speed}`);
    this.d.mark(`karty:papier:${speed}:start`);
    this.body!.replaceChildren(h('div', 'k-message k-task', h('p', 'k-eyebrow', t(`speed.${speed}`)),
      h('h2', 'k-bigclock', '0,0 s'),
      h('p', null, target ? t('paper.taskText', { target: t('card.sec', { n: target }) }) : t('paper.taskNoTarget')),
      button(t('paper.done'), () => this.taskDone(true), 'k-btn-ui primary big')));
  }

  private taskDone(finished: boolean): void {
    const p = this.phase;
    if (p.kind !== 'task') return;
    const sec = (performance.now() - p.from) / 1000;
    this.blocks.push({ speed: p.speed, sec: finished ? Math.round(sec * 10) / 10 : null, target: this.target(p.speed) });
    this.band?.blockEnd();
    this.d.mark(`karty:papier:${p.speed}:${finished ? 'done' : 'timeout'}`);
    const i = SPEEDS.indexOf(p.speed);
    this.rest(SPEEDS[i + 1] ?? null);
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const p = this.phase;
    if (p.kind === 'rest') {
      const total = (p.first ? FIRST_REST : REST) * 1000;
      const left = Math.max(0, p.until - now);
      const bar = this.body?.querySelector<HTMLElement>('.k-bar i');
      if (bar) bar.style.width = `${Math.round((1 - left / total) * 100)}%`;
      if (this.clock) this.clock.textContent = `0:${String(Math.ceil(left / 1000)).padStart(2, '0')}`;
      // the first rest also takes the band's reference: it waits for it (motion, contact) before the first attempt
      const waiting = p.first && this.band && !this.band.calibrated;
      if (left <= 0 && !waiting) {
        if (p.next) this.task(p.next); else this.rate();
      }
    } else if (p.kind === 'task') {
      const sec = (now - p.from) / 1000;
      const big = this.body?.querySelector('.k-bigclock');
      if (big) big.textContent = `${fmtNum(sec, 1)} s`;
      if (this.clock) this.clock.textContent = '';
      if (now - p.from > p.max) this.taskDone(false);
    }
  };

  private rate(): void {
    this.phase = { kind: 'rate' };
    this.band?.setPhase('off');
    let stars: 1 | 2 | 3 | null = null;
    const starRow = h('div', 'k-seg');
    const renderStars = () => starRow.replaceChildren(...([1, 2, 3] as const).map(n => {
      const b = button('★'.repeat(n), () => { stars = n; renderStars(); }, `k-chip${stars === n ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(stars === n));
      return b;
    }));
    renderStars();
    const errors = h('input', 'k-input');
    errors.type = 'number';
    errors.min = '0';
    errors.max = '99';
    errors.inputMode = 'numeric';
    errors.setAttribute('aria-label', t('paper.errors'));
    const list = h('ul', 'k-paper-times', ...this.blocks.map(b => h('li', null, h('b', null, t(`speed.${b.speed}`)), ' ',
      b.sec === null ? t('paper.notDone') : b.target ? t('paper.vsTarget', { sec: t('card.sec', { n: fmtNum(b.sec, 1) }), target: t('card.sec', { n: b.target }) }) : t('card.sec', { n: fmtNum(b.sec, 1) }))));
    const save = button(t('paper.save'), () => void this.save(stars, errors.value === '' ? null : Math.max(0, Math.round(Number(errors.value)))), 'k-btn-ui primary big');
    this.body!.replaceChildren(h('div', 'k-message k-rate', h('h2', null, t('paper.rate')), h('h3', null, t('paper.result')), list,
      h('label', 'k-field', h('span', 'k-label', t('paper.stars')), starRow),
      h('label', 'k-field', h('span', 'k-label', t('paper.errors')), errors), save));
  }

  private async save(stars: 1 | 2 | 3 | null, errors: number | null): Promise<void> {
    const c = this.card!;
    const band = this.band && this.bandMeta ? this.band.record(this.bandMeta) : null;
    const session: CardSession = {
      v: 1, id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, kind: 'paper',
      start: this.startedAt, end: Date.now() / 1000, pad: null, plays: [], band, sync: null,
      paper: { card: c.n, blocks: this.blocks, stars, errors },
    };
    await this.d.store.put(session);
    this.d.mark(`karty:papier:${c.id}:end`);
    this.d.onSaved(session);
    if (this.band && this.bandMeta && this.band.scorer.playedSec >= 20) {
      const done = this.blocks.filter(b => b.sec !== null);
      const fastest = done.length ? Math.min(...done.map(b => b.sec!)) : 0;
      await this.d.saveTraining(this.band.toResult({ id: session.id, ...this.bandMeta, plannedSec: Math.round(this.band.scorer.playedSec) }, {
        id: 'karty:papier', title: `${t('card.number', { n: c.n })} · ${tc(titleKey(c))}`, score: fastest, unit: 's', best: null,
        stats: this.blocks.map(b => [t(`speed.${b.speed}`), b.sec === null ? '—' : `${fmtNum(b.sec, 1)} s`] as [string, string]),
      })).catch(e => console.error(e));
    }
    // the summary: the times and, with a band, its record
    const box = h('div', 'k-message k-rate', h('h2', null, t('sum.saved')));
    if (band) {
      const canvas = h('canvas', 'k-chart k-band-chart');
      const lines = band.blocks.map(b => h('p', null, `${t(`speed.${b.game.split(':')[1] as PaperSpeed}`)}: ${b.mean === null ? '—' : `${b.mean >= 0 ? '+' : '−'}${fmtNum(Math.abs(b.mean), 1)}%`}`));
      box.append(h('h3', null, t('sum.bandTitle', { band: TOOL_INFO[band.tool].band })), ...lines,
        h('p', null, `${t('sum.bandRest')}: ${band.restMean === null ? '—' : `${band.restMean >= 0 ? '+' : '−'}${fmtNum(Math.abs(band.restMean), 1)}%`}`), canvas, h('p', 'k-note', t('sum.bandNote')));
      requestAnimationFrame(() => drawSeries(canvas, band.series));
    }
    box.append(button(t('sum.done'), () => this.close(), 'k-btn-ui primary'));
    this.body!.replaceChildren(box);
  }
}
