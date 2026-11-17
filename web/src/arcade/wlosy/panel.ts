/**
 * Każdy włos's "Postępy" card in the lobby (DESIGN.md §15), from the app's shared classes (styles.css):
 *
 *   the numbers    the most hairs, sessions, meditations completed, all the hairs numbered so far
 *   what it is     how it works, and plainly what it is not (not a treatment; a dermatologist for sudden or patchy loss)
 *   the mode       in order · just this one · repeat (a radio row; saved at once)
 *   the library    the eight meditations as picture tiles — choose one (the next session begins there, or resumes
 *                  where it stopped), with how many of its scenes have grown and how often it was completed
 *   the colour     the player's hair colour (the melanocytes and every strand take it)
 *   the music      the quiet tune's switch
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { COLOUR, COLOURS, MED, MEDS, MODES, colourName, medLine, medName, modeName, sceneAt, sceneCount, sceneName, type HairColour } from './content';
import { t } from './i18n';
import { bestOf, choose, medsDone, scenesGrown, setColour, setMode, type WlosyProgress } from './meta';
import { drawTile } from './preview';
import { secText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string | (Node | string)[], onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A small swatch of a hair colour: the strand with its sheen (a canvas, no style in markup). */
function swatch(c: HairColour): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const cv = h('canvas', { width: String(Math.round(22 * dpr)), height: String(Math.round(14 * dpr)), 'aria-hidden': 'true' });
  cv.style.width = '22px';
  cv.style.height = '14px';
  cv.style.verticalAlign = 'middle';
  cv.style.marginRight = '6px';
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const col = COLOUR[c];
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = col.strand;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(3 + i * 4.5, 12);
      ctx.quadraticCurveTo(5 + i * 4.5, 6, 8 + i * 4.5, 2);
      ctx.stroke();
      ctx.strokeStyle = col.sheen;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  return cv;
}

export function progressPanel(p: WlosyProgress, save: () => void): HTMLElement {
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

function build(p: WlosyProgress, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.meds'), `${medsDone(p)}/8`),
    stat(t('panel.total'), fmtNum(p.hairs))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), h('p', null, t('panel.not')));

  // ── the mode ──
  const modeBtn = (m: (typeof MODES)[number]) => button(modeName(m), () => { if (setMode(p, m)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.mode === m) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.mode')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.mode') }, MODES.map(modeBtn)),
    h('p', { class: 'muted' }, t(`panel.modeNote.${p.mode}` as 'panel.modeNote.order')));

  // ── the library ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.library', { done: medsDone(p) })));
  const grid = h('div', { class: 'scenes', role: 'radiogroup', 'aria-label': t('panel.library', { done: medsDone(p) }) });
  for (const m of MEDS) {
    const cv = h('canvas', { width: '320', height: '200', 'aria-hidden': 'true' });
    const times = p.whole[m] ?? 0;
    // the tile's caption: the name, and how many times it was completed (a check and ×n), or its scenes grown so far
    const grown = scenesGrown(p, m);
    const mark = times > 0 ? ` · ✓ ${times}×` : grown > 0 ? ` · ${grown}/${MED[m].scenes.length}` : '';
    const tile = button([cv, h('span', null, `${medName(m)}${mark}`)], () => { if (choose(p, m)) changed(); }, 'scene', {
      role: 'radio', 'aria-checked': String(p.chosen === m), 'aria-label': `${medName(m)} — ${medLine(m)}`,
    });
    grid.append(tile);
    drawTile(cv, m, p.colour, scenesGrown(p, m) > 0);
  }
  out.push(grid);
  const m = p.chosen;
  const times = p.whole[m] ?? 0;
  out.push(h('p', null, t('panel.chosen', { med: medName(m), line: medLine(m) })),
    h('p', { class: 'muted' }, t('panel.medStat', { done: scenesGrown(p, m), of: MED[m].scenes.length, times: times > 0 ? t('times', { n: times }) : t('panel.never') })),
    h('p', { class: 'muted' }, t('panel.resume', { med: medName(p.pos.med), n: p.pos.scene + 1, of: sceneCount(p.pos.med), scene: sceneName(sceneAt(p.pos.med, p.pos.scene)) })),
    h('p', { class: 'muted' }, t('panel.libNote')));

  // ── the colour ──
  const colBtn = (c: HairColour) => button([swatch(c), colourName(c)], () => { if (setColour(p, c)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.colour === c) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.colour')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.colour') }, COLOURS.map(colBtn)),
    h('p', { class: 'muted' }, t('panel.colourNote')));
  if (p.abideBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.abideBest)}`));

  // ── the music ──
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
  box.checked = p.song;
  box.addEventListener('change', () => {
    p.song = box.checked;
    changed();
  });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.song')), h('label', { class: 'switch' }, box, h('span', null, t('panel.song'))),
    h('p', { class: 'muted' }, t('panel.songNote')));
  return out;
}
