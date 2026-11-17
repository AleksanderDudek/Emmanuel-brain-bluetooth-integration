/**
 * Odporność's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the records, where the
 * run is (the loop, its place, the six stages with their stars), the six stages' illustrated glossary (round 11:
 * each stage's picture, what happens in the body, what you do, how long it really takes), the immune memory (each pathogen met, how
 * well it is remembered), the defenders that joined with play and what brings the others, the "Wiedza" cards
 * found — each with its number and its source — the song's switch, and the honest line: this visualises
 * real processes and trains attention; it does not heal and does not replace treatment.  Built with h().
 */
import { fmtNum, lang } from '../../i18n';
import { h } from '../../ui/dom';
import {
  FACTS, PATHOGEN, PATHOGENS, STAGES, UNLOCKS, factText, factTitle, loopSpec, pathogenName, pathogenText, placeName, stageBody, stageName,
  stageReal, stageYou, unlockName, unlockText, type PathogenId, type StageId,
} from './content';
import { t } from './i18n';
import { bestOf, memoryOf, starKey, type OdpProgress } from './meta';
import { coarsePointer } from '../kit/mobile';
import { paintBug, paintVirion } from './paint';
import { paintStagePicture } from './picture';
import { starText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** A little tile of a pathogen (drawn, pale while not met yet). */
function tile(id: PathogenId, met: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, '#f6c3bf');
    g.addColorStop(1, '#d9707f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 52, 40);
    ctx.globalAlpha = met ? 1 : 0.35;
    const spec = PATHOGEN[id];
    if (spec.virus) for (let i = 0; i < 3; i++) paintVirion(ctx, id, 16 + i * 10, 20 + (i % 2) * 6, 4, i);
    else for (let i = 0; i < 3; i++) paintBug(ctx, id, 15 + i * 11, 20 + (i % 2 ? 6 : -4), 4, { a: i * 0.8, t: 0, seed: i / 3, tag: 0, c3: false, capsule: false, netted: false, split: 0, pop: 1, fade: 0 });
    ctx.globalAlpha = 1;
  }
  return c;
}

/** A stage's picture for the glossary: the card's scene, still (the gesture caught mid-way). */
function stagePic(stage: StageId, loop: number): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const W = 104, H = 66;
  const c = h('canvas', { width: String(Math.round(W * dpr)), height: String(Math.round(H * dpr)), 'aria-hidden': 'true' });
  c.style.width = `${W}px`;
  c.style.height = `${H}px`;
  c.style.flex = '0 0 auto';
  c.style.borderRadius = '10px';
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const spec = loopSpec(loop);
    paintStagePicture(ctx, stage, 0, 0, W, H, 1.1, spec.bug, spec.virus);
  }
  return c;
}

/** The six stages in a few words each: what happens in the body, what you do, how long it really takes. */
function glossary(p: OdpProgress): HTMLElement[] {
  const mouse = !coarsePointer();
  return STAGES.map((s, i) => h('div', { class: 'arcade-daily' },
    stagePic(s, p.loop),
    h('div', null,
      h('b', null, `${i + 1}. ${stageName(s)}`),
      h('p', null, `${t('card.body')}: ${stageBody(s)}`),
      h('p', null, `${t('card.you')}: ${stageYou(s, mouse)}`),
      h('p', { class: 'muted' }, stageReal(s)))));
}

export function progressPanel(p: OdpProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => { save(); render(); })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: OdpProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const spec = loopSpec(p.loop);
  // where the run is: the loop's place and its six stages with their stars here
  const stages = h('div', { class: 'arcade-chips' }, STAGES.map((s, i) => {
    const stars = p.stars[starKey(p.loop, s)] ?? 0;
    const label = stars > 0 ? `${stageName(s)} ${starText(stars)}` : stageName(s);
    return h('span', { class: i < p.stage ? 'on' : i === p.stage ? 'on' : 'muted' }, i === p.stage ? `▸ ${label}` : label);
  }));
  // the immune memory
  const memory = h('div', { class: 'arcade-album' }, PATHOGENS.map(id => {
    const met = (p.met[id] ?? 0) > 0 || memoryOf(p, id) > 0;
    const lv = memoryOf(p, id);
    return h('div', { class: met ? (lv >= 3 ? 'on legend' : lv >= 2 ? 'on epic' : 'on') : null, title: met ? pathogenText(id) : '' },
      tile(id, met), met ? pathogenName(id) : '?', h('small', null, met ? `${t('panel.memLevel', { n: lv })} · ${fmtNum(p.met[id] ?? 0)}` : '—'));
  }));
  const anyMet = PATHOGENS.some(id => (p.met[id] ?? 0) > 0);
  // the defenders that joined, and what brings the others
  const cells = h('div', { class: 'arcade-chips' }, UNLOCKS.map(u => {
    const on = p.unlocks.includes(u.id);
    const need = u.afterTcells ? t('unlock.need.tcells') : t('unlock.need.total', { n: u.total ?? 0 });
    return h('span', { class: on ? 'on' : 'muted', title: unlockText(u.id) }, on ? unlockName(u.id) : `${unlockName(u.id)} · ${need}`);
  }));
  const joined = UNLOCKS.filter(u => p.unlocks.includes(u.id)).map(u => h('p', { class: 'muted' }, `${unlockName(u.id)}: ${unlockText(u.id)}`));
  // the Wiedza cards: the ones found, newest first, each with its source
  const found = FACTS.filter(f => p.facts.includes(f.id)).sort((a, b) => p.facts.indexOf(b.id) - p.facts.indexOf(a.id));
  const cards = found.map(f => h('div', { class: 'arcade-daily' },
    h('div', null, h('b', null, `${factTitle(f.id)} · ${stageName(f.stage)}`), h('p', null, factText(f.id)), h('p', { class: 'muted' }, t('panel.src', { src: f.src })))));
  const locked = FACTS.length - found.length;
  // the song
  const songBtn = h('button', { class: p.song ? 'btn' : 'btn primary', type: 'button' }, p.song ? t('panel.songOn') : t('panel.songOff'));
  songBtn.addEventListener('click', e => {
    e.preventDefault();
    p.song = !p.song;
    changed();
  });
  const [q0, q1] = QUOTES[lang];
  const songRow = h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, t('panel.song')), h('p', null, `${q0}${t('song.v1.1')} ${t('song.v1.2').replace(/[;,]$/, '')}${q1}`)), songBtn);
  songBtn.style.marginLeft = 'auto';
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.combo'), p.bestCombo > 0 ? `×${p.bestCombo}` : '—'),
      stat(t('panel.loops'), fmtNum(p.loopsDone))),
    h('div', { class: 'arcade-sub' }, t('panel.where', { loop: p.loop, place: placeName(spec.place), stage: stageName(STAGES[p.stage] ?? 'alarm') })), stages,
    h('div', { class: 'arcade-sub' }, t('panel.stages')), ...glossary(p),
    h('div', { class: 'arcade-sub' }, t('panel.memory')), anyMet ? memory : h('p', { class: 'muted' }, t('panel.memoryNone')),
    h('div', { class: 'arcade-sub' }, t('panel.cells')), cells, ...joined,
    h('div', { class: 'arcade-sub' }, t('panel.facts', { n: found.length, all: FACTS.length })), ...cards,
    locked > 0 ? h('div', { class: 'arcade-chips' }, Array.from({ length: Math.min(locked, 12) }, () => h('span', { class: 'muted' }, t('panel.factLocked')))) : null,
    songRow,
    h('p', { class: 'muted' }, t('panel.note')),
  ];
  return out.filter((x): x is HTMLElement => !!x);
}

/** The page language's quotation marks (pl „…”, de „…“, sv ”…”, en “…”). */
const QUOTES: Record<'pl' | 'en' | 'de' | 'sv', [string, string]> = { pl: ['„', '”'], en: ['“', '”'], de: ['„', '“'], sv: ['”', '”'] };
