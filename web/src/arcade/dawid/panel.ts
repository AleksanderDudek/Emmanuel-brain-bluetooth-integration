/**
 * Dawid's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the records
 * and the treasury, David's road (six lands: freed, now with the share of its guardian driven off, ahead),
 * the camp's buildings, the ability ladder at the bonfire, the forge, the party (who walks along), the
 * shepherd's tally and the cave's deepest floor.  Built with h() and createElement; a purchase or a
 * choice saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import {
  ABILITIES, BEASTS, BUILDINGS, COMPANIONS, CRAFT, LANDS, WEAPON_IDS, abilityName, beastName, buildingName, companionName, kitText, landName,
  type CompanionId, type LandSpec, type WeaponId,
} from './content';
import { t } from './i18n';
import {
  abilityCost, abilityLevel, abilityWhy, bestOf, build, buildingCost, buildingLevel, buildingWhy, buyAbility, forge, guardHp, hasJoined, landAt,
  partyNow, partySlots, stars, tierOf, toggleParty, weaponCost, weaponLevel, weaponWhy, type BuyWhy, type DawidProgress,
} from './meta';
import { GROUND, paintBeast, paintGiant } from './paint';
import { abilityFx, buildingFx, costText, weaponFx, whyText } from './sim';
import { weaponName } from './content';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function landTile(spec: LandSpec, state: 'done' | 'now' | 'later', pct: number): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = GROUND[spec.ground];
    ctx.fillStyle = state === 'later' ? '#5a5448' : g.a;
    ctx.beginPath();
    ctx.roundRect(0, 0, 52, 40, 6);
    ctx.fill();
    ctx.globalAlpha = state === 'later' ? 0.45 : 1;
    if (spec.guard === 'goliat' || spec.guard === 'olbrzym') paintGiant(ctx, 26, 36, 10, { flip: -1, step: 0, moving: 0, act: 0, hit: 0, fall: state === 'done' ? 1 : 0, t: 0, daze: 0, hue: spec.guard === 'olbrzym' ? 1 : 0 });
    else paintBeast(ctx, spec.guard, 26, 33, 15, { flip: -1, step: 0, moving: 0, hit: 0, doze: state === 'later' ? 1 : 0, t: 0, air: 0, tele: 0, flee: 0, seed: 1, hidden: false }, 1);
    ctx.globalAlpha = 1;
  }
  const label = state === 'now' ? `${landName(spec.id)} · ${t('panel.now', { pct })}` : `${landName(spec.id)} · ${state === 'done' ? t('panel.done') : t('panel.later')}`;
  return h('div', { class: state === 'later' ? null : 'on', title: landName(spec.id) }, c, label);
}

/** A button that changes the progress: disabled when it cannot. */
function button(label: string, can: boolean, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

function row(title: string, text: string, right: HTMLElement): HTMLElement {
  right.style.marginLeft = 'auto';
  return h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, title), h('p', null, text)), right);
}

const priceLabel = (kind: 'ab' | 'bd' | 'wp', id: string, why: BuyWhy, cost: string): string =>
  (why === 'ok' || why === 'silver' ? t('panel.buy', { cost }) : whyText(kind, id, why) ?? t('panel.buy', { cost }));

export function progressPanel(p: DawidProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of buildPanel(p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

function buildPanel(p: DawidProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const now = landAt(p.land);
  const pct = Math.round((p.wounds / Math.max(1, guardHp(p.land))) * 100);
  const map = h('div', { class: 'arcade-album' }, LANDS.map((spec, i) => landTile(spec, now.circle > 0 || i < now.idx ? 'done' : i === now.idx ? 'now' : 'later', pct)));
  const buildings = BUILDINGS.map(b => {
    const lv = buildingLevel(p, b.id), cost = buildingCost(b.id, lv), why = buildingWhy(p, b.id);
    const right = cost === null ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(priceLabel('bd', b.id, why, costText(cost)), why === 'ok', () => { if (build(p, b.id)) changed(); });
    return row(`${buildingName(b.id)} · ${lv}/3`, buildingFx(b.id, Math.max(1, Math.min(3, lv + (cost ? 1 : 0))), 1), right);
  });
  const abilities = buildingLevel(p, 'ognisko') <= 0 ? [h('p', { class: 'muted' }, t('camp.noFire'))] : ABILITIES.map(a => {
    const lv = abilityLevel(p, a.id), why = abilityWhy(p, a.id);
    const right = why === 'max' ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(priceLabel('ab', a.id, why, fmtNum(abilityCost(a.id, lv))), why === 'ok', () => { if (buyAbility(p, a.id)) changed(); });
    return row(`${abilityName(a.id)} · ${lv}`, abilityFx(a.id, lv + 1, p), right);
  });
  const weapons = WEAPON_IDS.map(id => {
    const lv = weaponLevel(p, id as WeaponId), why = weaponWhy(p, id as WeaponId);
    const cost = lv <= 0 ? CRAFT[id as WeaponId] ?? null : weaponCost(id as WeaponId, lv);
    const right = why === 'max' ? h('span', { class: 'badge ok' }, t('panel.max'))
      : why === 'gift' ? h('span', { class: 'badge' }, t('camp.gift'))
        : button(priceLabel('wp', id, why, cost ? costText(cost) : ''), why === 'ok', () => { if (forge(p, id as WeaponId)) changed(); });
    return row(`${weaponName(id as WeaponId, tierOf(Math.max(1, lv)))} · ${lv}`, weaponFx(id as WeaponId, Math.max(1, lv)), right);
  });
  const inParty = partyNow(p);
  const ahead = COMPANIONS.filter(c => !hasJoined(p, c.id as CompanionId));
  const party = COMPANIONS.filter(c => hasJoined(p, c.id as CompanionId)).map(c => {
    const id = c.id as CompanionId;
    const on = inParty.includes(id);
    const b = button(on ? t('panel.toggle.in') : t('panel.toggle.out'), true, () => { if (toggleParty(p, id)) changed(); });
    if (on) b.className = 'btn';
    return row(`${companionName(id)} ${t('stars', { n: stars(p, id) })}`, kitText(id), b);
  });
  const tally = Object.entries(p.tally).filter(([k, v]) => k in BEASTS && v > 0).sort((a, b) => b[1] - a[1]);
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.level'), String(p.level)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.silver'), fmtNum(p.silver)),
      stat(t('panel.gates'), fmtNum(p.guards))),
    h('p', { class: 'muted' }, `${t('panel.rules')} ${t('panel.stock', { w: fmtNum(p.wood), s: fmtNum(p.stone) })}`),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    now.circle > 0 ? h('p', { class: 'muted' }, t('panel.circle', { n: now.circle + 1 })) : null,
    h('div', { class: 'arcade-sub' }, t('panel.party', { n: inParty.length, m: partySlots(p) })), ...party,
    ahead.length ? h('div', { class: 'arcade-chips' }, ahead.map(c => h('span', { class: 'muted' }, `? · ${t('panel.later.comp', { land: landName(LANDS[c.land].id) })}`))) : null,
    h('div', { class: 'arcade-sub' }, t('panel.buildings')), ...buildings,
    h('div', { class: 'arcade-sub' }, t('panel.abilities')), ...abilities,
    h('div', { class: 'arcade-sub' }, t('panel.forge')), ...weapons,
    tally.length ? h('div', { class: 'arcade-sub' }, t('panel.tally')) : null,
    tally.length ? h('div', { class: 'arcade-chips' }, tally.map(([k, v]) => h('span', { class: 'on' }, `${beastName(k as keyof typeof BEASTS)} · ${fmtNum(v)}`))) : null,
    p.floor > 0 ? h('p', { class: 'muted' }, t('panel.cave', { n: p.floor })) : null,
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
