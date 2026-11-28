/**
 * Stop-klatka's lobby hero, card art and calibration intro (DESIGN.md §28): a freeze frame — the player seen from
 * behind and aside, facing someone in the middle of an everyday provocation, the picture a cool still whose colour
 * slowly comes back and drains again as a ring of clarity fills and empties at the top right, a thin light frame round
 * it.  The scene fits the player's group when the lobby knows it (a school corridor for 11–19, a bus for 20–26, an
 * office for 27–35, a kitchen for 36–50, a counter's queue for 50+), a street otherwise.  The lobby lays the title over
 * a phone hero's and a card's lower part, so the faces stand in the upper two thirds.
 */
import { NO_INSETS } from '../kit/mobile';
import { layout, type Layout } from './layout';
import type { StopProgress } from './meta';
import { INK, clamp01, rgba } from './paint';
import { SceneView } from './scene';
import type { SceneBeat } from './sim';
import type { Age, Mood, Person, Place } from './story';

const SCENES: Readonly<Record<Age | 'any', { place: Place; who: Person; mood: Mood }>> = {
  teen: { place: 'corridor', who: 'peer', mood: 'smirk' },
  young: { place: 'bus', who: 'stranger', mood: 'angry' },
  adult: { place: 'office', who: 'boss', mood: 'cold' },
  mid: { place: 'kitchen', who: 'teenager', mood: 'shout' },
  senior: { place: 'queue', who: 'clerk', mood: 'cold' },
  any: { place: 'street', who: 'stranger', mood: 'shout' },
};

let view: SceneView | null = null;
let sized = '';
let lay: Layout | null = null;

/** The preview's own frame: the whole canvas, the faces high (a title covers the foot). */
function previewLayout(w: number, h: number): Layout {
  const l = layout(w, h, NO_INSETS, false);
  const R = Math.round(Math.max(10, Math.min(w * 0.075, h * 0.1)));
  return {
    ...l,
    view: { x: 0, y: 0, w, h },
    frame: { cx: w / 2, headY: h * 0.38, R },
    out: { otherX: w * 0.62, otherY: h * 0.3, selfX: w * 0.3, selfY: h * 0.62 },
  };
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: StopProgress, reduced = false): void {
  if (!(w > 0) || !(h > 0)) return;
  const dpr = ctx.getTransform?.().a || 1;
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  if (!view || key !== sized) {
    view = new SceneView();
    lay = previewLayout(w, h);
    view.resize(lay, dpr);
    sized = key;
  }
  const s = SCENES[p?.ageSet ? p.age : 'any'];
  const group: Age = p?.ageSet ? p.age : 'adult';
  const beat: SceneBeat = { place: s.place, people: [{ who: s.who, mood: s.mood, at: 'centre' }], text: '', from: null, heat: 0, key: `preview-${s.place}` };
  const t = Number.isFinite(time) ? time : 0;
  // the colour returns and drains, slowly (a still at its middle with reduced motion)
  const k = reduced ? 0.55 : 0.5 - 0.5 * Math.cos(t * 0.55);
  ctx.save();
  view.draw(ctx, beat, group, { sat: 0.18 + 0.82 * k, cool: 1 - 0.85 * k, out: 1, flash: 0, heat: 0, frozen: true, t, since: 99, reduced });
  // the still's thin light frame
  const m = Math.max(5, Math.min(w, h) * 0.025);
  ctx.strokeStyle = 'rgba(255,252,244,0.55)';
  ctx.lineWidth = Math.max(1.5, m * 0.3);
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  // the ring of clarity at the top right
  const r = Math.max(10, Math.min(w, h) * 0.075);
  const cx = w - m - r * 1.9, cy = m + r * 1.9;
  ctx.fillStyle = 'rgba(8,10,20,0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2.5, r * 0.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const full = k > 0.97;
  ctx.strokeStyle = full ? INK.gold : INK.clarity;
  ctx.shadowColor = full ? INK.gold : INK.clarity;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(k));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(full ? INK.gold : '#ffffff', 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32 + r * 0.18 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The calibration's intro: the same freeze frame on its own clock. */
export class StopIntro {
  private clock = 0;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: StopProgress, reduced: boolean): void {
    if (w < 2 || h < 2) return;
    this.clock += Math.max(0, Math.min(0.25, dt));
    drawPreview(ctx, w, h, this.clock, p, reduced);
  }
}
