/**
 * Synapsy's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the records
 * (the best session, the synapses kept, the fastest path, the longest the halves were in step), the map of the
 * mind (a small drawing of the player's brain with the regions lit and the links they kept), the ladder of
 * lessons, the Wiedza album (each card's number, sentence and source; the ones still to find), the song's
 * switch, and two plain notes: what the band's halves are, and that this is not a treatment.  Built with h();
 * the switch saves at once.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { makeBrain, type RegionId } from './brain';
import { CARDS, LESSONS, REGIONS, cardSrc, cardText, cardTitle, lessonAt, lessonTitle, msText, regionName, secText } from './content';
import { t } from './i18n';
import { bestOf, keptSynapses, wiring, type SynapsyProgress } from './meta';
import { C, ctx2d, glow, hemiPath, withAlpha } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** Where each region glows on the little map (brain units). */
const SPOT: Readonly<Record<RegionId, [number, number][]>> = {
  plan: [[-0.4, -0.72], [0.4, -0.72]],
  move: [[-0.46, -0.3], [0.46, -0.3]],
  touch: [[-0.44, -0.04], [0.44, -0.04]],
  hear: [[-0.8, 0.12], [0.8, 0.12]],
  lang: [[-0.78, -0.42], [-0.7, 0.42]],
  mem: [[-0.24, 0.2], [0.24, 0.2]],
  vision: [[-0.42, 0.78], [0.42, 0.78]],
  bridge: [[0, 0.13]],
};

/** The map of the mind: the player's brain, the regions lit, the kept links in gold. */
function mapCanvas(p: SynapsyProgress): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const W = 220, H = 200;
  const c = h('canvas', { width: String(Math.round(W * dpr)), height: String(Math.round(H * dpr)), 'aria-hidden': 'true' });
  // sized through the CSSOM (no style attribute): the map at its drawn size, never wider than the card
  c.style.width = `${W}px`;
  c.style.maxWidth = '100%';
  c.style.aspectRatio = `${W} / ${H}`;
  c.style.height = 'auto';
  c.style.display = 'block';
  c.style.alignSelf = 'center';
  c.style.borderRadius = '14px';
  const ctx = ctx2d(c);
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg1;
  ctx.fillRect(0, 0, W, H);
  const s = 92, cx = W / 2, cy = H / 2;
  for (const side of [-1, 1] as const) {
    const path = hemiPath(cx, cy, s, side);
    ctx.fillStyle = C.tissue2;
    ctx.fill(path);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = withAlpha(C.rim, 0.6);
    ctx.stroke(path);
  }
  const B = makeBrain(p.seed || 777);
  const wire = wiring(p, n => B.neurons[n]?.region ?? null);
  ctx.globalCompositeOperation = 'lighter';
  for (const r of REGIONS) {
    if (!p.regions.includes(r)) continue;
    const k = Math.min(1, 0.45 + wire[r] * 0.08);
    for (const [x, y] of SPOT[r]) glow(ctx, r === 'bridge' ? C.bridgeOn : r === 'plan' ? C.halo : C.gold, cx + x * s, cy + y * s, s * 0.3, 0.55 * k);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  for (const [a, b] of p.links) {
    const A = B.neurons[a], N = B.neurons[b];
    if (!A || !N) continue;
    ctx.beginPath();
    ctx.moveTo(cx + A.x * s, cy + A.y * s);
    ctx.lineTo(cx + N.x * s, cy + N.y * s);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = withAlpha(C.goldHi, 0.85);
    ctx.stroke();
  }
  for (const n of B.neurons) {
    ctx.beginPath();
    ctx.arc(cx + n.x * s, cy + n.y * s, n.io ? 2.6 : 1.6, 0, Math.PI * 2);
    ctx.fillStyle = n.io ? C.goldHi : withAlpha(C.soma, 0.8);
    ctx.fill();
  }
  return c;
}

export function progressPanel(p: SynapsyProgress, save: () => void): HTMLElement {
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

function build(p: SynapsyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const now = lessonAt(p.lesson);
  // the song's switch
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
  box.checked = p.song;
  box.addEventListener('change', () => {
    p.song = box.checked;
    changed();
  });
  const song = h('label', { class: 'switch' }, box, h('span', null, t('panel.song')));
  // the regions of the map, lit or waiting
  const regions = h('div', { class: 'arcade-chips' }, REGIONS.map(r => {
    const on = p.regions.includes(r);
    return h('span', { class: on ? 'on' : 'muted', title: t(`region.${r}.where` as 'region.plan.where') }, `${regionName(r)} · ${on ? t('panel.on') : t('panel.off')}`);
  }));
  // the ladder: the round's eight lessons, the learned ones marked
  const ladder = h('div', { class: 'arcade-chips' }, LESSONS.map(L => {
    const learned = p.learned.includes(L.id);
    const cur = now.id === L.id;
    return h('span', { class: learned || cur ? 'on' : 'muted' }, `${cur ? '› ' : ''}${lessonTitle(L.id)}${learned ? ' ✓' : ''}`);
  }));
  // Wiedza: the album
  const cards = CARDS.map(c => {
    if (!p.cards.includes(c.id)) return h('div', { class: 'arcade-daily' }, h('div', null, h('b', { class: 'muted' }, '?'), h('p', { class: 'muted' }, t('panel.locked'))));
    return h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, cardTitle(c.id)), h('p', null, cardText(c.id)), h('small', { class: 'muted' }, cardSrc(c.id))));
  });
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.kept'), fmtNum(keptSynapses(p))),
      stat(t('panel.fastest'), p.fastest > 0 ? msText(p.fastest) : '—'),
      stat(t('panel.inStep'), p.inStep > 0 ? secText(p.inStep) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.map')),
    mapCanvas(p),
    h('p', { class: 'muted' }, t('panel.mapNote')),
    regions,
    h('div', { class: 'arcade-sub' }, `${t('panel.lessons')} · ${t('panel.round', { n: now.round + 1 })}`),
    h('p', null, t('panel.lessonNow', { lesson: lessonTitle(now.id) })),
    ladder,
    h('div', { class: 'arcade-sub' }, t('panel.cards', { have: p.cards.length, all: CARDS.length })),
    ...cards,
    h('div', { class: 'arcade-sub' }, t('panel.song')),
    song,
    h('p', { class: 'muted' }, t('panel.songNote')),
    h('p', { class: 'muted' }, t('panel.halves')),
    h('p', { class: 'muted' }, t('panel.note')),
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
