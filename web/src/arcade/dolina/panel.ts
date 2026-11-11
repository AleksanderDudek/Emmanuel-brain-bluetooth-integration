/**
 * Dolina's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * level the next run starts at, the record, the stars and the lambs; the mode (the valley or the
 * clock tower, once the first guardian is beaten) with the tower's floor and clock; the valley's map
 * (the levels around the current one on a climbing path, coloured by era, a guardian's level marked,
 * the stars won under each); the party — six companions, those found with their bond, a tap takes
 * one along or leaves them at the camp, the slots open with the guardians; the gear in its four
 * slots with the shards to the next tier and the pilgrim's strength; the missions on offer; the
 * provisions left; the pilgrim's form with its perk; the upgrades with their next level for sparks;
 * and the day's gift.  A choice changes the progress, calls `save()` and redraws the card in place.
 * Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { paintGearIcon, paintMate, paintClock, TIER_COLOR } from './cast';
import {
  BUFFS, COMPS, ERAS, GEAR, UPGRADES, buffName, buffText, compName, compText, eraOfLevel, gearName, gearText, guardLevel, lookName, missionText,
  perkText, powerName, powerText, tierName, upName, upText, type CompId, type UpId,
} from './content';
import { sparks as sparksText, t } from './i18n';
import {
  bestOf, buyUp, clockTime, compBond, compLevel, gearTier, lookOf, migrate, missionReward, nextBondAt, nextLookAt, partyFor, shardsNeed, slotsFor,
  starTotal, starsOf, strengthOf, toggleParty, towerOpen, upLevel, upPrice, type DolinaProgress, type Mode,
} from './meta';
import { C, PAL, SANS, TAU, font, paintPortrait, paintUpIcon, rgb } from './paint';
import { RULES } from './rules';

const metres = (n: string): string => t('metres', { n });

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number, draw: (ctx: CanvasRenderingContext2D) => void, cls?: string): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true', class: cls ?? null });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
  }
  return c;
}

/** A button that changes the progress: disabled when it cannot. */
function button(label: string, can: boolean, primary: boolean, data: Record<string, string>, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: primary && can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled', ...data }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

/** A tile that acts as a button (Enter and Space too). */
function tile(cls: string | null, title: string, pressed: boolean | null, onClick: (() => void) | null, ...kids: (Node | string | null)[]): HTMLElement {
  const press = (e: Event) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  return h('div', {
    class: cls, title, role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, 'aria-pressed': pressed === null ? null : String(pressed),
    on: onClick ? { click: onClick, keydown: press } : undefined,
  }, ...kids);
}

export function progressPanel(p: DolinaProgress, save: () => void): HTMLElement {
  migrate(p);
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

/** The valley's map: nine levels around the current one on a climbing path. */
export function paintMap(ctx: CanvasRenderingContext2D, w: number, hh: number, p: DolinaProgress): void {
  const cur = Math.max(1, p.level);
  const first = Math.max(1, cur - 4), n = 9;
  const bg = ctx.createLinearGradient(0, 0, 0, hh);
  bg.addColorStop(0, '#2a2440');
  bg.addColorStop(1, '#16131f');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, hh, 12);
  ctx.fill();
  const pos = (i: number) => {
    const k = i / (n - 1);
    return { x: 22 + k * (w - 44), y: hh - 26 - k * (hh - 56) + Math.sin(i * 1.9) * 8 };
  };
  // the path climbing out of the valley
  ctx.strokeStyle = 'rgba(255,226,170,.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = pos(i);
    if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const lv = first + i, q = pos(i);
    const era = ERAS[eraOfLevel(lv)];
    const done = lv < cur, here = lv === cur;
    const r = here ? 11 : guardLevel(lv) ? 10 : 8;
    ctx.fillStyle = done || here ? rgb(PAL[era].accent) : 'rgba(255,255,255,.12)';
    ctx.beginPath();
    if (guardLevel(lv)) {
      // a guardian's level: a diamond
      ctx.moveTo(q.x, q.y - r);
      ctx.lineTo(q.x + r, q.y);
      ctx.lineTo(q.x, q.y + r);
      ctx.lineTo(q.x - r, q.y);
      ctx.closePath();
    } else ctx.arc(q.x, q.y, r, 0, TAU);
    ctx.fill();
    if (here) {
      ctx.strokeStyle = '#fff1c4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = done || here ? '#16131f' : 'rgba(255,241,196,.5)';
    ctx.font = font(800, 10, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(lv), q.x, q.y + 0.5);
    const stars = starsOf(p, lv);
    for (let s = 0; s < 3 && (done || stars > 0); s++) {
      ctx.fillStyle = s < stars ? C.gold : 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.arc(q.x - 8 + s * 8, q.y + r + 7, 2.6, 0, TAU);
      ctx.fill();
    }
  }
}

/** The tower in the lobby: its floors as a column climbing to the clock, the floor the next run starts on lit. */
export function paintTowerMap(ctx: CanvasRenderingContext2D, w: number, hh: number, p: DolinaProgress): void {
  const bg = ctx.createLinearGradient(0, 0, 0, hh);
  bg.addColorStop(0, '#1b1522');
  bg.addColorStop(1, '#2c2230');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, hh, 12);
  ctx.fill();
  const cur = Math.max(1, p.tower.floor);
  const first = Math.max(1, cur - 6), n = 10;
  // the column of floors, left to right as a climbing stair
  for (let i = 0; i < n; i++) {
    const f = first + i;
    const x = 18 + i * ((w * 0.62 - 36) / (n - 1)), y = hh - 18 - i * ((hh - 40) / (n - 1));
    const keeper = f % RULES.tower.keeperEvery === 0;
    ctx.fillStyle = f < cur ? '#f0c868' : f === cur ? '#fff1c4' : 'rgba(255,255,255,.14)';
    ctx.beginPath();
    if (keeper) ctx.roundRect(x - 9, y - 9, 18, 18, 4);
    else ctx.arc(x, y, f === cur ? 9 : 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = f <= cur ? '#1b1522' : 'rgba(255,241,196,.5)';
    ctx.font = font(800, 9, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(f), x, y + 0.5);
  }
  const r = Math.min(hh * 0.36, w * 0.14);
  paintClock(ctx, w * 0.82, hh * 0.48, r, ((cur - 1) % RULES.tower.dawnFloor) * RULES.tower.minutes, 0);
}

function build(p: DolinaProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const out: HTMLElement[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.level'), fmtNum(Math.max(1, p.level))),
      stat(t('panel.best'), best === null ? '—' : metres(fmtNum(best))),
      stat(t('panel.stars'), fmtNum(starTotal(p))),
      stat(t('panel.lambs'), fmtNum(p.lambs)),
      stat(t('panel.sparks'), fmtNum(p.sparks))),
  ];
  // the mode: the valley, or the clock tower once open
  const open = towerOpen(p);
  const mode: Mode = open && p.mode === 'tower' ? 'tower' : 'valley';
  const modeButton = (m: Mode) => {
    const on = mode === m, can = m === 'valley' || open;
    const b = h('button', { class: on ? 'btn primary' : 'btn', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'data-mode': m, disabled: can ? null : 'disabled' },
      t(m === 'valley' ? 'panel.valley' : 'panel.tower'));
    b.addEventListener('click', e => {
      e.preventDefault();
      if (!can || p.mode === m) return;
      p.mode = m;
      changed();
    });
    return b;
  };
  out.push(h('div', { class: 'arcade-sub' }, t('panel.mode')), h('div', { class: 'seg' }, modeButton('valley'), modeButton('tower')));
  out.push(h('p', { class: 'muted' }, mode === 'tower' ? t('panel.modeTower') : open ? t('panel.modeValley') : `${t('panel.modeValley')} ${t('panel.towerLocked')}`));
  if (mode === 'tower') {
    const map = canvas(320, 120, ctx => paintTowerMap(ctx, 320, 120, p));
    map.style.width = '100%';
    map.style.maxWidth = '420px';
    map.style.height = 'auto';
    out.push(map, h('p', { class: 'muted' }, t('panel.towerAt', { n: p.tower.floor, time: clockTime(p.tower.floor), best: p.tower.best || '—' })));
  } else {
    const map = canvas(320, 120, ctx => paintMap(ctx, 320, 120, p));
    map.style.width = '100%';
    map.style.maxWidth = '420px';
    map.style.height = 'auto';
    out.push(h('div', { class: 'arcade-sub' }, t('panel.map')), map, h('p', { class: 'muted' }, t('panel.mapHint', { n: Math.max(1, p.level) })));
  }
  // the party
  const slots = slotsFor(p.guards), party = partyFor(p, slots);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.party', { n: party.length, slots })));
  out.push(h('div', { class: 'arcade-album' }, COMPS.map((id: CompId) => {
    const found = p.found.includes(id), going = party.includes(id);
    if (!found) {
      return tile(null, t('panel.unknown'), null, null, canvas(52, 40, ctx => {
        ctx.globalAlpha = 0.18;
        paintMate(ctx, id, 26, 38, 26, { run: 0, t: 0, act: 0, gold: false, air: false, sleep: false });
      }), '?');
    }
    const lv = compLevel(p, id), next = nextBondAt(compBond(p, id));
    const title = `${compName(id)} · ${powerName(id)}: ${powerText(id, lv)} — ${compText(id)}${next === null ? '' : ` (${fmtNum(compBond(p, id))}/${fmtNum(next)})`}`;
    return tile(going ? 'on legend' : 'on', title, going, () => {
      toggleParty(p, id);
      changed();
    }, canvas(52, 40, ctx => paintMate(ctx, id, 26, 38, id === 'glaz' ? 22 : 28, { run: 0.6, t: 0, act: 0, gold: going, air: false, sleep: !going })),
    compName(id), h('small', null, going ? t('panel.lv', { n: lv }) : `${t('panel.lv', { n: lv })} · ${t('panel.camp')}`));
  })));
  out.push(h('p', { class: 'muted' }, p.found.length ? `${t('panel.partyHint')} ${slots < 3 ? t('panel.slotHint') : ''}`.trim() : t('panel.unknownHint')));
  // the gear
  out.push(h('div', { class: 'arcade-sub' }, `${t('panel.gear')} · ${t('panel.strength', { n: fmtNum(strengthOf(p)) })}`));
  out.push(h('div', { class: 'arcade-album' }, GEAR.map(s => {
    const tier = gearTier(p, s), need = shardsNeed(tier);
    const shards = Math.max(0, p.gear?.[s]?.shards ?? 0);
    const cls = tier >= 5 ? 'on legend' : tier >= 3 ? 'on epic' : tier >= 1 ? 'on rare' : null;
    const sub = tier === 0 ? '—' : need === null ? tierName(tier) : `${tierName(tier)} ${shards}/${need}`;
    const title = tier === 0 ? `${gearName(s)}: ${gearText(s)}`
      : `${gearName(s)} · ${tierName(tier)}: ${gearText(s)}${need === null ? ` (${t('panel.gearMax')})` : ` — ${t('panel.shards', { have: shards, need })}`}`;
    const el = tile(cls, title, null, null, canvas(52, 40, ctx => paintGearIcon(ctx, s, 26, 20, 14, tier)), gearName(s), h('small', null, sub));
    if (tier > 0) el.style.borderColor = TIER_COLOR[tier];
    return el;
  })));
  if (GEAR.every(s => gearTier(p, s) === 0)) out.push(h('p', { class: 'muted' }, t('panel.noGear')));
  // the missions
  out.push(h('div', { class: 'arcade-sub' }, t('panel.missions')));
  for (const m of p.missions) {
    out.push(h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, missionText(m.kind, m.goal)), h('p', null, `${fmtNum(m.have)} / ${fmtNum(m.goal)}`)),
      h('span', { class: 'badge' }, `+${sparksText(missionReward(m))}`)));
  }
  out.push(h('p', { class: 'muted' }, t('panel.chestEvery')));
  // the provisions
  const buffs = BUFFS.filter(b => (p.buffs?.[b] ?? 0) > 0);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.buffs')));
  out.push(buffs.length
    ? h('div', { class: 'arcade-chips' }, buffs.map(b => h('span', { class: 'on', title: buffText(b) }, `${buffName(b)} · ${t('panel.buffLeft', { n: p.buffs[b] })}`)))
    : h('p', { class: 'muted' }, t('panel.noBuffs')));
  // the form and its perk
  const look = lookOf(p.sparksAll);
  const next = nextLookAt(p.sparksAll);
  const from = RULES.looks[look];
  const bar = h('i');
  bar.style.width = `${next === null ? 100 : Math.round(((p.sparksAll - from) / (next - from)) * 100)}%`;
  out.push(h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.look', { name: lookName(look) }),
      h('b', null, next === null ? t('panel.lookMax') : t('panel.toLook', { have: fmtNum(p.sparksAll), need: fmtNum(next) }))),
    h('i', null, bar)));
  out.push(h('div', { class: 'arcade-album' }, RULES.looks.map((_, i) => {
    const own = i <= look, name = lookName(i);
    return h('div', { class: own ? 'on' : null, title: i ? `${name}: ${perkText(i)}` : name }, canvas(52, 40, ctx => paintPortrait(ctx, 52, 40, i, own)), own ? name : '?');
  })));
  if (look > 0) out.push(h('p', { class: 'muted' }, t('panel.perk', { text: perkText(look) })));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));
  // the upgrades
  out.push(h('div', { class: 'arcade-sub' }, t('panel.ups')));
  for (const id of UPGRADES as readonly UpId[]) {
    const lv = upLevel(p, id), price = upPrice(id, lv);
    const right = price === null
      ? h('span', { class: 'badge ok' }, t('panel.upMax'))
      : button(t('panel.buy', { sparks: sparksText(price) }), p.sparks >= price, true, { 'data-up': id }, () => {
        if (buyUp(p, id)) changed();
      });
    right.style.marginLeft = 'auto';
    out.push(h('div', { class: 'arcade-daily' }, canvas(36, 36, ctx => paintUpIcon(ctx, id, 18, 18, 14, lv)),
      h('div', null, h('b', null, `${upName(id)} · ${t('panel.upLevel', { n: lv, max: RULES.upMax[id] })}`), h('p', null, upText(id))), right));
  }
  // the day's gift
  const today = dayKey();
  const gifted = p.giftDay === today;
  out.push(h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daygift.title')), h('p', null, gifted ? t('daygift.done') : t('daygift.todo', { sparks: sparksText(RULES.dayGift) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1')));
  return out;
}
