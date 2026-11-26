/**
 * A health visualisation's "Postępy" card in the lobby (DESIGN.md §24, Każdy włos's panel.ts), from the app's shared
 * classes (styles.css):
 *
 *   the place      where the next session resumes (the meditation, the scene)
 *   the numbers    the best session, sessions, meditations completed, all the units from focus
 *   what it is     how it works, and plainly what it is not (the game's `panel.not`: not a treatment, whom to see)
 *   the library    the meditations as picture tiles — choose one (the next session begins there, or resumes where it
 *                  stopped), with how many of its scenes have grown and how often it was completed; the chosen one's
 *                  line and its "Na co dzień"
 *   the mode       in order · just this one · repeat (a radio row; saved at once)
 *   the body       "Ciało słucha" (round 23, kit/innerpanel.ts): the word on the out-breath, the intention, the word
 *                  of peace, before sleep — shared by every health visualisation, kept on this device
 *   the look       the library's looks as chips (when it has any)
 *   the music      the quiet tune's switch (when the game has a tune)
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../../i18n';
import { h } from '../../../ui/dom';
import { innerPanel } from '../innerpanel';
import { MODES, libOf } from './lib';
import { bestOf, choose, medsDone, scenesGrown, setLook, setMode, type HealthProgress } from './meta';
import { drawTile } from './preview';
import { secText } from './sim';
import type { HealthLibrary } from './spec';

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

export function progressPanel(spec: HealthLibrary, p: HealthProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(spec, p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

function build(spec: HealthLibrary, p: HealthProgress, changed: () => void): HTMLElement[] {
  const lib = libOf(spec), t = lib.t;
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  const done = medsDone(spec, p);
  const of = lib.meds.length;

  // ── where it resumes ──
  if (p.sessions > 0) {
    out.push(h('p', null, t('panel.resume', { med: lib.medName(p.pos.med), n: p.pos.scene + 1, of: lib.sceneCount(p.pos.med), scene: lib.sceneName(lib.sceneAt(p.pos.med, p.pos.scene)) })));
  }
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.meds'), `${done}/${of}`),
    stat(t('panel.total'), fmtNum(p.units))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), h('p', null, t('panel.not')));

  // ── the library ──
  const libTitle = t('panel.library', { done, of });
  out.push(h('div', { class: 'arcade-sub' }, libTitle));
  const grid = h('div', { class: 'scenes', role: 'radiogroup', 'aria-label': libTitle });
  for (const m of lib.meds) {
    const cv = h('canvas', { width: '320', height: '200', 'aria-hidden': 'true' });
    const times = p.whole[m] ?? 0;
    // the tile's caption: the name, and how many times it was completed (a check and ×n), or its scenes grown so far
    const grown = scenesGrown(spec, p, m);
    const mark = times > 0 ? ` · ✓ ${times}×` : grown > 0 ? ` · ${grown}/${lib.sceneCount(m)}` : '';
    const tile = button([cv, h('span', null, `${lib.medName(m)}${mark}`)], () => { if (choose(spec, p, m)) changed(); }, 'scene', {
      role: 'radio', 'aria-checked': String(p.chosen === m), 'aria-label': `${lib.medName(m)} — ${lib.medLine(m)}`,
    });
    grid.append(tile);
    drawTile(spec, cv, m, p.look, grown > 0);
  }
  out.push(grid);
  const m = lib.isMed(p.chosen) ? p.chosen : lib.meds[0];
  const times = p.whole[m] ?? 0;
  out.push(h('p', null, t('panel.chosen', { med: lib.medName(m), line: lib.medLine(m) })),
    h('p', { class: 'muted' }, t('panel.medStat', { done: scenesGrown(spec, p, m), of: lib.sceneCount(m), times: times > 0 ? t('times', { n: times }) : t('panel.never') })));
  const care = lib.medCare(m);
  if (care) out.push(h('p', null, h('strong', null, `${t('story.care')}: `), care));
  out.push(h('p', { class: 'muted' }, t('panel.libNote')));

  // ── the mode ──
  const modeBtn = (md: (typeof MODES)[number]) => button(lib.modeName(md), () => { if (setMode(p, md)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.mode === md) });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.mode')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.mode') }, MODES.map(modeBtn)),
    h('p', { class: 'muted' }, t(`panel.modeNote.${p.mode}`)));

  // ── the body listens (round 23): its own section, saved on this device for every health visualisation ──
  out.push(innerPanel());

  // ── the look ──
  if (spec.looks.length) {
    const lookBtn = (l: string) => button(lib.lookName(l), () => { if (setLook(spec, p, l)) changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.look === l) });
    out.push(h('div', { class: 'arcade-sub' }, t('panel.look')),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.look') }, spec.looks.map(lookBtn)),
      h('p', { class: 'muted' }, t('panel.lookNote')));
  }
  if (p.abideBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(lib, p.abideBest)}`));

  // ── the music ──
  if (lib.hasTune) {
    const box = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
    box.checked = p.song;
    box.addEventListener('change', () => {
      p.song = box.checked;
      changed();
    });
    out.push(h('div', { class: 'arcade-sub' }, t('panel.song')), h('label', { class: 'switch' }, box, h('span', null, t('panel.song'))),
      h('p', { class: 'muted' }, t('panel.songNote')));
  }
  return out;
}
