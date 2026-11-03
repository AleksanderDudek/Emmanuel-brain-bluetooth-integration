/**
 * The board's stage (src/cards/DESIGN.md §5.4): the cue in the middle, the rule beside it, in the
 * look of the printed cards — a white panel on the cards' grey, flat colours, big shapes.  It only
 * draws what the trial loop asks for (loop.ts); timing does not depend on anything here except
 * that a draw happens inside the animation frame the loop was ticked in.
 */
import { itemSvg, splitTileSvg, tileSvg } from '../art/draw';
import type { PadItem } from '../duo/protocol';
import type { GameId, Legend, Stim, TrialSpec } from '../games/types';
import { CODE_KEY } from '../games/sequence';
import { t } from '../i18n';
import { COLORS } from '../palette';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

export class Stage {
  readonly el: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly main: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly count: HTMLElement;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private legendKey = '';
  marks = false;

  constructor(private readonly game: GameId) {
    this.el = h('div', 'k-stage-wrap');
    const panel = h('div', 'k-stage');
    this.cue = h('p', 'k-cue');
    this.main = h('div', 'k-stim');
    this.count = h('div', 'k-count');
    this.count.hidden = true;
    this.toast = h('p', 'k-toast');
    this.toast.hidden = true;
    panel.append(this.cue, this.main, this.count, this.toast);
    this.legend = h('aside', 'k-legend');
    this.legend.hidden = true;
    this.el.append(panel, this.legend);
  }

  private svg(it: PadItem): SVGSVGElement {
    return this.game === 'stroop' ? tileSvg(it, { marks: this.marks }) : itemSvg(it, { marks: this.marks });
  }

  /**
   * `ruled`: the current level has a rule at all (Szlak's number trails have none, its colour chains
   * do); without one the rule's panel is hidden, with one it shows the rule or "from memory".
   */
  show(stim: Stim, legend: Legend | null, cue: TrialSpec['cue'] | null, ruled = legend !== null): void {
    this.cue.textContent = cue === 'reverse' ? t('run.reverse') : cue === 'switch' ? t('run.switch') : '';
    this.cue.hidden = !cue;
    this.main.dataset.kind = stim.kind;
    this.main.replaceChildren(...this.draw(stim));
    this.renderLegend(legend, ruled);
  }

  private draw(s: Stim): Node[] {
    switch (s.kind) {
      case 'blank': return [];
      case 'item': {
        const n = Math.max(1, s.count ?? 1);
        const row = h('div', `k-row k-n${Math.min(n, 3)}`);
        for (let k = 0; k < n; k++) row.append(this.svg(s.item));
        return [row];
      }
      case 'pair': {
        if (s.joined === 'split') return [splitTileSvg(s.left, s.right, { marks: this.marks })];
        if (s.joined === 'one') return [this.svg(s.right)];
        const pair = h('div', 'k-pair');
        const side = (it: PadItem, label: string) => {
          const d = h('div', 'k-side');
          d.append(itemSvg(it, { marks: this.marks }), h('small', undefined, label));
          return d;
        };
        pair.append(side(s.left, t('run.leftHand')), side(s.right, t('run.rightHand')));
        return [pair];
      }
      case 'strip': {
        const strip = h('div', 'k-strip');
        s.items.forEach((it, k) => {
          const slot = h('div', 'k-slot');
          if (s.lit === k) {
            slot.classList.add('lit');
            slot.append(itemSvg(it, { marks: this.marks }));
          }
          strip.append(slot);
        });
        const label = h('p', 'k-strip-label', s.lit === null && s.shown >= s.items.length ? t('run.yourTurn') : t('run.watch'));
        return [strip, label];
      }
      case 'code': {
        const code = h('div', 'k-code');
        s.digits.forEach((d, k) => {
          if (k) code.append(h('span', 'k-dash', '–'));
          const dig = h('span', `k-digit${k < s.pos ? ' done' : k === s.pos ? ' now' : ''}`, String(d));
          if (k < s.pos) dig.style.setProperty('--c', COLORS[CODE_KEY[d - 1]]);
          code.append(dig);
        });
        return [code];
      }
      case 'target': {
        const row = h('div', 'k-row k-targets');
        for (const it of s.items) row.append(itemSvg(it, { marks: this.marks }));
        return [row, h('p', 'k-progress-text', t('run.found', { n: s.found, total: s.total })), this.bar(s.found / s.total)];
      }
      case 'trail': {
        const wrap = h('div', 'k-row');
        if (s.next) wrap.append(itemSvg(s.next, { marks: this.marks }));
        return [h('p', 'k-next', t('run.next')), wrap, h('p', 'k-progress-text', t('run.found', { n: s.done, total: s.total })), this.bar(s.done / s.total)];
      }
    }
  }

  private bar(p: number): HTMLElement {
    const b = h('div', 'k-bar');
    const f = h('i');
    f.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    b.append(f);
    return b;
  }

  private renderLegend(legend: Legend | null, ruled: boolean): void {
    this.legend.hidden = !ruled;
    if (!ruled) return;
    const key = legend ? JSON.stringify(legend) : 'memory';
    if (key === this.legendKey) return;
    this.legendKey = key;
    const head = h('p', 'k-legend-head', legend ? t('run.rule') : t('run.fromMemory'));
    if (!legend) {
      this.legend.classList.add('hidden-rule');
      this.legend.replaceChildren(head, h('p', 'k-legend-q', '?'));
      return;
    }
    this.legend.classList.remove('hidden-rule');
    const rows = legend.rows.map(r => {
      const row = h('div', 'k-legend-row');
      row.append(itemSvg(r.cue, { marks: this.marks }), h('span', 'k-arrow', '→'), itemSvg(r.answer, { marks: this.marks }));
      return row;
    });
    this.legend.replaceChildren(head, ...rows);
  }

  /** The board's own flash for a finished trial (green / red ring). */
  verdict(ok: boolean | null): void {
    if (ok === null) return;
    this.main.classList.remove('k-ok', 'k-bad');
    void this.main.offsetWidth;
    this.main.classList.add(ok ? 'k-ok' : 'k-bad');
  }

  countdown(n: number): void {
    this.count.hidden = n < 0;
    this.count.textContent = n > 0 ? String(n) : t('run.go');
    this.count.classList.remove('pop');
    void this.count.offsetWidth;
    this.count.classList.add('pop');
    if (n === 0) setTimeout(() => { this.count.hidden = true; }, 600);
  }

  /** A short line over the stage ("Poziom 4 — trudniej"). */
  note(text: string, ms = 1800): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast.hidden = true; }, ms);
  }

  /** A screen of its own in place of the cue (pause, rest, baseline). */
  message(title: string, text: string, extra: Node[] = []): void {
    const box = h('div', 'k-message');
    box.append(h('h2', undefined, title), h('p', undefined, text), ...extra);
    this.main.dataset.kind = 'message';
    this.main.replaceChildren(box);
    this.cue.hidden = true;
  }
}
