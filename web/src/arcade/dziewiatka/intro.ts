/**
 * Dziewiątka's calibration intro: morning on the street of Zacisze.  The five sit by the well, the
 * Din's static mutters on the far side of the street, and while the reference fills (`p` 0..1) the
 * well's water stills, the heroes get up one by one and Klara rings her handbell; at the end the
 * bell in the tower answers.  The runner's calibration card covers the lower part of the screen,
 * so the scene sits high.
 */
import { traceBars, SignalTrace } from '../kit/trace';
import { approach, clamp } from '../kit/juice';
import { campaignMission, CAMPAIGN, CHAPTERS, type HeroId } from './content';
import { campaignDone, type DziewiatkaProgress } from './meta';
import { freshDinPose, freshHeroPose, paintDin, paintHero, paintKlara, paintStreet, paintWell } from './paint';
import { RULES } from './rules';

export class DziewiatkaIntro {
  private clock = 0;
  private shown = 0;
  private readonly poses = [0, 1, 2, 3, 4].map(i => ({ ...freshHeroPose(), seed: i * 1.7 }));
  private readonly din = freshDinPose();
  private readonly trace = new SignalTrace(40, 0.5);

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: DziewiatkaProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const ch = campaignDone(progress) ? CHAPTERS[CHAPTERS.length - 1] : campaignMission(Math.min(progress.mission, CAMPAIGN - 1), RULES.powerStep).chapter;
    const s = Math.max(18, Math.min(w / 13, (h * 0.62) / 3.4));
    const groundY = Math.min(h * 0.62, h - s * 0.8);
    paintStreet(ctx, w, h, groundY, groundY + s * 0.6, s, t, {
      chapter: ch, tower: campaignDone(progress), bars: traceBars(this.trace, t, 10), bellSwing: k > 0.97 ? 1 : 0, bellGold: k,
      rest: 0.6 * (1 - k), noise: 0.6 * (1 - k), fog: 0,
    }, 0);
    const x0 = w / 2 - s * 5.5;
    const at = (x: number, row: number) => ({ x: x0 + x * s, y: groundY - (1 - row) * s * 0.35 });
    // the well, its water stilling as the reference fills
    const wq = at(4.4, 0.25);
    paintWell(ctx, wq.x, wq.y, s, k, 1, t);
    // the five: they sit, then stand up one by one
    const team = (progress.team.length === 5 ? progress.team : ['cierpliwosc', 'milosc', 'radosc', 'pokoj', 'dobroc']) as HeroId[];
    team.forEach((id, i) => {
      const pose = this.poses[i];
      pose.t = t;
      pose.sit = k > 0.2 + i * 0.15 ? Math.max(0, pose.sit - dt * 2) : 1;
      pose.flip = i < 2 ? 1 : -1;
      const x = [2.9, 3.6, 5.2, 5.9, 6.6][i];
      const q = at(x, [0.55, 0.9, 0.85, 0.5, 0.75][i]);
      paintHero(ctx, id, q.x, q.y, s * 0.92, pose);
    });
    // the Din's static, muttering at the far end and drawing back
    this.din.t = t;
    this.din.doze = k > 0.6;
    const dq = at(9.6 + k * 1.2, 0.4);
    ctx.globalAlpha = 1 - k * 0.6;
    paintDin(ctx, 'klotniak', dq.x, dq.y, s, 1, this.din);
    ctx.globalAlpha = 1;
    // Klara with her handbell
    const kq = at(1.4, 0.2);
    paintKlara(ctx, kq.x, kq.y, s * 0.9, { t, ring: k > 0.9 ? 1 : 0.2 * Math.sin(t * 2) ** 2, talk: false, flip: 1 });
  }
}
