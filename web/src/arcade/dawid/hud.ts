/**
 * Dawid's own bits over the map, drawn on the canvas — never the band's panel nor the score (the runner
 * draws those): the level's bar with its rested band, health, the party's portraits with their kit
 * skills' dials, the treasury, the bag (a tap walks home), the great stone's dial (a tap throws it), the
 * quest pill with an arrow at the screen's edge, the minimap, the camp's card (tabs and tiles, with where
 * they are for a tap), the story cards, the speech bubbles and the short banners.
 */
import { fmtNum } from '../../i18n';
import { ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { companionSpec, type CompanionId } from './content';
import { t, xpText } from './i18n';
import type { Layout, Rect } from './layout';
import { xpNeed } from './meta';
import { C, SANS, SERIF, font, glow, paintCoin, paintPortrait } from './paint';
import { RULES } from './rules';
import { whyText, type CampTab, type DawidSim } from './sim';

const TAU = Math.PI * 2;

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/), out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke: string | null, rad: number): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const TABS: readonly CampTab[] = ['ab', 'bd', 'wp', 'party'];

export class Hud {
  /** this frame's rects for a tap */
  tabs: Rect[] = [];
  tiles: Rect[] = [];
  cardShown: Rect | null = null;
  /** where the quest's arrow (or marker) was drawn this frame */
  arrowAt: { x: number; y: number } | null = null;
  private passage: { id: string; l: PassageLayout; w: number } | null = null;

  tabAt(x: number, y: number): CampTab | null {
    const i = this.tabs.findIndex(r => inRect(r, x, y));
    return i >= 0 ? TABS[i] : null;
  }

  tileAt(x: number, y: number): number { return this.tiles.findIndex(r => inRect(r, x, y)); }

  onCard(x: number, y: number): boolean { return !!this.cardShown && inRect(this.cardShown, x, y); }

  bagAt(L: Layout, x: number, y: number): boolean { return Math.hypot(x - L.bag.x, y - L.bag.y) <= L.bag.r + 8; }

  stoneAt(L: Layout, x: number, y: number): boolean { return Math.hypot(x - L.stone.x, y - L.stone.y) <= L.stone.r + 8; }

  /** The level's bar (with rested XP ahead of it), health, the party, the treasury, the bag, the great stone. */
  drawBars(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number, pop: number, bagPop: number): void {
    const u = L.u, p = sim.p, d = sim.david;
    // the level's bar
    const xp = L.xp;
    panel(ctx, { x: xp.x - 2, y: xp.y - 2, w: xp.w + 4, h: xp.h + 4 }, 'rgba(36,28,20,.62)', null, (xp.h + 4) / 2);
    const fill = sim.levelProgress, rested = sim.restedShare;
    if (rested > 0) {
      ctx.fillStyle = 'rgba(136,170,224,.55)';
      ctx.beginPath();
      ctx.roundRect(xp.x, xp.y, Math.min(xp.w, xp.w * Math.min(1, fill + rested)), xp.h, xp.h / 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(xp.x, 0, xp.x + xp.w, 0);
    g.addColorStop(0, '#9a6a2a');
    g.addColorStop(1, '#f2c96a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * fill), xp.h, xp.h / 2);
    ctx.fill();
    ctx.font = font(800, 11.5 * u, SANS);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff8e6';
    const need = xpNeed(p.level);
    ctx.fillText(`${fmtNum(Math.floor(p.xp))} / ${fmtNum(need)}${rested > 0.01 ? `  ·  ${t('hud.rested')}` : ''}`, xp.x + xp.w, xp.y - 3);
    // health (a bar with its number) and the level's badge
    const hp = L.hp;
    ctx.textAlign = 'left';
    ctx.font = font(900, (14 + 5 * pop) * u, SANS);
    ctx.fillStyle = pop > 0.05 ? C.goldLight : '#fff8e6';
    const lvText = t('hud.level', { n: p.level });
    ctx.fillText(lvText, xp.x, xp.y - 3);
    panel(ctx, { x: hp.x - 1, y: hp.y - 1, w: hp.w + 2, h: hp.h + 2 }, 'rgba(36,28,20,.62)', null, (hp.h + 2) / 2);
    const hf = Math.max(0, Math.min(1, d.hp / Math.max(1, d.max)));
    ctx.fillStyle = hf < 0.3 ? '#e0563a' : '#d8574a';
    ctx.beginPath();
    ctx.roundRect(hp.x, hp.y, Math.max(hp.h, hp.w * hf), hp.h, hp.h / 2);
    ctx.fill();
    if (sim.shieldT > 0) {
      ctx.strokeStyle = 'rgba(160,200,255,.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hp.x - 2, hp.y - 2, hp.w + 4, hp.h + 4, (hp.h + 4) / 2);
      ctx.stroke();
    }
    ctx.font = font(800, 9.5 * u, SANS);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${fmtNum(Math.ceil(d.hp))} / ${fmtNum(d.max)}`, hp.x + 6 * u, hp.y + hp.h / 2 + 0.5);
    // the party: portraits with their skills' dials
    const pa = L.party;
    sim.mates.forEach((m, i) => {
      const x = pa.x + i * pa.gap, y = pa.y;
      ctx.save();
      if (m.act > 0) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, pa.r * 2.2, 'rgba(255,220,140,', 0.5 * Math.min(1, m.act));
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = 'rgba(36,28,20,.75)';
      ctx.beginPath();
      ctx.arc(x, y, pa.r + 3, 0, TAU);
      ctx.fill();
      paintPortrait(ctx, m.id as CompanionId, x, y, pa.r);
      const cd = companionSpec(m.id).cd, k = Math.max(0, Math.min(1, 1 - m.cd / cd));
      ctx.strokeStyle = k >= 0.999 ? C.goldLight : 'rgba(255,248,230,.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, pa.r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      ctx.restore();
    });
    // the bag: a sack that fills, a tap walks home
    const bg = L.bag, load = Math.min(1, sim.bagLoad / Math.max(1, sim.bagCap)), full = sim.bagFull;
    ctx.save();
    if (full) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bg.x, bg.y, bg.r * 2.4, 'rgba(255,200,120,', 0.35 + 0.2 * Math.sin(now * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
    const R = bg.r * (1 + 0.12 * bagPop);
    ctx.fillStyle = 'rgba(36,28,20,.78)';
    ctx.beginPath();
    ctx.arc(bg.x, bg.y, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = full ? C.goldLight : C.silverDeep;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bg.x, bg.y, R - 2, -Math.PI / 2, -Math.PI / 2 + TAU * load);
    ctx.stroke();
    // the sack
    ctx.fillStyle = '#9a6a3a';
    ctx.beginPath();
    ctx.ellipse(bg.x, bg.y + R * 0.12, R * 0.42, R * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a4e28';
    ctx.fillRect(bg.x - R * 0.16, bg.y - R * 0.38, R * 0.32, R * 0.14);
    paintCoin(ctx, 'silver', bg.x + R * 0.05, bg.y + R * 0.25, R * 0.75, now, 1);
    ctx.restore();
    ctx.font = font(800, 10 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = full ? C.goldLight : '#fff8e6';
    ctx.fillText(full ? t('hud.home') : `${fmtNum(Math.round(sim.bagLoad))}/${fmtNum(sim.bagCap)}`, bg.x, bg.y + bg.r + 3);
    // the treasury (above the bag)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = font(800, 12 * u, SANS);
    ctx.fillStyle = '#f2f6fa';
    const tre = `${fmtNum(p.silver)}`;
    ctx.fillText(tre, bg.x + bg.r, bg.y - bg.r - 4);
    const tw = ctx.measureText(tre).width;
    paintCoin(ctx, 'silver', bg.x + bg.r - tw - 9 * u, bg.y - bg.r - 7 * u, 20 * u, now, 2);
    // the great stone's dial
    const st = L.stone, ready = sim.stoneReady;
    ctx.save();
    if (ready) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, st.x, st.y, st.r * (2.3 + 0.3 * Math.sin(now * 6)), 'rgba(255,220,130,', 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'rgba(36,28,20,.78)';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ready ? C.gold : 'rgba(255,248,230,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * sim.charge);
    ctx.stroke();
    const sr = st.r * (0.42 + (ready ? 0.06 * Math.sin(now * 8) : 0));
    const sg = ctx.createRadialGradient(st.x - sr * 0.3, st.y - sr * 0.3, 1, st.x, st.y, sr);
    sg.addColorStop(0, ready ? '#fff4d2' : '#f2efe8');
    sg.addColorStop(1, ready ? '#e2b23c' : '#a9a397');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(st.x, st.y, sr * 1.15, sr, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.font = font(800, 10 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = ready ? C.goldLight : 'rgba(255,248,230,.85)';
    ctx.fillText(ready ? t('hud.stoneTap') : `${Math.round(sim.charge * 100)}%`, st.x, st.y + st.r + 3);
  }

  /** The quest: a pill at the top left, and an arrow at the screen's edge toward its place (a marker over it when in sight). */
  drawQuest(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, target: { x: number; y: number } | null, now: number, pop: number): void {
    const q = sim.questText();
    if (!q.text) return;
    const u = L.u, r = L.quest;
    ctx.font = font(700, 12.5 * u, SANS);
    const prog = q.progress ? `  ${q.progress}` : '';
    const label = `${q.text}${prog}`;
    let text = label;
    const maxW = r.w - 34 * u;
    while (ctx.measureText(text).width > maxW && text.length > 4) text = `${text.slice(0, -2)}…`;
    const w = Math.min(r.w, ctx.measureText(text).width + 34 * u);
    ctx.save();
    if (pop > 0) {
      ctx.translate(r.x + w / 2, r.y + r.h / 2);
      const k = 1 + 0.12 * pop;
      ctx.scale(k, k);
      ctx.translate(-(r.x + w / 2), -(r.y + r.h / 2));
    }
    panel(ctx, { x: r.x, y: r.y, w, h: r.h }, 'rgba(36,28,20,.72)', pop > 0 ? C.goldLight : 'rgba(234,181,61,.6)', r.h / 2);
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    const cx = r.x + 13 * u, cy = r.y + r.h / 2;
    ctx.moveTo(cx, cy - 6 * u);
    ctx.lineTo(cx + 5 * u, cy);
    ctx.lineTo(cx, cy + 6 * u);
    ctx.lineTo(cx - 5 * u, cy);
    ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + 24 * u, cy + 0.5);
    ctx.restore();
    this.arrowAt = null;
    if (!target) return;
    // the arrow: on the screen's edge toward the place, or a bobbing marker above it
    const m = 26 * u;
    const inside = target.x > m && target.x < L.w - m && target.y > L.top + m && target.y < L.bottom - 40 * u;
    if (inside) {
      const bob = Math.sin(now * 4) * 4 * u;
      ctx.fillStyle = C.gold;
      ctx.strokeStyle = 'rgba(36,28,20,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 34 * u + bob);
      ctx.lineTo(target.x - 9 * u, target.y - 50 * u + bob);
      ctx.lineTo(target.x + 9 * u, target.y - 50 * u + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.arrowAt = { x: target.x, y: target.y - 34 * u };
      return;
    }
    const cxs = L.kx, cys = L.ky;
    const a = Math.atan2(target.y - cys, target.x - cxs);
    const hx = (L.w / 2 - m), hy = ((L.bottom - L.top) / 2 - m);
    const k = Math.min(Math.abs(hx / (Math.cos(a) || 1e-6)), Math.abs(hy / (Math.sin(a) || 1e-6)));
    const ax = cxs + Math.cos(a) * k, ay = (L.top + L.bottom) / 2 + Math.sin(a) * k;
    this.arrowAt = { x: ax, y: ay };
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = C.gold;
    ctx.strokeStyle = 'rgba(36,28,20,.7)';
    ctx.lineWidth = 2;
    const pulse = 1 + 0.12 * Math.sin(now * 5);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(14 * u, 0);
    ctx.lineTo(-8 * u, -10 * u);
    ctx.lineTo(-3 * u, 0);
    ctx.lineTo(-8 * u, 10 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The minimap: the land's outline, the camp, the dens, the lair and the gate, the quest's place, David. */
  drawMini(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number): void {
    const r = L.mini;
    if (!r || sim.inCave) return;
    const land = sim.land;
    const sx = r.w / land.w, sy = r.h / land.h;
    const P = (x: number, y: number) => ({ x: r.x + x * sx, y: r.y + y * sy });
    panel(ctx, r, 'rgba(36,28,20,.6)', 'rgba(255,248,230,.25)', 8);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.clip();
    ctx.strokeStyle = 'rgba(95,159,196,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    land.brook.forEach(([x, y], i) => { const p = P(x, y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    sim.dens.forEach((dn, i) => {
      const p = P(dn.x, dn.y);
      const alive = sim.beasts.some(b => b.den === i && b.state !== 'flee');
      ctx.fillStyle = alive ? 'rgba(220,120,90,.9)' : 'rgba(200,180,150,.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, TAU);
      ctx.fill();
    });
    const camp = P(land.camp[0], land.camp[1]);
    ctx.fillStyle = C.fire;
    ctx.beginPath();
    ctx.arc(camp.x, camp.y, 3.5, 0, TAU);
    ctx.fill();
    const g = sim.guard;
    if (g.state !== 'gone') {
      const lp = P(g.x, g.y);
      ctx.fillStyle = sim.guardActive ? '#ff7a5a' : 'rgba(255,140,110,.5)';
      ctx.fillRect(lp.x - 3, lp.y - 3, 6, 6);
    }
    const gp = P(land.gate[0], land.gate[1]);
    ctx.strokeStyle = sim.gateOpen ? C.goldLight : 'rgba(255,248,230,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gp.x - 4, gp.y);
    ctx.lineTo(gp.x + 4, gp.y);
    ctx.stroke();
    const qt = sim.questTarget();
    if (qt) {
      const q = P(qt.x, qt.y);
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - 4.5);
      ctx.lineTo(q.x + 3.5, q.y);
      ctx.lineTo(q.x, q.y + 4.5);
      ctx.lineTo(q.x - 3.5, q.y);
      ctx.fill();
    }
    const dp = P(sim.david.x, sim.david.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, 3 + Math.sin(now * 5) * 0.6, 0, TAU);
    ctx.fill();
    // the view's frame
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dp.x - sim.viewHW * sx, dp.y - sim.viewHH * sy, sim.viewHW * 2 * sx, sim.viewHH * 2 * sy);
    ctx.restore();
  }

  /** The camp's card: tabs, then the tab's tiles with their effect in numbers and their price; a tap buys. */
  drawCamp(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number, k: number): void {
    this.tabs = [];
    this.tiles = [];
    this.cardShown = null;
    if (!sim.inCamp || sim.story || sim.sitting || k <= 0.01) return;
    const u = L.u, r = L.card;
    const pad = 10 * u, gap = 6 * u;
    const tiles = sim.tiles();
    const rows = Math.ceil(tiles.length / L.cols);
    const h = pad * 2 + L.tabH + 6 * u + rows * L.tileH + Math.max(0, rows - 1) * gap;
    const y0 = Math.max(L.top + 30 * u, L.xp.y - 10 * u - h) + (1 - ease.outCubic(k)) * 40 * u;
    const card = { x: r.x, y: y0, w: r.w, h };
    this.cardShown = card;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5);
    panel(ctx, card, 'rgba(246,235,211,.97)', C.goldDeep, 14 * u);
    // tabs
    const tabs: { id: CampTab; key: string }[] = [
      { id: 'ab', key: 'camp.tab.ab' }, { id: 'bd', key: 'camp.tab.bd' }, { id: 'wp', key: 'camp.tab.forge' }, { id: 'party', key: 'camp.tab.party' },
    ];
    const tw = (card.w - pad * 2 - gap * 3) / 4;
    tabs.forEach((tb, i) => {
      const rr = { x: card.x + pad + i * (tw + gap), y: card.y + pad, w: tw, h: L.tabH };
      this.tabs.push(rr);
      const on = sim.campTab === tb.id;
      panel(ctx, rr, on ? C.terracotta : 'rgba(43,33,24,.08)', null, L.tabH / 2);
      ctx.font = font(800, 11.5 * u, SANS);
      ctx.fillStyle = on ? '#fff8e6' : C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let label = t(tb.key as Parameters<typeof t>[0]);
      while (ctx.measureText(label).width > tw - 10 && label.length > 3) label = `${label.slice(0, -2)}…`;
      ctx.fillText(label, rr.x + rr.w / 2, rr.y + rr.h / 2 + 0.5);
    });
    // tiles
    const ty = card.y + pad + L.tabH + 6 * u;
    tiles.forEach((tile, i) => {
      const c = i % L.cols, rw = Math.floor(i / L.cols);
      const rr = { x: card.x + pad + c * (L.tileW + gap), y: ty + rw * (L.tileH + gap), w: L.tileW, h: L.tileH };
      this.tiles.push(rr);
      const ok = tile.why === 'ok' || tile.why === 'in' || tile.why === 'out';
      const can = tile.why === 'ok';
      panel(ctx, rr, tile.why === 'in' ? 'rgba(234,181,61,.25)' : can ? '#fffaf0' : 'rgba(43,33,24,.06)', can ? C.gold : 'rgba(43,33,24,.18)', 9 * u);
      if (can) {
        ctx.save();
        ctx.globalAlpha *= 0.25 + 0.15 * Math.sin(now * 4 + i);
        panel(ctx, rr, 'rgba(255,220,130,.35)', null, 9 * u);
        ctx.restore();
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = ok ? C.ink : 'rgba(43,33,24,.5)';
      ctx.font = font(800, 11.5 * u, SANS);
      const lv = tile.kind === 'mate' || tile.kind === 'cave' ? '' : tile.lv > 0 ? ` · ${tile.lv}` : '';
      let title = `${tile.title}${lv}`;
      while (ctx.measureText(title).width > rr.w - 12 * u && title.length > 3) title = `${title.slice(0, -2)}…`;
      ctx.fillText(title, rr.x + 6 * u, rr.y + 5 * u);
      ctx.font = font(600, 10 * u, SANS);
      ctx.fillStyle = ok ? C.inkSoft : 'rgba(43,33,24,.45)';
      let fx = tile.fx;
      while (ctx.measureText(fx).width > rr.w - 12 * u && fx.length > 3) fx = `${fx.slice(0, -2)}…`;
      ctx.fillText(fx, rr.x + 6 * u, rr.y + 20 * u);
      // the price or the reason
      const reason = whyText(tile.kind, tile.id, tile.why);
      ctx.font = font(800, 10 * u, SANS);
      ctx.fillStyle = can ? C.goldDeep : tile.why === 'silver' ? C.terracottaDeep : 'rgba(43,33,24,.55)';
      ctx.textBaseline = 'bottom';
      if (!reason && tile.price) this.drawPrice(ctx, tile.price, rr.x + 6 * u, rr.y + rr.h - 5 * u, rr.w - 12 * u, u, sim, now);
      else {
        let bottom = reason ?? tile.cost;
        while (ctx.measureText(bottom).width > rr.w - 12 * u && bottom.length > 3) bottom = `${bottom.slice(0, -2)}…`;
        ctx.fillText(bottom, rr.x + 6 * u, rr.y + rr.h - 5 * u);
      }
    });
    ctx.restore();
  }

  /** A price as icons and numbers (a silver coin, brushwood, a stone), each red when the treasury lacks it. */
  private drawPrice(ctx: CanvasRenderingContext2D, price: readonly [number, number, number], x: number, y: number, maxW: number, u: number, sim: DawidSim, now: number): void {
    const p = sim.p, have = [p.silver, p.wood, p.stone];
    let cx = x;
    const r = 6 * u;
    for (let i = 0; i < 3; i++) {
      if (price[i] <= 0) continue;
      const iy = y - r;
      if (i === 0) paintCoin(ctx, 'silver', cx + r, iy + r * 0.9, r * 2.2, now, 9);
      else paintCoin(ctx, i === 1 ? 'wood' : 'stone', cx + r, iy + r * 1.1, r * 2, now, 9);
      const txt = fmtNum(price[i]);
      ctx.fillStyle = have[i] >= price[i] ? C.ink : C.terracottaDeep;
      ctx.fillText(txt, cx + r * 2 + 2 * u, y);
      cx += r * 2 + 6 * u + ctx.measureText(txt).width;
      if (cx - x > maxW) break;
    }
  }

  /** The opening card, a land's card, a guardian driven off, the people the quests lead to. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim): void {
    const st = sim.story;
    if (!st || st.t < 0) return;
    const u = L.u, k = Math.min(1, st.t / 0.35), out = st.dur - st.t < 0.3 ? (st.dur - st.t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(k, out));
    ctx.fillStyle = 'rgba(24,18,12,.6)';
    ctx.fillRect(0, 0, L.w, L.h);
    const w = Math.min(L.w - 24, 480 * u);
    const pad = 18 * u;
    ctx.font = font(500, 14 * u, SANS);
    const lines = wrap(ctx, st.text, w - pad * 2).slice(0, 7);
    ctx.font = font(800, 22 * u, SERIF, true);
    const titleLines = wrap(ctx, st.title, w - pad * 2).slice(0, 2);
    const room = L.h - L.top - 16;
    let vh = 0;
    if (st.verse) {
      const ps = passage(st.verse);
      const avail = Math.max(40, room - (pad * 2 + titleLines.length * 28 * u + lines.length * 19 * u + 46 * u));
      if (!this.passage || this.passage.id !== st.verse || this.passage.w !== w) this.passage = { id: st.verse, l: layoutPassage(ctx, ps, w - pad * 2, avail, { max: 16, min: 10 }), w };
      vh = this.passage.l.height + 12 * u;
    }
    const h = Math.min(room, pad * 2 + titleLines.length * 28 * u + 6 * u + lines.length * 19 * u + vh + 26 * u);
    const r = { x: (L.w - w) / 2, y: L.top + Math.max(8, Math.min(40 * u, (L.h - L.top - h) / 3)), w, h };
    panel(ctx, r, C.parchment, C.goldDeep, 14 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 22 * u, SERIF, true);
    let y = r.y + pad;
    for (const l of titleLines) { ctx.fillText(l, L.w / 2, y); y += 28 * u; }
    y += 6 * u;
    ctx.font = font(500, 14 * u, SANS);
    ctx.fillStyle = C.inkSoft;
    for (const l of lines) { ctx.fillText(l, L.w / 2, y); y += 19 * u; }
    if (st.verse && this.passage) drawPassage(ctx, passage(st.verse), this.passage.l, L.w / 2, y + 10 * u, { text: C.ink, ref: C.goldDeep });
    ctx.font = font(800, 12 * u, SANS);
    ctx.fillStyle = C.goldDeep;
    ctx.fillText(st.kind === 'open' ? t('story.tap') : t('story.next'), L.w / 2, r.y + h - pad - 4 * u);
    ctx.restore();
  }

  /** A speech bubble over someone's head (kept on screen and under the runner's HUD); Goliath's is red-brown. */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, k: number, loud = false): void {
    const u = L.u;
    ctx.save();
    ctx.font = font(loud ? 800 : 650, 13 * u, SANS);
    const maxW = Math.min(250 * u, L.w - 24);
    const lines = wrap(ctx, text, maxW - 20 * u);
    const lh = 16 * u;
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20 * u), bh = lines.length * lh + 14 * u;
    const bx = Math.max(8, Math.min(L.w - bw - 8, x - bw * 0.3));
    const by = Math.max(L.top + 4 + (L.quest.h + 8), Math.min(L.bottom - bh - 70 * u, y - bh - 12 * u));
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.fillStyle = loud ? '#7a3424' : '#fffaf0';
    ctx.strokeStyle = loud ? 'rgba(255,220,180,.6)' : 'rgba(43,33,24,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10 * u);
    ctx.fill();
    ctx.stroke();
    const tx = Math.max(bx + 12, Math.min(bx + bw - 12, x));
    if (by + bh < y) {
      ctx.beginPath();
      ctx.moveTo(tx - 6 * u, by + bh - 1);
      ctx.lineTo(x, Math.min(y - 4, by + bh + 10 * u));
      ctx.lineTo(tx + 6 * u, by + bh - 1);
      ctx.fill();
    }
    ctx.fillStyle = loud ? '#ffe9c8' : C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10 * u, by + 7 * u + i * lh));
    ctx.restore();
  }

  /** A short banner under the HUD ("Poziom 12!", "Lew się budzi!"). */
  drawBanner(ctx: CanvasRenderingContext2D, L: Layout, text: string, k: number, color: string, big = false): void {
    const u = L.u;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const a = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(900, (big ? 30 : 21) * u * pop, SERIF, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = L.bannerY + (big ? 10 * u : 0);
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(30,20,10,.6)';
    ctx.strokeText(text, L.w / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, L.w / 2, y);
    ctx.restore();
  }

  /** The level-up's big words: the number and the gains. */
  drawLevelUp(ctx: CanvasRenderingContext2D, L: Layout, level: number, gain: string, k: number): void {
    const u = L.u;
    const pop = k < 0.2 ? ease.outElastic(k / 0.2) : 1;
    const a = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = L.ky - L.s * 2.6 - 20 * u * ease.outCubic(k);
    ctx.font = font(900, 38 * u * pop, SERIF, true);
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = 'rgba(60,30,0,.55)';
    const text = t('hud.levelUp', { n: level });
    ctx.strokeText(text, L.w / 2, y);
    const g = ctx.createLinearGradient(0, y - 20 * u, 0, y + 20 * u);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(1, '#e8a830');
    ctx.fillStyle = g;
    ctx.fillText(text, L.w / 2, y);
    ctx.font = font(800, 14 * u, SANS);
    ctx.lineWidth = 4 * u;
    ctx.strokeText(gain, L.w / 2, y + 28 * u);
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(gain, L.w / 2, y + 28 * u);
    ctx.restore();
  }

  /** "+48 XP ×3" over a beast driven off. */
  static xpWords(v: number, mult: number): string {
    return mult > 1 ? `+${xpText(v)} ×${fmtNum(mult, Number.isInteger(mult) ? 0 : 1)}` : `+${xpText(v)}`;
  }

  /** How long the coach marks of the camp stay (s). */
  static readonly hintSec = RULES.storySec;
}
