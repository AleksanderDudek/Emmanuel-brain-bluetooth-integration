/**
 * The runner's breath pacer (DESIGN.md §19.3): in a rest block of any game that draws no breath guide of its own,
 * a pill at the top of the play area — a ring that fills with the lungs, the phase's seconds big in it, the phase in
 * a word beside it ("Wdech"), and which breath of the rest this is.  It turns the rest the games' tips describe
 * ("wdech na 4, wydech na 6") into one you can follow at a glance.
 *
 * DOM, not canvas, so it is the same over every game (src/arcade/kit/breathguide.ts is its canvas twin for the
 * meditations).  The CSP allows no inline styles: everything moves through CSSOM (`el.style.x`) and classes.
 */
import { t } from '../i18n/rhythm';
import { BREATH_DEFAULT, breathAt, breathCycle, type BreathPattern, type BreathPhase, type BreathState } from './kit/breath';
import { breathOf, breathWords } from './kit/breathguide';
import { h } from '../ui/dom';

/** The default rest breath of the block games (their tips say "wdech na 4, wydech na 6"). */
export const PACER_PATTERN: BreathPattern = BREATH_DEFAULT;

/** What the pacer shows for a rest block `sec` seconds in, with `left` seconds to go (null: unknown). */
export function pacerState(sec: number, left: number | null, own: BreathState | null, pattern: BreathPattern = PACER_PATTERN): { b: BreathState; n: number; of: number | null } {
  const b = own ?? breathAt(pattern, sec);
  const cyc = breathCycle(pattern);
  // a game's own breath counts its own cycles; the default counts from the rest's start
  const n = b.n + 1;
  const of = own ? null : left !== null && Number.isFinite(left) ? Math.max(n, Math.round((sec + left) / cyc)) : null;
  return { b, n, of };
}

export class BreathPacer {
  readonly el: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly arc: HTMLElement;
  private readonly secs: HTMLElement;
  private readonly word: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly words: Record<BreathPhase, string> = breathWords();
  private memo: Record<string, string> = {};
  private shown = false;

  constructor() {
    this.fill = h('i', { class: 'ab-fill' });
    this.arc = h('i', { class: 'ab-arc' });
    this.secs = h('b', { class: 'ab-sec mono' });
    this.word = h('b', { class: 'ab-word' });
    this.sub = h('small', { class: 'ab-sub' });
    this.el = h('div', { class: 'arcade-breath', role: 'img', hidden: true, 'data-phase': 'in' },
      h('span', { class: 'ab-ring', 'aria-hidden': 'true' }, this.fill, this.arc, this.secs),
      h('span', { class: 'ab-text', 'aria-hidden': 'true' }, this.word, this.sub));
  }

  private put(key: string, el: HTMLElement, text: string): void {
    if (this.memo[key] === text) return;
    this.memo[key] = text;
    el.textContent = text;
  }

  /** Show the breath (null hides the pacer). */
  update(s: { b: BreathState; n: number; of: number | null } | null): void {
    if (!s) {
      if (this.shown) {
        this.shown = false;
        this.el.hidden = true;
        this.memo = {};
      }
      return;
    }
    if (!this.shown) {
      this.shown = true;
      this.el.hidden = false;
    }
    const { b } = s;
    if (this.memo.phase !== b.phase) {
      this.memo.phase = b.phase;
      this.el.dataset.phase = b.phase;
      this.el.setAttribute('aria-label', t('breath.label', { phase: this.words[b.phase] }));
    }
    this.put('word', this.word, this.words[b.phase]);
    this.put('sec', this.secs, String(Math.max(1, Math.ceil(b.left - 1e-6))));
    this.put('sub', this.sub, s.of !== null ? breathOf(s.n, s.of) : '');
    // the lungs: 0.34…1 of the ring; the phase's progress: a conic sweep (CSSOM custom properties)
    const k = `${(0.34 + 0.66 * Math.max(0, Math.min(1, b.k))).toFixed(3)}`;
    if (this.memo.k !== k) { this.memo.k = k; this.fill.style.transform = `scale(${k})`; }
    const p = `${Math.round(Math.max(0, Math.min(1, b.p)) * 360)}deg`;
    if (this.memo.p !== p) { this.memo.p = p; this.arc.style.setProperty('--ab-p', p); }
  }
}
