/** Shared UI pieces for the DOM screens layered over the canvas. */
import { $, h } from '../../../src/ui/dom';
import type { Verse } from '../types';

export { $, h };

/** Show a full screen (menus) or a modal over the running game. */
export function showScreen(node: HTMLElement, modal = false): void {
  const o = $('overlay');
  o.replaceChildren(node);
  o.hidden = false;
  o.classList.toggle('modal', modal);
  // a dialog for assistive tech; the game behind it is out of reach (no Tab into the HUD)
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-modal', 'true');
  const title = node.querySelector('h1, h2');
  if (title) {
    title.id ||= 'screen-title';
    o.setAttribute('aria-labelledby', title.id);
  } else {
    o.removeAttribute('aria-labelledby');
  }
  setGameInert(true);
  o.scrollTop = 0;
  const focusable = node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('button, [href], input');
  focusable?.focus({ preventScroll: true });
}

export function hideScreen(): void {
  const o = $('overlay');
  o.replaceChildren();
  o.hidden = true;
  o.classList.remove('modal');
  o.removeAttribute('role');
  o.removeAttribute('aria-modal');
  o.removeAttribute('aria-labelledby');
  setGameInert(false);
}

function setGameInert(on: boolean): void {
  $('stage').inert = on;
  $('hud').inert = on;
}

export function verseEl(v: Verse, cls = 'verse'): HTMLElement {
  return h('blockquote', { class: cls }, h('p', null, `„${v.text}”`), h('cite', null, v.ref));
}

export function btn(label: string, onClick: () => void, cls = 'btn', attrs: Record<string, unknown> = {}): HTMLButtonElement {
  return h('button', { class: cls, type: 'button', ...attrs, on: { click: onClick } }, label);
}

export function screen(cls: string, ...kids: (Node | string | null | false | (Node | null | false)[])[]): HTMLElement {
  return h('div', { class: `screen ${cls}` }, ...kids);
}

/** A header with a back button, used by the menus reached from the Tree. */
export function topBar(title: string, onBack: () => void): HTMLElement {
  return h('header', { class: 'topbar' }, btn('← Drzewo', onBack, 'btn ghost'), h('h2', null, title));
}

export function paragraphs(text: string | string[]): HTMLElement[] {
  const parts = Array.isArray(text) ? text : text.split(/\n\n+/);
  return parts.map(p => h('p', null, p));
}

let bannerTimer: ReturnType<typeof setTimeout> | undefined;
/** A gentle verse banner over the game (e.g. the first time a truth is digested). */
export function verseBanner(title: string, v: Verse, ms = 4500): void {
  const b = $('banner');
  b.replaceChildren(h('strong', null, title), verseEl(v, 'verse small'));
  b.hidden = false;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.classList.remove('show'); setTimeout(() => { b.hidden = true; }, 400); }, ms);
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
