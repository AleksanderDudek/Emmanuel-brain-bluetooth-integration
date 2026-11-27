/**
 * Stop-klatka's words on the canvas (DESIGN.md §28): the narration's caption at the foot (a paper card, read at the
 * reader's pace, a thin line filling as the beat goes on), someone's words in a bubble over their head (the player's
 * own in a warm bubble from below), the story's title; in the freeze the five steps' line, the trigger and the urge,
 * the ring of clarity around the breath guide (kit/breathguide), the feelings as chips, the second look's lines, the
 * two ways as buttons; the lesson's card with its breaths; the opening's cards (the pages, the age group's chips, the
 * title and the root passage) and the close's (what was named, the lessons, the prayer, the closing passage).
 *
 * Every word ≥ 13 px on a dark scrim or a paper card; every control ≥ 44 px, inside the band; the hit tests use the same
 * rects as the drawing (`targets`).
 */
import { lang } from '../../i18n';
import { drawBreathGuide } from '../kit/breathguide';
import { target } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout, type PassageId } from '../kit/scripture';
import type { TapTarget } from '../kit/types';
import { feelWord, t, list, type Key } from './i18n';
import { ageRects, chipRects, wayRects, type Layout, type Rect } from './layout';
import { FONT, INK, SERIF, clamp01, ellipse, fillRR, font, rgba, rr, smooth, wrap } from './paint';
import { RULES } from './rules';
import { openPages, type SceneBeat, type StopSim, type Way } from './sim';
import { AGES, AGE_SPAN } from './story';

const STEP_KEYS: readonly Key[] = ['step.stop', 'step.breathe', 'step.name', 'step.second', 'step.choose'];

export type Hit = { kind: 'age'; i: number } | { kind: 'chip'; i: number } | { kind: 'way'; i: number };

export class Hud {
  private l: Layout | null = null;
  private readonly wrapCache = new Map<string, string[]>();
  private readonly verseCache = new Map<string, PassageLayout>();
  private measure: CanvasRenderingContext2D | null = null;

  resize(l: Layout, ctx: CanvasRenderingContext2D | null): void {
    this.l = l;
    this.measure = ctx;
    this.wrapCache.clear();
    this.verseCache.clear();
  }

  /** Lines of `text` at `px`/`weight` (and serif) in `maxW`, cached. */
  private lines(text: string, maxW: number, px: number, weight = 600, family = FONT): string[] {
    const ctx = this.measure;
    if (!ctx) return [text];
    const key = `${px}|${weight}|${family.length}|${Math.round(maxW)}|${text}`;
    let hit = this.wrapCache.get(key);
    if (!hit) {
      ctx.save();
      ctx.font = font(px, weight, family);
      hit = wrap(ctx, text, maxW);
      ctx.restore();
      this.wrapCache.set(key, hit);
      if (this.wrapCache.size > 400) this.wrapCache.delete(this.wrapCache.keys().next().value as string);
    }
    return hit;
  }

  /** The largest size from `px` down to 13 at which `text` fits `maxLines` lines. */
  private fit(text: string, maxW: number, px: number, maxLines: number, weight = 600, family = FONT): { px: number; lines: string[] } {
    for (let p = px; p >= 13; p--) {
      const ls = this.lines(text, maxW, p, weight, family);
      if (ls.length <= maxLines) return { px: p, lines: ls };
    }
    return { px: 13, lines: this.lines(text, maxW, 13, weight, family) };
  }

  // ── the targets ────────────────────────────────────────────────

  /** The age chips of the opening card. */
  private ageChips(): Rect[] {
    const l = this.l!;
    const c = l.card;
    const top = c.y + Math.round(c.h * 0.36);
    return ageRects(l, { x: c.x + 8, y: top, w: c.w - 16, h: l.tapH * 2 + l.gap });
  }

  /** The feelings' chips under the question. */
  private chips(n: number): Rect[] { return chipRects(this.l!, n); }

  /** The ways' buttons (their heights from their words). */
  private ways(sim: StopSim): { rects: Rect[]; labels: string[]; px: number } {
    const l = this.l!;
    const labels = sim.ways.map(w => sim.wayLabel(w));
    const px = Math.max(14, Math.round(l.font * 0.95));
    const heights = labels.map(s => this.lines(s, l.content.w - 28, px, 700).length * Math.round(px * 1.3) + 20);
    return { rects: wayRects(l, heights), labels, px };
  }

  targets(sim: StopSim): TapTarget[] {
    if (!this.l || !sim.started) return [];
    if (sim.askOpen) return this.ageChips().map((r, i) => target(AGE_SPAN[AGES[i]], r));
    const c = sim.chips;
    if (c.length) return this.chips(c.length).map((r, i) => target(t(`feel.${c[i]}` as Key), r));
    if (sim.ways.length) {
      const w = this.ways(sim);
      return w.rects.map((r, i) => target(w.labels[i], r));
    }
    return [];
  }

  hit(sim: StopSim, x: number, y: number): Hit | null {
    if (!this.l || !sim.started) return null;
    const inside = (r: Rect): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (sim.askOpen) {
      const i = this.ageChips().findIndex(inside);
      return i >= 0 ? { kind: 'age', i } : null;
    }
    const c = sim.chips;
    if (c.length) {
      const i = this.chips(c.length).findIndex(inside);
      return i >= 0 ? { kind: 'chip', i } : null;
    }
    if (sim.ways.length) {
      const i = this.ways(sim).rects.findIndex(inside);
      return i >= 0 ? { kind: 'way', i } : null;
    }
    return null;
  }

  // ── drawing ────────────────────────────────────────────────────

  draw(ctx: CanvasRenderingContext2D, sim: StopSim, beat: SceneBeat, speaker: { x: number; y: number; R: number } | null, time: number, reduced: boolean): void {
    const l = this.l;
    if (!l || !sim.started) return;
    ctx.save();
    ctx.textBaseline = 'top';
    switch (sim.block.what) {
      case 'intro': this.intro(ctx, sim); break;
      case 'tell': this.beat(ctx, sim, beat, speaker, true); break;
      case 'freeze': this.freeze(ctx, sim, time, reduced); break;
      case 'after':
        if (sim.afterPart === 'lesson') this.lesson(ctx, sim, time, reduced);
        else this.beat(ctx, sim, beat, speaker, false);
        break;
      default: this.close(ctx, sim); break;
    }
    ctx.restore();
  }

  /** A paper card with a soft shadow. */
  private paper(ctx: CanvasRenderingContext2D, r: Rect, a = 0.95): void {
    ctx.save();
    ctx.shadowColor = 'rgba(20,12,8,0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    fillRR(ctx, r.x, r.y, r.w, r.h, 14, rgba(INK.paper, Math.max(a, 0.97)));
    ctx.restore();
  }

  /** A dark scrim for words over the picture. */
  private scrim(ctx: CanvasRenderingContext2D, r: Rect, a = 0.55): void {
    fillRR(ctx, r.x, r.y, r.w, r.h, 12, `rgba(12,12,22,${a})`);
  }

  private textLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, px: number, color: string, weight = 600, align: CanvasTextAlign = 'left', family = FONT, lh = 1.35): number {
    ctx.font = font(px, weight, family);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    const step = Math.round(px * lh);
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * step));
    return lines.length * step;
  }

  // ── a beat: the caption, the bubble, the title ─────────────────

  private beat(ctx: CanvasRenderingContext2D, sim: StopSim, beat: SceneBeat, speaker: { x: number; y: number; R: number } | null, tell: boolean): void {
    const l = this.l!;
    const cap = l.caption;
    const pad = Math.round(12 * Math.min(l.k, 1.4));
    const maxLines = l.mode === 'upright' ? 4 : 6;
    const { px, lines } = this.fit(beat.text, cap.w - 2 * pad, l.font, maxLines);
    const lh = Math.round(px * 1.35);
    const h = lines.length * lh + 2 * pad + 6;
    const box: Rect = { x: cap.x, y: cap.y + cap.h - h, w: cap.w, h };
    this.paper(ctx, box);
    this.textLines(ctx, lines, box.x + pad, box.y + pad, px, INK.ink, 600);
    // how far the beat is read (a thin line), and "tap to go on"
    const r = sim.cur;
    if (r) {
      let k = 0;
      if (tell) k = clamp01((sim.t - r.beatT0) / Math.max(0.5, r.plan.beats[r.beat]));
      else if (r.parts.length) k = clamp01((sim.t - r.partT0) / Math.max(0.5, r.partDur[r.part]));
      fillRR(ctx, box.x + pad, box.y + box.h - 6, (box.w - 2 * pad) * k, 2.5, 1.5, rgba(INK.goldDeep, 0.7));
    }
    // the story's title over its first beat
    if (beat.title) {
      const tp = Math.max(13, Math.round(l.font * 0.92));
      ctx.font = font(tp, 800);
      const tw = Math.min(box.w, ctx.measureText(beat.title).width + 24);
      fillRR(ctx, box.x, box.y - tp - 18, tw, tp + 12, 10, rgba('#2a211c', 0.82));
      ctx.fillStyle = INK.gold;
      ctx.textAlign = 'left';
      ctx.fillText(beat.title, box.x + 12, box.y - tp - 12);
    }
    // someone's words (not on a phone filling the view: it shows them itself)
    if (beat.say && beat.place !== 'screen') {
      if (beat.from === -1) this.ownBubble(ctx, beat.say, box.y - (beat.title ? 0 : 0) - 10);
      else this.bubble(ctx, beat.say, speaker, box.y - 8, beat.people.length === 0);
    }
  }

  /** Someone's words in a bubble over their head, its tail to their mouth. */
  private bubble(ctx: CanvasRenderingContext2D, say: string, sp: { x: number; y: number; R: number } | null, floor: number, call = false): void {
    const l = this.l!;
    const px = Math.max(14, Math.round(l.font * 0.98));
    const maxW = Math.min(l.view.w - 24, Math.round(330 * Math.min(l.k, 1.6)));
    const badge = call ? Math.max(11, px * 0.8) : 0;
    const lines = this.lines(say, maxW - 24 - badge * 2.2, px, 700);
    ctx.font = font(px, 700);
    const w = Math.min(maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 26 + badge * 2.2);
    const h = Math.max(lines.length * Math.round(px * 1.3) + 18, badge * 2 + 12);
    const sx = sp ? sp.x : l.view.x + l.view.w / 2;
    const top = sp ? sp.y - sp.R * 2.4 - h : l.view.y + 10;
    const x = Math.max(l.band.x, Math.min(l.view.x + l.view.w - w - 6, sx - w / 2));
    const y = Math.max(l.band.y + 4, Math.min(floor - h - 10, top));
    ctx.save();
    ctx.shadowColor = 'rgba(20,12,8,0.3)';
    ctx.shadowBlur = 10;
    fillRR(ctx, x, y, w, h, 14, '#ffffff');
    ctx.restore();
    if (sp) {
      // the tail toward the mouth, never into the text
      const tx = Math.max(x + 18, Math.min(x + w - 18, sx));
      ctx.beginPath();
      ctx.moveTo(tx - 9, y + h - 1);
      ctx.lineTo(tx + 9, y + h - 1);
      ctx.lineTo(tx + (sx - tx) * 0.5, Math.min(sp.y - sp.R * 1.1, y + h + 16));
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    // a voice on the phone (no one in the view): a small handset on the bubble's corner
    if (call) {
      const r = badge;
      ellipse(ctx, x + w - r - 9, y + h / 2, r, r, '#3f7a6a');
      ctx.save();
      ctx.translate(x + w - r - 9, y + h / 2);
      ctx.rotate(-0.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.32;
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.restore();
    }
    this.textLines(ctx, lines, x + 13, y + 9, px, '#231c18', 700, 'left', FONT, 1.3);
  }

  /** The player's own words: a warm bubble rising from below (from the viewer). */
  private ownBubble(ctx: CanvasRenderingContext2D, say: string, floor: number): void {
    const l = this.l!;
    const px = Math.max(14, Math.round(l.font * 0.98));
    const maxW = Math.min(l.view.w - 24, Math.round(340 * Math.min(l.k, 1.6)));
    const lines = this.lines(say, maxW - 24, px, 700);
    ctx.font = font(px, 700);
    const w = Math.min(maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 26);
    const h = lines.length * Math.round(px * 1.3) + 18;
    const x = l.view.x + l.view.w / 2 - w / 2;
    const y = Math.max(l.band.y + 4, floor - h - 14);
    ctx.save();
    ctx.shadowColor = 'rgba(20,12,8,0.3)';
    ctx.shadowBlur = 10;
    fillRR(ctx, x, y, w, h, 14, '#fff1cf');
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 10, y + h - 1);
    ctx.lineTo(x + w / 2 + 10, y + h - 1);
    ctx.lineTo(x + w / 2, y + h + 12);
    ctx.closePath();
    ctx.fillStyle = '#fff1cf';
    ctx.fill();
    this.textLines(ctx, lines, x + 13, y + 9, px, '#3a2a14', 700, 'left', FONT, 1.3);
  }

  // ── the freeze ─────────────────────────────────────────────────

  private freeze(ctx: CanvasRenderingContext2D, sim: StopSim, time: number, reduced: boolean): void {
    const l = this.l!;
    const r = sim.cur;
    if (!r) return;
    const k = sim.blockT, m = r.moments;
    const step = k < m.stopEnd ? 0 : !r.named ? (r.chipsOpen ? 2 : 1) : r.choicesOpen ? 4 : 3;
    // "Czas stanął." — big, at the stop
    const stopA = clamp01(1 - (k - 1.4) / 0.8) * clamp01(k / 0.3);
    if (stopA > 0.01) {
      const px = Math.round(Math.max(26, Math.min(48, l.band.w * 0.08)));
      ctx.save();
      ctx.globalAlpha = stopA;
      ctx.font = font(px, 600, SERIF);
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t('fz.stop'), l.view.x + l.view.w / 2, l.view.y + l.view.h * 0.42);
      ctx.restore();
    }
    this.steps(ctx, step);
    // the trigger at the stop (large, at the top); then the urge stays there, smaller, beside the ring
    const tA = smooth((k - RULES.triggerAt) / 0.5);
    if (tA > 0.01) {
      const tr = l.text;
      const big = step === 0;
      const px = big ? Math.max(15, Math.round(l.font * 1.02)) : Math.max(13, Math.round(l.font * 0.86));
      const text = big ? r.text.trigger : this.urge(r.text.urge);
      // the trigger takes the whole width of the band (upright) or of the column (side)
      const bx = big ? l.column.x : tr.x;
      const w = big ? l.column.w : tr.w;
      const L1 = this.fit(text, w - 20, px, big ? 4 : 3, big ? 700 : 600).lines;
      const lh = Math.round(px * 1.32);
      ctx.save();
      ctx.globalAlpha = big ? tA : 1;
      this.scrim(ctx, { x: bx, y: tr.y, w, h: L1.length * lh + 18 }, 0.58);
      this.textLines(ctx, L1, bx + 10, tr.y + 9, px, big ? '#ffffff' : '#ffd9b8', big ? 700 : 600, 'left', FONT, 1.32);
      ctx.restore();
    }
    // the ring of clarity around the breath (from the stop's end)
    const ringA = smooth((k - m.stopEnd + 0.6) / 0.8);
    if (ringA > 0.01) this.ring(ctx, sim, ringA, time, reduced);
    this.content(ctx, sim, step, time);
  }

  /** "Pierwszy odruch: odpyskować…" — the urge after its prefix (lowercased after the colon, but not in German). */
  private urge(u: string): string {
    return t('fz.urge', { urge: lang === 'de' ? u : u.charAt(0).toLowerCase() + u.slice(1) });
  }

  /** The five steps' line: dots and the step's name. */
  private steps(ctx: CanvasRenderingContext2D, step: number): void {
    const l = this.l!;
    const s = l.steps;
    const px = Math.max(13, Math.round(l.font * 0.86));
    const name = t(STEP_KEYS[step]);
    ctx.font = font(px, 800);
    const dot = 7, gap = 6;
    const dotsW = 5 * dot * 2 + 4 * gap;
    const w = Math.min(s.w, dotsW + 14 + ctx.measureText(name).width + 22);
    this.scrim(ctx, { x: s.x, y: s.y, w, h: s.h }, 0.5);
    for (let i = 0; i < 5; i++) {
      const cx = s.x + 11 + dot + i * (dot * 2 + gap);
      ellipse(ctx, cx, s.y + s.h / 2, dot * (i === step ? 1 : 0.7), dot * (i === step ? 1 : 0.7), i < step ? 'rgba(255,255,255,0.75)' : i === step ? INK.clarity : 'rgba(255,255,255,0.25)');
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, s.x + 11 + dotsW + 12, s.y + s.h / 2 + 1);
    ctx.textBaseline = 'top';
  }

  /** The breath guide with the clarity's arc around it. */
  private ring(ctx: CanvasRenderingContext2D, sim: StopSim, a: number, time: number, reduced: boolean): void {
    const l = this.l!;
    const r = sim.cur!;
    const b = sim.breath;
    const { cx, cy, r: R } = l.ring;
    ctx.save();
    ctx.globalAlpha = a;
    if (b) drawBreathGuide(ctx, b, { cx, cy, r: R, alpha: 1, reducedMotion: reduced, time, scrim: 0.62 });
    const cr = R + Math.max(7, R * 0.24);
    const lw = Math.max(4, R * 0.15);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();
    const k = clamp01(r.shown);
    if (k > 0.002) {
      ctx.strokeStyle = r.charged ? INK.gold : INK.clarity;
      ctx.shadowColor = r.charged ? INK.gold : INK.clarity;
      ctx.shadowBlur = r.charged ? 16 : 8 * k;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** The step's content at the foot: the see/breathe line, the feelings, the second look, the ways. */
  private content(ctx: CanvasRenderingContext2D, sim: StopSim, step: number, time: number): void {
    const l = this.l!;
    const r = sim.cur!;
    const c = l.content;
    const px = Math.max(13, Math.round(l.font * 0.95));
    const lh = Math.round(px * 1.32);
    const k = sim.blockT;
    void time;
    if (step <= 1) {
      // at the stop the urge (what the anger wants); then: see yourself from aside, and the breath
      const urge = step === 0;
      const a = urge ? smooth((k - RULES.urgeAt) / 0.5) : 1;
      if (a < 0.01) return;
      const lines = urge ? this.lines(this.urge(r.text.urge), c.w - 24, px, 700) : [...this.lines(t('fz.see'), c.w - 24, px, 700), ...this.lines(t('fz.breathe'), c.w - 24, Math.max(13, px - 1), 600)];
      const h = lines.length * lh + 18;
      ctx.save();
      ctx.globalAlpha = a;
      this.scrim(ctx, { x: c.x, y: c.y + c.h - h, w: c.w, h }, 0.58);
      this.textLines(ctx, lines, c.x + c.w / 2, c.y + c.h - h + 9, px, urge ? '#ffd9b8' : '#ffffff', urge ? 700 : 600, 'center', FONT, 1.32);
      ctx.restore();
      return;
    }
    if (step === 2) {
      const chips = sim.chips;
      const rects = this.chips(chips.length);
      const top = rects.length ? rects[0].y : c.y + c.h;
      const qh = lh + 14;
      this.scrim(ctx, { x: c.x, y: top - qh - 6, w: c.w, h: c.y + c.h - (top - qh - 6) + 4 }, 0.5);
      this.textLines(ctx, [t('fz.nameQ')], c.x + c.w / 2, top - qh, Math.round(px * 1.05), '#ffffff', 800, 'center');
      chips.forEach((f, i) => this.chip(ctx, rects[i], t(`feel.${f}` as Key), i === 0));
      return;
    }
    // the second look, and the ways once they are open
    const second = r.text.second.slice(0, r.lines);
    const named = r.named ? t(r.namedBy === 'player' ? 'fz.named' : 'fz.namedFor', { f: feelWord(r.named) }) : '';
    if (step === 4) {
      const w = this.ways(sim);
      const top = w.rects[0]?.y ?? c.y + c.h;
      const note = r.plan.round > 0 || r.firstWay === 'away' ? t('fz.other') : '';
      // once chosen: stay in the clarity; at the very end, a freeze the clarity did not fill: time moves on, and that teaches too
      const ending = !r.charged && sim.left < 2.5;
      const head = ending ? t('fz.notYet') : r.way && r.wayBy === 'player' && r.charged ? t('fz.hold') : t('fz.chooseQ');
      const hl = this.lines(head, c.w - 24, px, 800);
      const nl = note ? this.lines(note, c.w - 24, Math.max(13, px - 2), 600) : [];
      const hh = hl.length * lh + nl.length * Math.round(lh * 0.9) + 14;
      this.scrim(ctx, { x: c.x, y: top - hh - 6, w: c.w, h: c.y + c.h - (top - hh - 6) + 4 }, 0.55);
      let y = top - hh;
      y += this.textLines(ctx, hl, c.x + c.w / 2, y, px, '#ffffff', 800, 'center', FONT, 1.32);
      if (nl.length) this.textLines(ctx, nl, c.x + c.w / 2, y, Math.max(13, px - 2), INK.gold, 600, 'center', FONT, 1.25);
      w.rects.forEach((rc, i) => this.wayButton(ctx, rc, w.labels[i], w.px, sim.ways[i], r.way === sim.ways[i] && r.wayBy === 'player'));
      return;
    }
    // step 3: the lines one by one (the newest bright, the earlier dimmer; at most what fits)
    const head = t('fz.secondQ');
    const blocks = second.map(s => this.lines(s, c.w - 24, px, 600));
    let room = c.h - lh - 22 - (named ? lh : 0);
    const shown: string[][] = [];
    for (let i = blocks.length - 1; i >= 0; i--) {
      const need = blocks[i].length * lh + 8;
      if (need > room && shown.length) break;
      shown.unshift(blocks[i]);
      room -= need;
    }
    const h = (named ? lh : 0) + lh + 14 + shown.reduce((a, b) => a + b.length * lh + 8, 0);
    let y = c.y + c.h - h;
    this.scrim(ctx, { x: c.x, y: y - 6, w: c.w, h: h + 10 }, 0.55);
    if (named) {
      const tag = r.charged ? `${named} · ${t('fz.charged')}` : named;
      this.textLines(ctx, [tag], c.x + c.w / 2, y, Math.max(13, px - 2), r.charged ? INK.gold : INK.clarity, 700, 'center');
      y += lh;
    }
    y += this.textLines(ctx, [head], c.x + c.w / 2, y, px, '#ffffff', 800, 'center') + 6;
    shown.forEach((b, i) => {
      const newest = i === shown.length - 1;
      const late = r.late && newest && r.clarity < 1;
      y += this.textLines(ctx, b, c.x + c.w / 2, y, px, newest ? (late ? 'rgba(255,255,255,0.7)' : '#fff6e2') : 'rgba(255,255,255,0.62)', newest ? 700 : 600, 'center', FONT, 1.32) + 8;
    });
  }

  private chip(ctx: CanvasRenderingContext2D, r: Rect, label: string, first: boolean): void {
    const l = this.l!;
    const px = Math.max(14, Math.round(l.font * 0.98));
    fillRR(ctx, r.x, r.y, r.w, r.h, r.h / 2, first ? 'rgba(255,246,226,0.96)' : 'rgba(255,255,255,0.9)');
    ctx.strokeStyle = first ? INK.goldDeep : 'rgba(80,70,60,0.3)';
    ctx.lineWidth = first ? 2 : 1;
    rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.h / 2);
    ctx.stroke();
    ctx.font = font(px, 800);
    ctx.fillStyle = INK.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.textBaseline = 'top';
  }

  private wayButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, px: number, way: Way, chosen: boolean): void {
    const bg = chosen ? '#fff1cf' : way === 'away' ? 'rgba(232,242,250,0.94)' : 'rgba(255,250,240,0.95)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = chosen ? 14 : 6;
    fillRR(ctx, r.x, r.y, r.w, r.h, 14, bg);
    ctx.restore();
    if (chosen) {
      ctx.strokeStyle = INK.goldDeep;
      ctx.lineWidth = 2.5;
      rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 13);
      ctx.stroke();
    }
    const lines = this.lines(label, r.w - 28, px, 700);
    const lh = Math.round(px * 1.3);
    this.textLines(ctx, lines, r.x + r.w / 2, r.y + (r.h - lines.length * lh) / 2 + 1, px, INK.ink, 700, 'center', FONT, 1.3);
  }

  // ── the lesson with its breaths ────────────────────────────────

  private lesson(ctx: CanvasRenderingContext2D, sim: StopSim, time: number, reduced: boolean): void {
    const l = this.l!;
    const r = sim.cur!;
    const a = smooth((sim.t - r.partT0) / 0.8);
    const v = l.mode === 'upright' ? l.band : l.view;
    const w = Math.min(v.w - 16, Math.round(480 * Math.min(l.k, 1.6)));
    const px = Math.max(17, Math.round(l.font * 1.22));
    const head = t('lesson.head');
    const lines = this.lines(r.text.lesson, w - 36, px, 500, SERIF);
    const vid = r.story.verse;
    const vl = vid ? this.verse(ctx, vid, w - 36, Math.round(l.band.h * 0.26), Math.max(13, Math.round(l.font * 0.92))) : null;
    const lh = Math.round(px * 1.35);
    const h = 22 + Math.round(l.font * 1.2) + lines.length * lh + (vl ? vl.height + 16 : 0) + 18;
    const ringH = l.ring.r * 2 + Math.round(l.font * 2.6) + 20;
    const total = h + (l.mode === 'upright' ? ringH : 0);
    const x = v.x + (v.w - w) / 2;
    const y = Math.max(l.band.y + 6, v.y + (v.h - total) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    this.paper(ctx, { x, y, w, h });
    ctx.font = font(Math.max(13, Math.round(l.font * 0.82)), 800);
    ctx.fillStyle = INK.goldDeep;
    ctx.textAlign = 'center';
    ctx.fillText(head.toUpperCase(), x + w / 2, y + 14);
    let yy = y + 20 + Math.round(l.font * 1.2);
    yy += this.textLines(ctx, lines, x + w / 2, yy, px, INK.ink, 500, 'center', SERIF);
    if (vl && vid) drawPassage(ctx, passage(vid), vl, x + w / 2, yy + 14, { text: INK.inkSoft, ref: INK.goldDeep });
    const b = sim.breath;
    if (b) {
      const cx = l.mode === 'upright' ? l.band.x + l.band.w / 2 : l.column.x + l.column.w / 2;
      const cy = l.mode === 'upright' ? y + h + 14 + l.ring.r : l.column.y + l.column.h * 0.45;
      drawBreathGuide(ctx, b, { cx, cy, r: l.ring.r, alpha: 1, reducedMotion: reduced, time, scrim: 0.55 });
    }
    ctx.restore();
  }

  private verse(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
    const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
    let hit = this.verseCache.get(key);
    if (!hit) {
      hit = layoutPassage(ctx, passage(id), w, h, { max, min: 13 });
      this.verseCache.set(key, hit);
    }
    return hit;
  }

  // ── the opening ────────────────────────────────────────────────

  private intro(ctx: CanvasRenderingContext2D, sim: StopSim): void {
    const l = this.l!;
    const c = l.card;
    const page = sim.openPage;
    if (page >= 0) {
      const pages = openPages();
      const text = pages[page] ?? '';
      const a = smooth(((sim.t - page * RULES.openSec) / 0.6)) * smooth((RULES.openSec * (page + 1) - sim.t) / 0.5);
      const px = Math.max(16, Math.round(l.font * 1.12));
      const w = Math.min(c.w, Math.round(500 * Math.min(l.k, 1.6)));
      const lines = this.fit(text, w - 40, px, 8, 500, SERIF);
      const lh = Math.round(lines.px * 1.4);
      const h = lines.lines.length * lh + 64;
      const x = c.x + (c.w - w) / 2, y = c.y + Math.max(0, (c.h - h) / 2);
      ctx.save();
      ctx.globalAlpha = clamp01(a);
      this.paper(ctx, { x, y, w, h });
      ctx.font = font(Math.max(13, Math.round(l.font * 0.82)), 800);
      ctx.fillStyle = INK.goldDeep;
      ctx.textAlign = 'center';
      ctx.fillText(t('intro.title').toUpperCase(), x + w / 2, y + 16);
      this.textLines(ctx, lines.lines, x + w / 2, y + 42, lines.px, INK.ink, 500, 'center', SERIF, 1.4);
      for (let i = 0; i < pages.length; i++) ellipse(ctx, x + w / 2 + (i - (pages.length - 1) / 2) * 14, y + h - 12, 3.5, 3.5, i === page ? INK.goldDeep : 'rgba(90,70,50,0.25)');
      ctx.restore();
      return;
    }
    if (sim.askOpen) {
      this.paper(ctx, c, 0.96);
      const px = Math.max(18, Math.round(l.font * 1.3));
      ctx.font = font(px, 700, SERIF);
      ctx.fillStyle = INK.ink;
      ctx.textAlign = 'center';
      ctx.fillText(t('ask.title'), c.x + c.w / 2, c.y + Math.round(c.h * 0.12));
      const note = this.lines(t('ask.note'), c.w - 40, Math.max(13, Math.round(l.font * 0.9)), 500);
      this.textLines(ctx, note, c.x + c.w / 2, c.y + Math.round(c.h * 0.12) + px + 12, Math.max(13, Math.round(l.font * 0.9)), INK.inkSoft, 500, 'center');
      const rects = this.ageChips();
      rects.forEach((r, i) => this.chip(ctx, r, AGE_SPAN[AGES[i]], sim.picked ? AGES[i] === sim.age : false));
      const last = rects[rects.length - 1];
      const msg = sim.picked ? t('ask.chosen', { span: AGE_SPAN[sim.age] }) : t('ask.def', { span: AGE_SPAN[sim.age] });
      this.textLines(ctx, this.lines(msg, c.w - 40, Math.max(13, Math.round(l.font * 0.88)), 600), c.x + c.w / 2, last.y + last.h + 16, Math.max(13, Math.round(l.font * 0.88)), sim.picked ? INK.goldDeep : INK.inkSoft, 600, 'center');
      return;
    }
    // the title, the group, and the root passage
    const P = sim.plan;
    const since = sim.t - Math.max(P.openEnd, P.askEnd);
    const a = smooth(since / 0.8);
    const w = Math.min(c.w, Math.round(520 * Math.min(l.k, 1.6)));
    const x = c.x + (c.w - w) / 2;
    const px = Math.max(26, Math.round(l.font * 2));
    const verse = sim.verse;
    const vl = verse ? this.verse(ctx, verse, w - 40, Math.round(c.h * 0.42), Math.max(15, Math.round(l.font * 1.08))) : null;
    const sub = sim.first ? t('intro.first') : t('intro.group', { span: AGE_SPAN[sim.age] });
    const subL = this.lines(sub, w - 40, Math.max(13, Math.round(l.font * 0.95)), 600);
    const h = px + 34 + subL.length * Math.round(l.font * 1.3) + (vl ? vl.height + 28 : 0) + 18;
    const y = c.y + Math.max(0, (c.h - h) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    this.paper(ctx, { x, y, w, h }, 0.93);
    ctx.font = font(px, 600, SERIF);
    ctx.fillStyle = INK.ink;
    ctx.textAlign = 'center';
    ctx.fillText(t('intro.title'), x + w / 2, y + 18);
    let yy = y + px + 28;
    yy += this.textLines(ctx, subL, x + w / 2, yy, Math.max(13, Math.round(l.font * 0.95)), INK.inkSoft, 600, 'center', FONT, 1.3);
    if (vl && verse) {
      ctx.globalAlpha = a * smooth((sim.t - (Math.max(P.openEnd, P.askEnd) + 1.2)) / 1);
      drawPassage(ctx, passage(verse), vl, x + w / 2, yy + 18, { text: INK.ink, ref: INK.goldDeep });
    }
    ctx.restore();
  }

  // ── the close ──────────────────────────────────────────────────

  private close(ctx: CanvasRenderingContext2D, sim: StopSim): void {
    const l = this.l!;
    const c = l.card;
    const k = sim.blockK;
    const w = Math.min(c.w, Math.round(540 * Math.min(l.k, 1.6)));
    const x = c.x + (c.w - w) / 2;
    const px = Math.max(14, Math.round(l.font * 0.98));
    const lh = Math.round(px * 1.35);
    ctx.save();
    if (k < 0.45 || !sim.verse) {
      const named = sim.namedNow.map(f => feelWord(f));
      const namedLine = named.length ? t('close.named', { list: list(named) }) : t('close.noneNamed');
      const nl = this.lines(namedLine, w - 40, px, 700);
      const lessons = sim.lessons(3).map(s => this.lines(`· ${s}`, w - 44, px, 500, SERIF));
      const titlePx = Math.max(22, Math.round(l.font * 1.6));
      const h = titlePx + 30 + nl.length * lh + 14 + (lessons.length ? lh + lessons.reduce((a, b) => a + b.length * lh + 6, 0) : 0) + 16;
      const y = c.y + Math.max(0, (c.h - h) / 2);
      ctx.globalAlpha = smooth(sim.blockT / 0.8) * (sim.verse ? smooth((0.45 - k) / 0.04) : 1);
      this.paper(ctx, { x, y, w, h });
      ctx.font = font(titlePx, 600, SERIF);
      ctx.fillStyle = INK.ink;
      ctx.textAlign = 'center';
      ctx.fillText(t('close.title'), x + w / 2, y + 16);
      let yy = y + titlePx + 26;
      yy += this.textLines(ctx, nl, x + w / 2, yy, px, INK.goldDeep, 700, 'center') + 14;
      if (lessons.length) {
        yy += this.textLines(ctx, [t('close.lessons')], x + w / 2, yy, Math.max(13, px - 2), INK.inkSoft, 800, 'center');
        for (const ls of lessons) yy += this.textLines(ctx, ls, x + 22, yy, px, INK.ink, 500, 'left', SERIF) + 6;
      }
    } else {
      const verse = sim.verse!;
      const pr = this.lines(t('close.prayer'), w - 40, px, 500, SERIF);
      const vl = this.verse(ctx, verse, w - 40, Math.round(c.h * 0.5), Math.max(15, Math.round(l.font * 1.08)));
      const h = pr.length * lh + vl.height + 64;
      const y = c.y + Math.max(0, (c.h - h) / 2);
      ctx.globalAlpha = smooth((k - 0.45) / 0.05);
      this.paper(ctx, { x, y, w, h });
      let yy = y + 22;
      ctx.font = `italic 500 ${px}px ${SERIF}`;
      ctx.fillStyle = INK.inkSoft;
      ctx.textAlign = 'center';
      pr.forEach((ln, i) => ctx.fillText(ln, x + w / 2, yy + i * lh));
      yy += pr.length * lh + 20;
      drawPassage(ctx, passage(verse), vl, x + w / 2, yy, { text: INK.ink, ref: INK.goldDeep });
    }
    ctx.restore();
  }
}

export { list };
