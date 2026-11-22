/**
 * Drzewo nad wodą's "Postępy" card in the lobby (DESIGN §18), from the app's shared classes (styles.css):
 *
 *   the numbers    the most fruits in a session, sessions, all the fruits, full trees (whole rounds of nine)
 *   the fruits     the nine as tiles (each its jewel once it has ripened, a ghost until then; how many times; the
 *                  ones ripe in this round of nine marked), the next fruit marked — a tap makes a fruit the next
 *                  session's first ("Zacznij od…")
 *   the posture    seated (the default, safer) or standing, with the note on dizziness
 *   the season     auto (the calendar's; the year turns through a session of 15 minutes and more) or one season
 *   the breath     the rest's rhythm: the kit's presets as one-tap chips (4 · 6 by default)
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, sameBreath } from '../kit/breath';
import { coarsePointer } from '../kit/mobile';
import { FRUITS, POSTURES, SEASON_MODES, type FruitId } from './content';
import { breathWords, cap, fruitName, t, type Key } from './i18n';
import { bestOf, breathOf, ripeCount, setBreath, setNext, setPosture, setSeason, type DrzewoProgress } from './meta';
import { drawFruit } from './paint';
import { secText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: 'btn', type: 'button', ...extra }, text);
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A fruit's tile: its jewel (ripe) or a ghost of its blossom. */
function tile(f: FruitId, ripe: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(44 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#121a14';
  ctx.fillRect(0, 0, 52, 44);
  drawFruit(ctx, f, 26, 24, 11, ripe ? 1 : 0.2, false, ripe ? 1 : 0.55);
  return c;
}

export function progressPanel(p: DrzewoProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => { save(); render(); })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: DrzewoProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.fruitsAll'), fmtNum(p.fruits)),
    stat(t('panel.harvests'), fmtNum(p.harvests))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));

  // ── the nine fruits ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.album')));
  out.push(h('p', null, `${t('panel.round', { n: ripeCount(p) })} · ${t('panel.next', { fruit: cap(fruitName(FRUITS[p.next])) })}`));
  out.push(h('div', { class: 'arcade-album' }, FRUITS.map((f, i) => {
    const n = p.count[f] ?? 0, here = p.next === i, ripe = !!p.ripe[i];
    const pick = () => { if (setNext(p, i)) changed(); };
    return h('div', {
      class: here ? 'on epic' : ripe ? 'on rare' : n > 0 ? 'on' : null,
      role: 'button', tabindex: '0', 'aria-pressed': String(here),
      'aria-label': t('panel.startHere', { fruit: fruitName(f) }),
      title: `${cap(fruitName(f))} — ${t(`fruit.${f}.r1` as Key)}`,
      on: {
        click: (e: Event) => { e.preventDefault(); pick(); },
        keydown: (e: Event) => {
          const k = (e as KeyboardEvent).key;
          if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(); }
        },
      },
    }, tile(f, n > 0 || ripe), cap(fruitName(f)), h('small', null, here ? t('panel.here') : n > 0 ? t('panel.times', { n }) : t('panel.never')));
  })));
  out.push(h('p', { class: 'muted' }, t(coarsePointer() ? 'panel.albumNote' : 'panel.albumNote.click')));

  // ── the posture ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.posture')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.posture') },
      POSTURES.map(ps => button(t(`posture.${ps}` as Key), () => { if (setPosture(p, ps)) changed(); }, { role: 'radio', 'aria-checked': String(p.posture === ps) }))),
    h('p', { class: 'muted' }, t('panel.postureNote')));

  // ── the season ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.season')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.season') },
      SEASON_MODES.map(s => button(t(`season.${s}` as Key), () => { if (setSeason(p, s)) changed(); }, { role: 'radio', 'aria-checked': String(p.season === s) }))),
    h('p', { class: 'muted' }, t('panel.seasonNote')));

  // ── the breath ──
  const b = breathOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
      Object.entries(BREATH_PRESETS).map(([k, pat]) => button(t(`preset.${k}` as Key), () => { setBreath(p, pat); changed(); }, { role: 'radio', 'aria-checked': String(sameBreath(b, pat)) }))),
    h('p', { class: 'muted' }, `${t('panel.breathNote')} (${breathWords(b)})`));

  out.push(h('p', { class: 'muted' }, t('panel.lengths')));
  if (p.streams > 0) out.push(h('p', null, t('panel.streams', { n: p.streams })));
  if (p.calmBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.calmBest)}`));
  return out;
}
