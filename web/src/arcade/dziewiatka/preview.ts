/**
 * Dziewiątka's picture for the lobby's hero and the game card: the five on the street of Zacisze
 * facing the Din's shadows, a focus that comes and goes turning the energy bars gold, an ultimate's
 * beam along the street now and then, and when the bars glow longest the five notes of Harmony
 * rising to the bell.  In the lobby (with progress) the street is the player's district and the five
 * are their own.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import type { TraceBar } from '../kit/trace';
import { CAMPAIGN, CHAPTERS, HEROES, campaignMission, type HeroId } from './content';
import { campaignDone, type DziewiatkaProgress } from './meta';
import { C, freshDinPose, freshHeroPose, glow, paintDin, paintHero, paintKlara, paintStreet } from './paint';
import { RULES } from './rules';

const hp = [0, 1, 2, 3, 4].map(i => ({ ...freshHeroPose(), seed: i * 1.3 }));
const dp = [0, 1, 2].map(i => ({ ...freshDinPose(), seed: i * 2.1 }));
const START: HeroId[] = ['cierpliwosc', 'milosc', 'radosc', 'pokoj', 'dobroc'];

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DziewiatkaProgress): void {
  const ch = p ? (campaignDone(p) ? CHAPTERS[CHAPTERS.length - 1] : campaignMission(Math.min(p.mission, CAMPAIGN - 1), RULES.powerStep).chapter) : CHAPTERS[0];
  const s = Math.max(12, Math.min(w / 12, h / 3.3));
  const groundY = h * 0.8;
  // the focus breathes: above the threshold half of the time
  const level = 0.5 + 0.45 * Math.sin(t * 0.7);
  // the houses' windows keep a made-up history: the focus wandering above and below the threshold
  const bars: TraceBar[] = Array.from({ length: 9 }, (_, i) => {
    const l = clamp(0.5 + 0.45 * Math.sin(t * 0.7 - (8 - i) * 0.45));
    return { level: l, calm: 1 - l, above: l > 0.5, reliable: true, phase: 'focus', shown: 1, empty: false };
  });
  paintStreet(ctx, w, h, groundY, h, s, t, {
    chapter: ch, tower: false, bars, bellSwing: level > 0.85 ? 1 : 0, bellGold: clamp((level - 0.5) * 2), rest: 0, noise: 0.5, fog: 0,
  }, 0);
  const x0 = w / 2 - s * 5.6;
  const at = (x: number, row: number) => ({ x: x0 + x * s, y: groundY - (1 - row) * s * 0.35 });
  const team = (p && p.team.length === 5 ? p.team : START) as HeroId[];
  const xs = [5.8, 4.5, 4.9, 3.2, 3.5], rows = [0.55, 0.15, 0.85, 0.35, 0.75];
  team.forEach((id, i) => {
    const pose = hp[i];
    pose.t = t;
    pose.act = (t * 1.1 + i * 0.37) % 1.4 < 0.3 ? ((t * 1.1 + i * 0.37) % 1.4) / 0.3 : 0;
    pose.ready = level > 0.6 && i === Math.floor(t / 2) % 5;
    const q = at(xs[i], rows[i]);
    paintHero(ctx, id, q.x, q.y, s, pose);
    // the energy bar over each, gold above the threshold
    const bw = s * 0.7, e = ((t * (0.18 + level * 0.35) + i * 0.21) % 1);
    ctx.fillStyle = 'rgba(43,34,56,.45)';
    ctx.fillRect(q.x - bw / 2, q.y - s * 1.75, bw, 4);
    ctx.fillStyle = level > 0.5 ? '#ffb829' : C.energy;
    ctx.fillRect(q.x - bw / 2, q.y - s * 1.75, bw * e, 4);
  });
  // three shadows of the Din
  (['klotniak', 'rozproszek', 'gniewosz'] as const).forEach((k, i) => {
    const pose = dp[i];
    pose.t = t;
    pose.act = (t * 0.9 + i * 0.5) % 1.6 < 0.3 ? 1 : 0;
    const q = at(8.2 + i * 1.3, [0.4, 0.8, 0.2][i]);
    paintDin(ctx, k, q.x, q.y, s, [1.05, 0.62, 1.1][i], pose);
  });
  // Goodness's beam now and then
  const bk = (t % 5) / 5;
  if (bk < 0.12) {
    const y = at(3.5, 0.75).y - s * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,240,190,${0.8 * (1 - bk / 0.12)})`;
    ctx.fillRect(at(3.8, 0).x, y - s * 0.12, w, s * 0.24);
    ctx.restore();
  }
  // Harmony's notes rising when the focus holds high
  if (level > 0.8) {
    team.forEach((id, i) => {
      const q = at(xs[i], rows[i]);
      const k = ((t * 0.6 + i * 0.12) % 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, q.x + (w * 0.5 - q.x) * k, q.y - s * 1.2 - k * (q.y - s * 1.2), s * 0.35, `rgba(${parseInt(HEROES[id].color.slice(1, 3), 16)},${parseInt(HEROES[id].color.slice(3, 5), 16)},${parseInt(HEROES[id].color.slice(5, 7), 16)},`, 0.7 * (1 - k));
      ctx.restore();
    });
  }
  const kq = at(1.6, 0.1);
  paintKlara(ctx, kq.x, kq.y, s * 0.9, { t, ring: level > 0.85 ? 1 : 0, talk: false, flip: 1 });
}
