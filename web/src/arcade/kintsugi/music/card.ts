/**
 * The player card during a session (DOM over the canvas, placed in canvas CSS px; the card takes the pointer):
 * a title line "♪ title — performer" over the YouTube player, at the place the meditation's layout keeps for it
 * (`place(rect)`; without one, a lower corner inside the insets).  YouTube's terms (DESIGN.md §21.5): while a track
 * loads, plays or waits for a tap, the player is on screen, at least 200 × 200 CSS px (16:9 when the place is wide),
 * nothing over it, its own controls kept; when no track plays the card fades away and only the ambient plays.  A
 * session has two cards taking turns (one per player, kit/music.ts): the next track waits, cued, in the hidden one;
 * for a cross-fade the second card shows in its own place beside the first (`place(second)`) and, once the first has
 * faded away, glides into the first one's place.  When the browser wants a tap on the player first (iOS), a line
 * under (or over) the card asks for it once, with a button for the ambient alone.  Never an error on screen: a track
 * that cannot play is simply skipped by the director.
 */
import type { Insets } from '../../kit/types';
import { h } from '../../../ui/dom';
import { t } from './i18n';
import type { Rect } from './types';

/** After a cross-fade: the card that stood in the first place fades away (styles.css .kin-player, .9 s), then the next glides in. */
const GLIDE_WAIT = 950, GLIDE_MS = 900;

/** The player's least size (CSS px), and the title line over it. */
export const PLAYER_MIN = 200;
export const TITLE_H = 28;
const PAD = 12;

/** Where the card and its player go in a place `r` (canvas CSS px): the frame at least 200 × 200, 16:9 when wide. */
export function fitPlayer(r: Rect): { x: number; y: number; w: number; h: number } {
  const aw = Math.max(PLAYER_MIN, r.w), ah = Math.max(PLAYER_MIN, r.h - TITLE_H);
  const fh = Math.max(PLAYER_MIN, Math.min(ah, (aw * 9) / 16));
  const fw = Math.max(PLAYER_MIN, Math.min(aw, (fh * 16) / 9));
  return { x: Math.round(r.x + (r.w - fw) / 2), y: Math.round(r.y + Math.max(0, r.h - TITLE_H - fh) / 2), w: Math.round(fw), h: Math.round(fh) };
}

/** The fallback place: a lower right corner inside the insets. */
export function cornerPlace(w: number, h: number, ins: Insets): Rect {
  const cw = w >= 700 ? 356 : PLAYER_MIN;
  return { x: Math.max(ins.left + PAD, w - ins.right - PAD - cw), y: Math.max(ins.top + PAD, h - ins.bottom - PAD - PLAYER_MIN - TITLE_H), w: cw, h: PLAYER_MIN + TITLE_H };
}

export interface CardEnv {
  hud: HTMLElement;
  insets(): Insets;
  touch: boolean;
}

export class PlayerCard {
  readonly el: HTMLElement;
  /** the player's host: the iframe goes in here */
  readonly frame: HTMLElement;
  private readonly title: HTMLElement;
  private readonly tapBox: HTMLElement;
  private rect: Rect | null = null;
  private shown = false;
  private tapping = false;
  private text = '';
  private glideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly env: CardEnv, onAmbientOnly: () => void) {
    this.title = h('div', { class: 'kin-player-title' });
    this.frame = h('div', { class: 'kin-player-frame' });
    const only = h('button', { class: 'btn kin-player-only', type: 'button' }, t('mode.ambient'));
    only.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      onAmbientOnly();
    });
    this.tapBox = h('div', { class: 'kin-player-tap', role: 'status', 'aria-live': 'polite', hidden: true },
      h('p', null, t(env.touch ? 'player.tap' : 'player.tapMouse')), only);
    this.el = h('section', { class: 'kin-player', 'aria-label': t('head'), 'aria-hidden': 'true' }, this.title, this.frame, this.tapBox);
    // over the runner's coach marks (a hint bubble must never lie over the player), under its pause and summary
    // overlay: in the arcade's own layer right after the marks, at the HUD's offset; elsewhere (tests) in the HUD
    const wrap = env.hud.parentElement;
    const marks = wrap?.classList.contains('arcade') ? wrap.querySelector(':scope > .arcade-marks') : null;
    if (marks) marks.after(this.el);
    else env.hud.appendChild(this.el);
    this.layout();
  }

  /**
   * The meditation's place for the card (canvas CSS px), or null for the fallback corner; `glide`: the card is on
   * screen and moves there smoothly (after a cross-fade, from the second place into the first) — once the card that
   * stood there has faded away (GLIDE_WAIT), so the two never lie one over the other.
   */
  place(r: Rect | null, glide = false): void {
    this.rect = r && [r.x, r.y, r.w, r.h].every(Number.isFinite) ? { ...r } : null;
    if (this.glideTimer) { clearTimeout(this.glideTimer); this.glideTimer = null; this.el.classList.remove('glide'); }
    if (glide && this.shown) {
      this.glideTimer = setTimeout(() => {
        this.el.classList.add('glide');
        this.layout();
        this.glideTimer = setTimeout(() => { this.el.classList.remove('glide'); this.glideTimer = null; }, GLIDE_MS);
      }, GLIDE_WAIT);
      return;
    }
    this.layout();
  }

  /** Show or hide the card (a track loads, plays or waits for a tap on it); `tap`: ask for the tap; `title` names the track. */
  show(on: boolean, tap: boolean, title: string): void {
    if (title !== this.text) {
      this.text = title;
      this.title.textContent = title ? `♪ ${title}` : '';
    }
    if (on !== this.shown) {
      this.shown = on;
      this.el.classList.toggle('on', on);
      this.el.setAttribute('aria-hidden', String(!on));
    }
    if (tap !== this.tapping) {
      this.tapping = tap;
      this.tapBox.hidden = !tap;
      this.layout();
    }
  }

  get visible(): boolean { return this.shown; }

  /** Where the card stands now (canvas CSS px, the player's frame and its title line). */
  get box(): Rect {
    const f = this.fit();
    return { x: f.x, y: f.y, w: f.w, h: f.h + TITLE_H };
  }

  remove(): void {
    if (this.glideTimer) clearTimeout(this.glideTimer);
    this.el.remove();
  }

  private fit(): { x: number; y: number; w: number; h: number } {
    const hud = this.env.hud;
    let ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
    try { ins = this.env.insets(); } catch { /* a test env without insets */ }
    return fitPlayer(this.rect ?? cornerPlace(hud.clientWidth || 0, hud.clientHeight || 0, ins));
  }

  private layout(): void {
    const hud = this.env.hud;
    const W = hud.clientWidth || 0, H = hud.clientHeight || 0;
    let ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
    try { ins = this.env.insets(); } catch { /* a test env without insets */ }
    const f = fitPlayer(this.rect ?? cornerPlace(W, H, ins));
    const s = this.el.style;
    const inHud = this.el.parentElement === hud;
    s.left = `${f.x + (inHud ? 0 : hud.offsetLeft)}px`;
    s.top = `${f.y + (inHud ? 0 : hud.offsetTop)}px`;
    s.width = `${f.w}px`;
    this.frame.style.width = `${f.w}px`;
    this.frame.style.height = `${f.h}px`;
    // the tap line goes under the card when there is room, else over it — never over the player
    const below = f.y + TITLE_H + f.h + 8 + 96 <= H - ins.bottom || H === 0;
    const b = this.tapBox.style;
    b.top = below ? `${TITLE_H + f.h + 8}px` : '';
    b.bottom = below ? '' : `${TITLE_H + f.h + 8}px`;
  }
}
