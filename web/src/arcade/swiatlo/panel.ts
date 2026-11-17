/**
 * Światło ciała's "Postępy" card in the lobby (DESIGN.md §13.10), from the app's shared classes (styles.css):
 *
 *   the numbers     the record, sessions, places lit, whole meditations
 *   what it is      how it works in one paragraph, and plainly what it is not (not a treatment)
 *   the meditation  five to choose (a radio row; saved at once), its line, where it goes on ("Kontynuuj od: …") and
 *                   "Od początku"
 *   the album       the chosen meditation's places as tiles — each its own shape, lit once focus filled it; a tap
 *                   makes it the next start ("▶ tu zaczniesz")
 *   the music       the lullaby's switch
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { coarsePointer } from '../kit/mobile';
import { BRAIN_BOX } from './brain';
import { LISTS, VARIANTS, count, elName, elementAt, isBrainView, variantLine, variantName, type Element, type VariantId } from './content';
import { geoBox } from './figure';
import { t } from './i18n';
import { fitCam } from './layout';
import { bestOf, choose, litIn, restart, startAt, type SwiatloProgress } from './meta';
import { bakeNight } from './paint';
import { drawBrain, drawFigure } from './picture';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A little tile of an element: its own shape on a glimpse of the picture, lit in its colour once it was lit. */
function tile(e: Element, lit: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (!ctx || typeof Path2D === 'undefined') return c;
  const night = bakeNight(52, 40, dpr, 26, 20);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (night) ctx.drawImage(night, 0, 0, 52, 40);
  const box = { x: 2, y: 2, w: 48, h: 36 };
  const st = { current: null, fill: 0, lit: () => (lit ? 1 : 0), filling: false, blind: false, rest: false, breath: 0, time: 0 };
  if (isBrainView(e.view)) {
    const cam = fitCam(box, BRAIN_BOX.x0, BRAIN_BOX.y0, BRAIN_BOX.x1, BRAIN_BOX.y1, 1);
    drawBrain(ctx, dpr, cam, e.view as 'lat' | 'med', [e], { ...st, lit: () => (lit ? 1 : 0.6) });
  } else {
    const [x0, y0, x1, y1] = geoBox(e.geo);
    const pad = Math.max(0.03, (y1 - y0) * 0.25);
    const cam = fitCam(box, x0 - pad, y0 - pad, x1 + pad, y1 + pad, 0);
    drawFigure(ctx, dpr, cam, e.view === 'back', [e], { ...st, lit: () => (lit ? 1 : 0.6) });
  }
  return c;
}

export function progressPanel(p: SwiatloProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

/** The album of a meditation: its places as tiles, each a button that makes it the next start. */
function album(p: SwiatloProgress, v: VariantId, changed: () => void): HTMLElement {
  const here = p.pos[v].idx;
  return h('div', { class: 'arcade-album' }, LISTS[v].map((e, i) => {
    const n = p.lit[e.id] ?? 0;
    const pick = () => { if (startAt(p, v, i)) changed(); };
    return h('div', {
      class: n > 0 ? 'on rare' : i === here ? 'on' : null,
      role: 'button', tabindex: '0', 'aria-pressed': String(i === here),
      'aria-label': `${i + 1}. ${elName(e)} — ${t('panel.here')}`,
      title: `${i + 1}. ${elName(e)} · ${e.latin}`,
      on: {
        click: (ev: Event) => { ev.preventDefault(); pick(); },
        keydown: (ev: Event) => {
          const k = (ev as KeyboardEvent).key;
          if (k === 'Enter' || k === ' ') { ev.preventDefault(); pick(); }
        },
      },
    }, tile(e, n > 0), `${i + 1}. ${elName(e)}`, h('small', null, i === here ? t('panel.here') : n > 0 ? `✦ ×${n}` : '○'));
  }));
}

function build(p: SwiatloProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  const litAll = VARIANTS.reduce((s, v) => s + litIn(p, v), 0);
  const wholeAll = VARIANTS.reduce((s, v) => s + (p.whole[v] ?? 0), 0);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.litAll'), fmtNum(litAll)),
    stat(t('panel.wholeAll'), fmtNum(wholeAll))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), h('p', null, t('panel.not')));

  // ── the meditation ──
  const v = p.variant;
  const vBtn = (x: VariantId) => button(variantName(x), () => { if (choose(p, x)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(v === x) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.choose')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.choose') }, VARIANTS.map(vBtn)),
    h('p', { class: 'muted' }, variantLine(v)));
  const place = p.pos[v];
  out.push(h('p', null, t('panel.cont', { name: elName(elementAt(v, place.idx)), n: place.idx + 1, of: count(v) })),
    h('div', { class: 'seg' }, button(t('panel.restart'), () => { restart(p, v); changed(); }, 'btn', { disabled: place.idx === 0 && place.fill === 0 ? '' : null })));

  // ── the album ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.album', { lit: litIn(p, v), all: count(v) })),
    album(p, v, changed),
    h('p', { class: 'muted' }, t(coarsePointer() ? 'panel.albumNote' : 'panel.albumNote.mouse')));

  // ── the music ──
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
  box.checked = p.song;
  box.addEventListener('change', () => {
    p.song = box.checked;
    changed();
  });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.song')), h('label', { class: 'switch' }, box, h('span', null, t('panel.song'))),
    h('p', { class: 'muted' }, t('panel.songNote')), h('p', { class: 'muted' }, t('panel.pulse')));
  return out;
}
