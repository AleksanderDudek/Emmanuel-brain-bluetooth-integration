/**
 * Drzewo nad wodą's own words on the canvas (the runner draws the standard HUD): the words band — the stage's name
 * ("Korzenie · glina", "Cierpliwość · 4/9"), one short line of what to do now (an icon and a few words; in rest the
 * kit's big breath guide in its place — round 15, kit/breathguide.ts: the lungs' disc, the phase ≥ 20 px with its
 * seconds, "oddech 1 z 2"; on a phone held upright it takes the stage's name's row too), and the prayer in a calm
 * serif, or in rest the verse to
 * abide in or the fruit's reflection — the narrator's caption, a fruit's card, the story cards (the opening's two
 * pages, the closing card), the ≡ button and its picker (posture, season).  Every text has a floor (never under 11
 * px; what is read, 13 px and more; the prayer 15 px and more) and is drawn in screen space.
 */
import { breathGuideBox, breathGuideRadius, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { clamp } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { FRUIT, LAYERS, POSTURES, SEASON_MODES, treePart } from './content';
import { cap, fruitName, phaseWord, t, type Key } from './i18n';
import { pickerParts, type Layout, type Rect } from './layout';
import { GOLD, GOLD_HI, INK, PEARL, WATER, fitFont, font, mix, rr, wrap } from './paint';
import { layerBands } from './tree';
import { pageOf, type DrzewoSim, type NowWhat } from './sim';

export interface HudState {
  capK: number; capText: string; bandGlow: number;
  /** seconds of the view (the held breath's pulse) and reduced motion (no pulse) for the breath guide */
  time?: number; still?: boolean;
}

/** Whether the play's words are drawn (from the start of play to its end). */
export const hudOn = (sim: DrzewoSim): boolean => sim.started && sim.phase !== 'done';

const NOW_COLOR: Readonly<Record<NowWhat, string>> = {
  posture: PEARL, roots: GOLD_HI, trunk: GOLD_HI, fruit: GOLD_HI, dark: '#d6d6ec', rest: WATER, valve: WATER, wind: WATER, end: PEARL,
};

/** The label of the band: the stage's name and where the light is. */
export function bandLabel(sim: DrzewoSim): { text: string; color: string } {
  if (sim.phase !== 'play') return { text: t('lab.end'), color: GOLD_HI };
  const b = sim.block;
  if (b.kind === 'posture') return { text: t('lab.posture', { i: sim.cue + 1 }), color: PEARL };
  if (b.kind === 'rest') {
    switch (b.rest) {
      case 'water': return { text: t('lab.water'), color: WATER };
      case 'soil': return { text: t('lab.soil'), color: '#e8d6b0' };
      case 'tree': return { text: t('lab.tree'), color: '#d9f0a0' };
      case 'crown': return { text: t('lab.crownRest'), color: '#d9f0a0' };
      case 'fruit': {
        const f = sim.restFruit ?? sim.fruit;
        return { text: t('lab.fruitRest', { fruit: cap(fruitName(f)) }), color: mix(FRUIT[f].color, '#ffffff', 0.25) };
      }
      case 'valve': return { text: t('lab.valve'), color: WATER };
      default: return { text: t(sim.season === 'winter' ? 'lab.windWinter' : 'lab.wind'), color: '#ffd9a0' };
    }
  }
  if (b.blind) return { text: t('lab.dark'), color: '#d6d6ec' };
  if (sim.kind === 'roots') return { text: t('lab.roots', { layer: layerName(sim) }), color: '#f0deb0' };
  if (sim.kind === 'trunk') return { text: t(`lab.${treePart(sim.treeG)}` as Key), color: '#d9f0a0' };
  return { text: t('lab.fruit', { fruit: cap(fruitName(sim.fruit)), i: sim.fruitPos + 1 }), color: mix(FRUIT[sim.fruit].color, '#ffffff', 0.25) };
}

/** The soil layer the roots' tips are in now (or the stream when they reach it). */
function layerName(sim: DrzewoSim): string {
  const g = sim.rootG;
  if (g >= 0.995) return t('layer.stream');
  const bands = layerBands(sim.plan.layers);
  const depth = 1 + g * (bands[bands.length - 1].y1 - 1);
  const i = Math.max(0, bands.findIndex(b => depth <= b.y1));
  const id = sim.layers[Math.min(i, sim.layers.length - 1)] ?? LAYERS[0];
  return t(`layer.${id}` as Key);
}

// ── text helpers ─────────────────────────────────────────────────

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

interface Wrapped { key: string; lines: string[]; size: number; lineH: number }
const wrapMemo = new Map<string, Wrapped>();

/** Text wrapped into a box: from `px` down to `min` until it fits `maxLines` (memoised). */
function wrapFit(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number, maxLines: number, weight = 500, serif = true, italic = false): Wrapped {
  const key = `${text}|${Math.round(w)}|${px}|${min}|${maxLines}|${weight}|${serif}|${italic}`;
  const hit = wrapMemo.get(key);
  if (hit) return hit;
  let size = Math.max(min, px), lines: string[] = [];
  for (; size >= min; size -= 0.5) {
    ctx.font = font(size, weight, serif, italic);
    lines = wrap(ctx, text, w);
    if (lines.length <= maxLines) break;
  }
  size = Math.max(min, size);
  ctx.font = font(size, weight, serif, italic);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  const out = { key, lines, size, lineH: Math.round(size * 1.32) };
  if (wrapMemo.size > 60) wrapMemo.clear();
  wrapMemo.set(key, out);
  return out;
}

const verseMemo = new Map<string, PassageLayout>();
function verseLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
  const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
  let l = verseMemo.get(key);
  if (!l) {
    l = layoutPassage(ctx, passage(id), w, h, { max, min: MIN_READ });
    if (verseMemo.size > 30) verseMemo.clear();
    verseMemo.set(key, l);
  }
  return l;
}

/** A soft dark veil behind words (never a hard box). */
function veil(ctx: CanvasRenderingContext2D, r: Rect, a = 0.5): void {
  ctx.save();
  rr(ctx, r.x - 8, r.y - 6, r.w + 16, r.h + 12, 14);
  ctx.fillStyle = `rgba(8,12,10,${a})`;
  ctx.fill();
  ctx.restore();
}

// ── the band ─────────────────────────────────────────────────────

export function drawHud(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim, hs: HudState): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sim.story) {
    drawStory(ctx, L, sim);
    ctx.restore();
    return;
  }
  drawCaption(ctx, L, sim, hs);
  if (sim.card) drawCard(ctx, L, sim);
  else drawBand(ctx, L, sim, hs);
  drawMenu(ctx, L, sim);
  if (sim.picker) drawPicker(ctx, L, sim);
  ctx.restore();
}

/** The height of the band's line of what to do now. */
export const nowRowH = (L: Pick<Layout, 'font'>): number => Math.round(Math.max(MIN_READ, L.font.now) * 1.55) + 4;

function drawBand(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim, hs: HudState): void {
  const r = L.band;
  veil(ctx, r, L.shape === 'tall' ? 0.52 : 0.42);
  const cx = r.x + r.w / 2;
  const lab = bandLabel(sim);
  const lpx = fitFont(ctx, lab.text, r.w, Math.max(MIN_READ, L.font.label), MIN_READ, 700);
  const labH = Math.round(lpx * 1.6);
  const nowH = nowRowH(L);
  let y = r.y + 2;
  const rest = sim.restBlock;
  if (!(rest && L.shape === 'tall')) {
    ctx.font = font(lpx, 700);
    outlined(ctx, lab.text, cx, y + labH / 2, lab.color);
    y += labH;
  }
  if (rest) y += drawGuide(ctx, L, sim, cx, y, r.w, r.h, hs) + 4;
  else {
    drawNow(ctx, L, sim, cx, y + nowH / 2, r.w);
    y += nowH;
  }
  const body = { x: r.x, y, w: r.w, h: r.y + r.h - y - 2 };
  if (rest) {
    const f = sim.restKind === 'fruit' ? sim.restFruit : null;
    if (f) drawReflection(ctx, L, f, sim.restPage, body);
    else {
      const id = sim.restVerse;
      if (id) {
        const vl = verseLayout(ctx, id, body.w, body.h, Math.round(15 * L.u));
        drawPassage(ctx, passage(id), vl, cx, body.y + Math.max(0, (body.h - vl.height) / 2), { text: '#f4efe2', ref: 'rgba(230,226,214,.75)' });
      }
    }
    return;
  }
  // the prayer (or the posture's cue), glowing again after a tap
  const maxLines = Math.max(1, Math.min(4, Math.floor(body.h / Math.round(L.font.lineMin * 1.32))));
  const wr = wrapFit(ctx, sim.line, body.w, Math.max(L.font.lineMin, L.font.line), L.font.lineMin, maxLines, 500, true, true);
  const total = wr.lines.length * wr.lineH;
  let ly = body.y + Math.max(0, (body.h - total) / 2) + wr.lineH / 2;
  ctx.font = font(wr.size, 500, true, true);
  const col = hs.bandGlow > 0 ? mix('#f4efe2', '#fff1c9', hs.bandGlow) : '#f4efe2';
  for (const line of wr.lines) {
    outlined(ctx, line, cx, ly, col);
    ly += wr.lineH;
  }
}

/** A fruit's reflection: its name in its colour, and the reflection in the serif. */
function drawReflection(ctx: CanvasRenderingContext2D, L: Layout, f: keyof typeof FRUIT, page: 1 | 2, box: Rect, hint = ''): void {
  const cx = box.x + box.w / 2;
  const text = t(`fruit.${f}.r${page}` as Key);
  const hintH = hint ? Math.round(Math.max(MIN_READ, L.font.small) * 1.5) : 0;
  const maxLines = Math.max(1, Math.min(4, Math.floor((box.h - hintH) / Math.round(L.font.lineMin * 1.32))));
  const wr = wrapFit(ctx, text, box.w, Math.max(L.font.lineMin, L.font.line - 1), L.font.lineMin, maxLines, 500, true, true);
  let y = box.y + Math.max(0, (box.h - hintH - wr.lines.length * wr.lineH) / 2) + wr.lineH / 2;
  ctx.font = font(wr.size, 500, true, true);
  for (const line of wr.lines) {
    outlined(ctx, line, cx, y, '#f4efe2');
    y += wr.lineH;
  }
  if (hint) {
    const px = fitFont(ctx, hint, box.w, Math.max(MIN_READ, L.font.small), MIN_READ, 600);
    ctx.font = font(px, 600);
    outlined(ctx, hint, cx, box.y + box.h - hintH / 2, 'rgba(230,226,214,.8)');
  }
}

/**
 * Rest's breath guide (kit/breathguide.ts): a row — the ring, the phase beside it, "oddech 1 z 2" under it — at the
 * top `y` of what is left of the band, centred; the kit's radius for the screen, under about 42 % of the band's
 * height (≥ 26 px).  Its height returned.
 */
function drawGuide(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim, cx: number, y: number, w: number, bandH: number, hs: HudState): number {
  const pp = (r: number) => Math.max(10, Math.round(r * 0.3));
  let r = Math.min(breathGuideRadius(L.w, L.h), Math.round(w * 0.16));
  while (r > 26 && 2 * r + 1.4 * pp(r) > bandH * 0.42) r--;
  r = Math.max(26, r);
  const b = sim.breath;
  const o: BreathGuideOpts = {
    cx, cy: 0, r, layout: 'row',
    words: { in: phaseWord('in'), holdIn: phaseWord('holdIn'), out: phaseWord('out'), holdOut: phaseWord('holdOut') },
    sub: t('hud.breathOf', { n: b.cycle, of: b.cycles }), maxW: Math.max(80, w - (2 * r + 2.9 * pp(r))),
    reducedMotion: hs.still, time: hs.time, scrim: 0.5,
  };
  const h = breathGuideBox(ctx, o).h;
  drawBreathGuide(ctx, b, { ...o, cy: y + h / 2 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  return h;
}

/** The line of what to do now (an icon and a few words); in rest, the breath's guide. */
function drawNow(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim, cx: number, y: number, w: number): void {
  const what = sim.now;
  let text = t(`now.${what}` as Key);
  if (sim.restBlock) {
    const b = sim.breath;
    text = `${phaseWord(b.phase)} · ${t('secs', { n: Math.max(1, Math.ceil(b.left)) })} · ${t('hud.breathOf', { n: b.cycle, of: b.cycles })}`;
  }
  const npx = Math.max(MIN_READ, L.font.now);
  const px = fitFont(ctx, text, w - 3 * npx, npx, MIN_READ, 700);
  ctx.font = font(px, 700);
  const tw = ctx.measureText(text).width, ir = px * 0.5, gap = px * 0.5;
  const x0 = cx - (2 * ir + gap + tw) / 2;
  const color = NOW_COLOR[what];
  // the icon: a small sun for focus, a ring that breathes in rest, a dim disc in the dark, a pearl elsewhere
  ctx.save();
  const ix = x0 + ir;
  if (what === 'roots' || what === 'trunk' || what === 'fruit') {
    ctx.fillStyle = sim.goldOn ? GOLD : 'rgba(255,217,138,.55)';
    ctx.beginPath();
    ctx.arc(ix, y, ir * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1.2, ir * 0.18);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(a) * ir * 0.72, y + Math.sin(a) * ir * 0.72);
      ctx.lineTo(ix + Math.cos(a) * ir, y + Math.sin(a) * ir);
      ctx.stroke();
    }
  } else if (sim.restBlock) {
    ctx.strokeStyle = WATER;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ix, y, ir * (0.4 + 0.55 * sim.breath.k), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = what === 'dark' ? 'rgba(214,214,236,.45)' : PEARL;
    ctx.beginPath();
    ctx.arc(ix, y, ir * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = 'left';
  outlined(ctx, text, x0 + 2 * ir + gap, y, color);
  ctx.textAlign = 'center';
}

// ── the caption, the card ────────────────────────────────────────

function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim, hs: HudState): void {
  if (hs.capK < 0.02 || !hs.capText || sim.picker) return;
  const r = L.caption;
  const px = Math.max(MIN_READ, L.font.caption);
  ctx.font = font(px, 600);
  let lines = wrap(ctx, hs.capText, r.w - 12);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = `${lines[1].replace(/[\s,;:.]+$/, '')}…`;
  }
  const lh = Math.round(px * 1.35);
  const h = lines.length * lh + 8;
  ctx.save();
  ctx.globalAlpha = clamp(hs.capK);
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
  // on a phone upright the caption stands on the band (bottom-aligned); elsewhere it hangs from its top
  const y0 = L.shape === 'tall' ? r.y + r.h - h : r.y;
  veil(ctx, { x: r.x + (r.w - maxW) / 2, y: y0 + 2, w: maxW, h: h - 4 }, 0.45);
  let y = y0 + 4 + lh / 2;
  for (const l of lines) {
    outlined(ctx, l, r.x + r.w / 2, y, '#f4efe2');
    y += lh;
  }
  ctx.restore();
}

/** A fruit's card, in the band's place: its name, its reflection, "tap again — a second thought". */
function drawCard(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim): void {
  const c = sim.card!;
  const r = L.band;
  const F = FRUIT[c.fruit];
  ctx.save();
  rr(ctx, r.x - 8, r.y - 6, r.w + 16, r.h + 12, 16);
  ctx.fillStyle = 'rgba(10,14,12,.78)';
  ctx.fill();
  ctx.strokeStyle = `${mix(F.color, '#ffffff', 0.3)}`;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  const name = cap(fruitName(c.fruit));
  const npx = fitFont(ctx, name, r.w, Math.max(MIN_READ + 2, L.font.name), MIN_READ, 700, true);
  const nameH = Math.round(npx * 1.45);
  ctx.font = font(npx, 700, true);
  outlined(ctx, name, r.x + r.w / 2, r.y + nameH / 2 + 2, mix(F.color, '#ffffff', 0.3));
  const hint = t(L.touch ? 'card.more.tap' : 'card.more.click');
  drawReflection(ctx, L, c.fruit, c.page, { x: r.x, y: r.y + nameH + 2, w: r.w, h: r.h - nameH - 4 }, c.page === 1 ? hint : '');
}

// ── ≡ and its picker ─────────────────────────────────────────────

function drawMenu(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim): void {
  if (sim.phase !== 'play' && sim.phase !== 'finale') return;
  const m = L.menu;
  ctx.save();
  rr(ctx, m.x, m.y, m.w, m.h, m.w * 0.3);
  ctx.fillStyle = sim.picker ? 'rgba(255,217,138,.3)' : 'rgba(12,16,14,.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,241,201,.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(m.x + m.w * 0.3, m.y + m.h / 2 + k * m.h * 0.16);
    ctx.lineTo(m.x + m.w * 0.7, m.y + m.h / 2 + k * m.h * 0.16);
    ctx.stroke();
  }
  ctx.restore();
  if (!L.touch && (L.desk || L.shape === 'wide')) {
    const text = `${t('pick.posture')} · ${t('pick.season')} (M)`;
    const px = fitFont(ctx, text, L.band.w - m.w - 12, Math.max(MIN_READ, L.font.small), MIN_READ, 600);
    ctx.font = font(px, 600);
    ctx.textAlign = 'left';
    outlined(ctx, text, m.x + m.w + 10, m.y + m.h / 2, 'rgba(240,236,226,.85)');
    ctx.textAlign = 'center';
  }
}

function drawPicker(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim): void {
  const p = pickerParts(L);
  const c = p.card;
  ctx.save();
  ctx.fillStyle = 'rgba(4,8,6,.45)';
  ctx.fillRect(0, 0, L.w, L.h);
  rr(ctx, c.x, c.y, c.w, c.h, 18);
  ctx.fillStyle = 'rgba(16,22,18,.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,241,201,.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const cx = c.x + c.w / 2;
  ctx.font = font(fitFont(ctx, t('pick.title'), c.w - 24, Math.max(16, L.font.name - 2), MIN_READ, 700, true), 700, true);
  outlined(ctx, t('pick.title'), cx, p.title, GOLD_HI);
  const lpx = Math.max(MIN_READ, L.font.label);
  ctx.font = font(lpx, 700);
  outlined(ctx, t('pick.posture'), cx, p.labels.posture, 'rgba(240,236,226,.9)');
  outlined(ctx, t('pick.season'), cx, p.labels.season, 'rgba(240,236,226,.9)');
  const button = (r: Rect, text: string, on: boolean) => {
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = on ? 'rgba(255,217,138,.28)' : 'rgba(255,255,255,.06)';
    ctx.fill();
    ctx.strokeStyle = on ? GOLD : 'rgba(255,255,255,.22)';
    ctx.lineWidth = on ? 2 : 1;
    ctx.stroke();
    ctx.restore();
    const px = fitFont(ctx, text, r.w - 8, Math.max(MIN_READ, L.font.label), MIN_READ, on ? 700 : 600);
    ctx.font = font(px, on ? 700 : 600);
    outlined(ctx, text, r.x + r.w / 2, r.y + r.h / 2, on ? GOLD_HI : PEARL);
  };
  POSTURES.forEach((ps, i) => button(p.posture[i], t(`posture.${ps}` as Key), sim.p.posture === ps));
  SEASON_MODES.forEach((s, i) => button(p.season[i], t(`season.${s}` as Key), sim.p.season === s));
  const note = p.note >= 0 ? t('pick.note') : '';
  const npx = Math.max(MIN_READ, L.font.small);
  ctx.font = font(npx, 500);
  const lines = wrap(ctx, note, c.w - 28).slice(0, 2);
  const lh = Math.round(npx * 1.35);
  let y = p.note - ((lines.length - 1) * lh) / 2;
  for (const l of lines) {
    outlined(ctx, l, cx, y, 'rgba(230,226,214,.8)');
    y += lh;
  }
  button(p.close, t('pick.close'), false);
}

// ── the story cards ──────────────────────────────────────────────

function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DrzewoSim): void {
  const s = sim.story!;
  const pg = pageOf(s.kind, s.page, sim.session);
  const box = L.story;
  const pad = Math.round(18 * Math.min(L.u, 1.4));
  const w = Math.min(box.w, Math.round(520 * Math.min(L.u, 1.6)));
  const innerW = w - 2 * pad;
  const tpx = Math.max(18, Math.round(22 * L.u));
  const title = wrapFit(ctx, pg.title, innerW, tpx, 16, 2, 700, true);
  const text = wrapFit(ctx, pg.text, innerW, Math.max(MIN_READ + 1, Math.round(15 * L.u)), MIN_READ, 7, 500, false);
  const hint = t(L.touch ? 'story.tap' : 'story.click');
  const hpx = Math.max(MIN_READ, L.font.small);
  const avail = box.h - 2 * pad - title.lines.length * title.lineH - text.lines.length * text.lineH - hpx * 2 - 24;
  const vl = verseLayout(ctx, pg.verse, innerW, Math.max(40, avail), Math.round(16 * L.u));
  const h = Math.min(box.h, 2 * pad + title.lines.length * title.lineH + 10 + text.lines.length * text.lineH + 14 + vl.height + 14 + hpx * 1.6);
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(4,8,6,.4)';
  ctx.fillRect(0, 0, L.w, L.h);
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(14,20,16,.93)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,241,201,.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const cx = x + w / 2;
  let yy = y + pad + title.lineH / 2;
  ctx.font = font(title.size, 700, true);
  for (const l of title.lines) {
    outlined(ctx, l, cx, yy, GOLD_HI);
    yy += title.lineH;
  }
  yy += 10 - title.lineH / 2 + text.lineH / 2;
  ctx.font = font(text.size, 500);
  for (const l of text.lines) {
    outlined(ctx, l, cx, yy, '#f0ece2');
    yy += text.lineH;
  }
  yy += 14 - text.lineH / 2;
  drawPassage(ctx, passage(pg.verse), vl, cx, yy, { text: '#f4efe2', ref: 'rgba(230,226,214,.75)' });
  ctx.font = font(fitFont(ctx, hint, innerW, hpx, MIN_READ, 600), 600);
  outlined(ctx, hint, cx, y + h - pad * 0.5 - hpx * 0.5, 'rgba(230,226,214,.7)');
}

/** The smallest text this view ever draws (for the tests): the kit's floor. */
export const SMALLEST = MIN_TEXT;
