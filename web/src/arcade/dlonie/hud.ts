/**
 * Światło w dłoniach's words on the canvas (screen space): what to do now (a pill), the prayer's place and step (a
 * caption), the name of the one prayed for (large, in the serif; it glows when the ball takes it), one paragraph (the
 * strategy or the narrator's line, the prayer's words while offering, the passage in rest), the next one's name in a
 * rest; the three round buttons; on a desk the narrator's own place, the walk of names and the keys; the picker; the
 * opening card.  Text the player reads is 13 px and more; a passage's reference 11 (the kit's); never under 11.
 */
import { fitText } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { ROOT } from './content';
import { placeName, t, whoName } from './i18n';
import { inside, pickerRect, storyRect, type CtrlId, type Layout, type Rect, CTRLS } from './layout';
import { walkOf } from './meta';
import { GOLD, INK, IVORY, MUTED, REST, SANS, SILVER, TAU, fitWrap, font, glow, rgba, rr, wrap } from './paint';
import type { DlonieSim } from './sim';

const CARD_BG = 'rgba(20,12,6,.86)';

/** The colour of the moment: gold while focus grows, silver hidden, lavender in rest, ivory otherwise. */
export function toneOf(sim: DlonieSim): string {
  if (sim.restBlock) return REST;
  if (sim.blind) return SILVER;
  if (sim.growing) return GOLD;
  return '#f3dcc0';
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, edge: string, radius = 14, bg = CARD_BG): void {
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** The caption over the name: "Modlitwa 2 z 4 · Kula światła". */
export function captionOf(sim: DlonieSim): string {
  const n = sim.n, of = sim.planned;
  const where = n <= of ? t('cap.prayer', { n, of }) : t('cap.prayerX', { n });
  if (sim.phase !== 'play') return `${where} · ${t('step.end')}`;
  const step = sim.step === 'offer' && sim.lay ? t('step.lay') : t(`step.${sim.step}` as 'step.rub');
  return `${where} · ${step}`;
}

/** The paragraph under the name now, and whether it is the passage (drawn in the serif with its reference). */
export function bodyOf(sim: DlonieSim, desk: boolean, roomy = true): { text: string; passage: boolean; prayer: string | null; next: string | null } {
  const line = !desk && sim.talk.line ? sim.talk.line.text : null;
  if (sim.phase !== 'play') return { text: '', passage: true, prayer: null, next: null };
  if (sim.step === 'rest') {
    const next = sim.stepDur === Infinity ? null : t('cap.next', { name: whoName(sim.p, sim.nextWho) });
    if (line && sim.stepT < 6) return { text: line, passage: false, prayer: null, next };
    // a laid prayer's words close the rest where there is room (an upright phone heard them while the hand was laid)
    return { text: '', passage: true, prayer: sim.lay && roomy ? `${t('pray.lay')} ${t('pray.layAmen')}` : null, next };
  }
  if (line) return { text: line, passage: false, prayer: null, next: null };
  if (sim.step === 'offer') return { text: sim.prayerLine, passage: false, prayer: null, next: null };
  return { text: sim.tip, passage: false, prayer: null, next: null };
}

/** The "what to do now" pill: an icon and a few words, in the moment's colour. */
function drawNow(ctx: CanvasRenderingContext2D, r: Rect, px: number, now: { icon: string; text: string }, tone: string): void {
  ctx.font = font(px, 700);
  const tw = Math.min(r.w, ctx.measureText(`${now.icon}  ${now.text}`).width + 34);
  const pill = { x: r.x, y: r.y, w: tw, h: r.h };
  panel(ctx, pill, rgba(tone, 0.55), r.h / 2, 'rgba(24,14,8,.72)');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(px + 2, 700);
  ctx.fillStyle = tone;
  ctx.fillText(now.icon, pill.x + 11, pill.y + pill.h / 2 + 1);
  const iw = ctx.measureText(now.icon).width + 18;
  const text = fitText(ctx, now.text, pill.w - iw - 12, px, 700, SANS, 13);
  ctx.fillStyle = IVORY;
  ctx.fillText(text, pill.x + iw, pill.y + pill.h / 2 + 1);
}

let passageCache: { key: string; l: PassageLayout } | null = null;

/** The words: the pill, the caption, the name, the paragraph (or the passage in rest). */
export function drawWords(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim, glowName: number, limit?: number): void {
  const W = L.words;
  const f = L.font;
  const desk = L.shape === 'desk';
  const tone = toneOf(sim);
  let y = W.y;
  const now = sim.doNow();
  const nowH = Math.round(f.now * 1.8);
  if (now) drawNow(ctx, { x: W.x, y, w: W.w, h: nowH }, f.now, now, tone);
  y += nowH + 6;
  // the caption
  ctx.textAlign = desk || L.shape !== 'tall' ? 'left' : 'center';
  const cx = ctx.textAlign === 'center' ? W.x + W.w / 2 : W.x;
  ctx.textBaseline = 'top';
  const cap = fitText(ctx, captionOf(sim).toLocaleUpperCase(), W.w, f.cap, 700, SANS, 13);
  ctx.fillStyle = rgba('#e8cfae', 0.78);
  ctx.fillText(cap, cx, y);
  y += Math.round(f.cap * 1.35);
  // the name, glowing when the ball takes it
  const name = sim.whoText;
  const nm = fitText(ctx, name, W.w, f.name, 600, '"Fraunces Variable", Fraunces, Georgia, serif', 16);
  const nameH = Math.round(f.name * 1.25);
  if (glowName > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tw = ctx.measureText(nm).width;
    const gx = ctx.textAlign === 'center' ? cx : cx + tw / 2;
    glow(ctx, GOLD, gx, y + nameH * 0.42, Math.max(tw * 0.62, nameH * 1.2), 0.22 * glowName);
    ctx.restore();
  }
  ctx.fillStyle = glowName > 0.01 ? mixTo(IVORY, '#ffe3a6', glowName) : IVORY;
  ctx.fillText(nm, cx, y);
  y += nameH + 2;
  // the paragraph
  const body = bodyOf(sim, desk, L.shape !== 'tall');
  const bottom = (sim.step === 'rest' || sim.phase !== 'play') ? Math.min(L.wordsMax, Math.max(W.y + W.h, limit ?? Infinity)) : W.y + W.h;
  const nextH = body.next ? Math.round(f.small * 1.5) : 0;
  const room = bottom - y - nextH - 4;
  const bright = sim.reshow > 0 ? 1 : 0.9;
  if (body.passage) {
    let yy = y;
    if (body.prayer) {
      const fw = fitWrap(ctx, body.prayer, W.w, 2, f.text + 1, 13, 500, true, true);
      ctx.fillStyle = rgba('#ffe7bf', bright);
      for (const l of fw.lines) { ctx.fillText(l, cx, yy); yy += Math.round(fw.px * 1.3); }
      yy += 4;
    }
    const id = sim.phase === 'play' ? sim.verse : sim.offered.length ? sim.verse : ROOT;
    const p = passage(id);
    const key = `${id}|${W.w}|${Math.round(bottom - yy - nextH)}|${f.verse}`;
    if (!passageCache || passageCache.key !== key) passageCache = { key, l: layoutPassage(ctx, p, W.w, Math.max(40, bottom - yy - nextH - 4), { max: f.verse, min: 13 }) };
    const pl = passageCache.l;
    if (ctx.textAlign === 'center') drawPassage(ctx, p, pl, cx, yy, { text: rgba('#fff1da', bright), ref: rgba(MUTED, 0.85) });
    else passageLeft(ctx, p, pl, W.x, yy, rgba('#fff1da', bright), rgba(MUTED, 0.85));
    yy += pl.height;
    if (body.next) {
      ctx.textAlign = ctx.textAlign === 'center' ? 'center' : 'left';
      ctx.font = font(f.small, 600);
      ctx.fillStyle = rgba(MUTED, 0.9);
      ctx.fillText(fitText(ctx, body.next, W.w, f.small, 600, SANS, 13), cx, Math.min(bottom - nextH, yy + 6));
    }
    return;
  }
  if (!body.text || room < 14) return;
  const serif = sim.step === 'offer' || !!sim.talk.line;
  const maxLines = Math.max(1, Math.floor(room / (13 * 1.32)));
  const fw = fitWrap(ctx, body.text, W.w, Math.min(maxLines, desk ? 8 : 4), f.text, 13, 500, serif, serif);
  const lh = Math.round(fw.px * 1.32);
  let lines = fw.lines;
  const fit = Math.max(1, Math.floor(room / lh));
  if (lines.length > fit) {
    lines = lines.slice(0, fit);
    lines[fit - 1] = `${lines[fit - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  ctx.fillStyle = sim.step === 'offer' ? rgba('#ffe7bf', bright) : rgba('#f6e6d0', bright);
  for (const l of lines) { ctx.fillText(l, cx, y); y += lh; }
}

/** A laid-out passage set flush left (the words column of a desk or a phone on its side). */
function passageLeft(ctx: CanvasRenderingContext2D, p: ReturnType<typeof passage>, l: PassageLayout, x: number, top: number, text: string, ref: string): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = text;
  ctx.font = `italic 400 ${l.size}px "Fraunces Variable", Fraunces, Georgia, serif`;
  l.lines.forEach((line, i) => ctx.fillText(line, x, top + i * l.lineH));
  ctx.fillStyle = ref;
  ctx.font = `600 ${l.refSize}px ${SANS}`;
  ctx.fillText(`${p.ref} · ${p.bible}`, x, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}

function mixTo(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * Math.max(0, Math.min(1, k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/** The three round buttons: ≡ the list, ◀ the one before, ▶ the next (on a desk with their keys' names). */
export function drawControls(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim, down: Record<CtrlId, number>, hover: CtrlId | null): void {
  const on = sim.canChoose;
  const glyph: Record<CtrlId, string> = { menu: '≡', prev: '◀', next: '▶' };
  const keys: Record<CtrlId, string> = { menu: 'M', prev: '←', next: '→' };
  for (const id of CTRLS) {
    const b = L.ctrl[id];
    const press = down[id] ?? 0;
    const lit = hover === id ? 1 : 0;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (1 - 0.06 * press), 0, TAU);
    ctx.fillStyle = `rgba(30,18,10,${(0.8 + 0.1 * lit).toFixed(2)})`;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(on ? '#ffd9a0' : '#8a7764', on ? 0.6 + 0.3 * Math.max(lit, press) : 0.35);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(Math.round(b.r * (id === 'menu' ? 0.95 : 0.72)), 700);
    ctx.fillStyle = on ? (press > 0 ? GOLD : IVORY) : 'rgba(220,200,180,.45)';
    ctx.fillText(glyph[id], b.x + (id === 'prev' ? -1 : id === 'next' ? 1.5 : 0), b.y + 1);
    if (L.keys) {
      ctx.textBaseline = 'top';
      ctx.font = font(L.font.small, 600);
      ctx.fillStyle = rgba(MUTED, lit ? 1 : 0.8);
      ctx.fillText(`${keys[id]} · ${t(`ctrl.${id}` as 'ctrl.menu')}`, b.x, b.y + b.r + 8);
    }
  }
}

/** On a desk: the narrator's line in its own place (a soft card). */
export function drawBubble(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim): void {
  const r = L.bubble;
  const line = sim.talk.line;
  if (!r || !line) return;
  const a = Math.min(1, line.t / 0.4, (line.dur - line.t) / 0.5);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  panel(ctx, r, rgba('#ffd9a0', 0.35), 16, 'rgba(26,15,8,.72)');
  const pad = Math.round(14 * L.u);
  const fw = fitWrap(ctx, line.text, r.w - 2 * pad, 3, L.font.bubble, 13, 500, true, true);
  ctx.fillStyle = '#ffeacc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lh = Math.round(fw.px * 1.4);
  const y0 = r.y + (r.h - fw.lines.length * lh) / 2;
  fw.lines.forEach((l, i) => ctx.fillText(l, r.x + pad, y0 + i * lh));
  ctx.restore();
}

/** On a desk: the walk of names, the one now (or the next, in a rest) marked. */
export function drawList(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim): void {
  const r = L.list;
  if (!r) return;
  const walk = walkOf(sim.p);
  const at = sim.choosingAt;
  const px = L.font.small + 1;
  const lh = Math.round(px * 1.9);
  const fits = Math.max(1, Math.floor((r.h - lh) / lh));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(L.font.cap, 700);
  ctx.fillStyle = rgba(MUTED, 0.8);
  ctx.fillText(fitText(ctx, (sim.offeredNow ? t('picker.titleNext') : t('picker.title')).toLocaleUpperCase(), r.w, L.font.cap, 700, SANS, 13), r.x, r.y + lh / 2);
  const first = Math.max(0, Math.min(walk.length - fits, at - Math.floor(fits / 2)));
  for (let i = first; i < Math.min(walk.length, first + fits); i++) {
    const y = r.y + lh + (i - first) * lh + lh / 2;
    const cur = i === at;
    const w = walk[i];
    const lay = w.kind === 'self' || (w.kind === 'name' && sim.p.names[w.i]?.place);
    const text = `${i + 1}. ${whoName(sim.p, w)}${lay ? `  ✋ ${placeName(w.kind === 'self' ? sim.p.selfPlace : sim.p.names[w.i].place!)}` : ''}`;
    if (cur) {
      rr(ctx, r.x - 6, y - lh / 2 + 2, r.w + 6, lh - 4, (lh - 4) / 2);
      ctx.fillStyle = 'rgba(255,210,122,.12)';
      ctx.fill();
    }
    ctx.font = font(px, cur ? 700 : 500);
    ctx.fillStyle = cur ? GOLD : rgba('#f1dfc6', 0.8);
    ctx.fillText(fitText(ctx, text, r.w - 8, px, cur ? 700 : 500, SANS, 13), r.x + 4, y);
  }
}

/** The picker: whom this prayer (or, once offered, the next one) is for — the walk as chips. */
export function drawPicker(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim): void {
  const walk = walkOf(sim.p);
  const P = pickerRect(L, walk.length);
  ctx.fillStyle = 'rgba(6,3,2,.55)';
  ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, P.box, rgba('#ffd9a0', 0.45), 16);
  const u = L.u;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const title = sim.offeredNow ? t('picker.titleNext') : t('picker.title');
  ctx.fillStyle = IVORY;
  ctx.fillText(fitText(ctx, title, P.box.w - P.close.w - 28, Math.round(17 * u), 700, SANS, 13), P.box.x + 14, P.box.y + Math.round(25 * u));
  // the close button
  ctx.textAlign = 'center';
  ctx.font = font(Math.round(20 * u), 600);
  ctx.fillStyle = rgba(IVORY, 0.85);
  ctx.fillText('✕', P.close.x + P.close.w / 2, P.close.y + P.close.h / 2 + 1);
  const at = sim.choosingAt;
  P.chips.forEach((c, i) => {
    const w = walk[i];
    const cur = i === at;
    rr(ctx, c.x, c.y, c.w, c.h, 12);
    ctx.fillStyle = cur ? 'rgba(255,210,122,.18)' : 'rgba(255,240,220,.06)';
    ctx.fill();
    ctx.strokeStyle = cur ? rgba(GOLD, 0.8) : 'rgba(255,220,180,.22)';
    ctx.lineWidth = cur ? 1.6 : 1;
    ctx.stroke();
    const lay = w.kind === 'self' || (w.kind === 'name' && !!sim.p.names[w.i]?.place);
    const label = `${L.keys && i < 9 ? `${i + 1} ` : ''}${lay ? '✋ ' : ''}${whoName(sim.p, w)}`;
    ctx.fillStyle = cur ? GOLD : IVORY;
    ctx.fillText(fitText(ctx, label, c.w - 10, Math.round(14 * u), cur ? 700 : 600, SANS, 13), c.x + c.w / 2, c.y + c.h / 2 + 1);
  });
}

/** The opening card's content height for a width. */
function storyHeight(ctx: CanvasRenderingContext2D, L: Layout, w: number): { h: number; pl: PassageLayout; lines: string[]; px: number } {
  const u = L.u;
  const pl = layoutPassage(ctx, passage(ROOT), w, 9999, { max: Math.round(17 * u), min: 14 });
  ctx.font = font(Math.round(14 * u), 500);
  const lines = wrap(ctx, t('story.line'), w);
  const px = Math.round(14 * u);
  const h = Math.round(22 * u) + Math.round(26 * u) + pl.height + 14 + lines.length * Math.round(px * 1.35) + 14 + Math.round(px * 1.6) + 14;
  return { h, pl, lines, px };
}

/** The opening card's rectangle (the only target while it is up). */
export function storyBox(ctx: CanvasRenderingContext2D, L: Layout): Rect {
  const w0 = Math.min(L.right - L.left - 24, 520 * L.u);
  const pad = Math.round(18 * L.u);
  return storyRect(L, storyHeight(ctx, L, w0 - 2 * pad).h);
}

/** The opening card: the root passage and one line of what this is; a tap begins. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DlonieSim, touch: boolean): void {
  if (!sim.story) return;
  const box = storyBox(ctx, L);
  const pad = Math.round(18 * L.u);
  const s = storyHeight(ctx, L, box.w - 2 * pad);
  ctx.fillStyle = 'rgba(6,3,2,.5)';
  ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, box, rgba('#ffd9a0', 0.5), 18);
  const a = Math.min(1, sim.story.t / 0.5);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  const cx = box.x + box.w / 2;
  let y = box.y + Math.round(18 * L.u);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = font(Math.round(20 * L.u), 600, true);
  ctx.fillStyle = GOLD;
  ctx.fillText(t('story.title'), cx, y);
  y += Math.round(30 * L.u);
  drawPassage(ctx, passage(ROOT), s.pl, cx, y, { text: '#fff1da', ref: rgba(MUTED, 0.9) });
  y += s.pl.height + 14;
  ctx.font = font(s.px, 500);
  ctx.fillStyle = '#f3e3cc';
  for (const l of s.lines) { ctx.fillText(l, cx, y); y += Math.round(s.px * 1.35); }
  y += 10;
  ctx.font = font(s.px, 700);
  ctx.fillStyle = rgba(GOLD, 0.6 + 0.4 * Math.sin(sim.story.t * 3) ** 2);
  ctx.fillText(t(touch ? 'story.tap' : 'story.tap.mouse'), cx, Math.min(y, box.y + box.h - s.px * 1.6));
  ctx.restore();
  ctx.restore();
}

/** A faint ink veil behind the words where the scene runs under them (the incense passes behind the name). */
export function veilWords(ctx: CanvasRenderingContext2D, L: Layout, deep: number): void {
  if (L.shape !== 'tall') return;
  const y1 = Math.max(L.words.y + L.words.h, deep);
  const g = ctx.createLinearGradient(0, L.top, 0, y1 + 30);
  g.addColorStop(0, 'rgba(10,6,3,0.55)');
  g.addColorStop(0.75, 'rgba(10,6,3,0.35)');
  g.addColorStop(1, 'rgba(10,6,3,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, L.top, L.w, y1 + 30 - L.top);
}

export { INK, inside };
