/**
 * Jerzy i smok's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records and the crowns; the quest's map of the six lands (crowns for the roads cleared, the
 * fight now with the share of scales already knocked off) and the fights the map allows — the
 * frontier, or a freed land's next, harder road; the companions (take one along, or two); the forge's
 * permanent upgrades (bought here with the treasury's scales); the armoury; the treasury of the
 * dragons' hoard; the Book of Dragons (each dragon's weak spot once found, a hint before); the duets.
 * Built with h() and createElement; a choice saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import {
  ARMOUR, COMPANIONS, DRAGONS, DUETS, FORGE, TREASURES, armourHow, armourName, armourText, dragonName, duetName, duetText,
  flawHint, flawName, flawText, forgeCost, palHow, palName, palText, roadName, townName, treasureName, treasureText,
  type CompanionId, type DragonSpec, type ForgeId,
} from './content';
import { t, type Key } from './i18n';
import {
  bestOf, buyForge, crowns, fightOf, fights, forgeLevel, hasArmour, hpOf, pickFight, slots, toggleParty, woundsOf, type JerzyProgress,
} from './meta';
import { paintTownTile } from './paint';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** A land's tile: freed (crowns), fought now, open, or later (in mist). */
function town(spec: DragonSpec, state: 'done' | 'now' | 'later', label: string, crownsN: number): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintTownTile(ctx, 52, 40, spec.kind, spec.arena, state);
  }
  const cls = state === 'now' ? 'on legend' : crownsN > 0 ? 'on' : null;
  return h('div', { class: cls, title: `${townName(spec.kind)}: ${cap(dragonName(spec.kind))}` },
    c, label, crownsN > 0 ? h('small', null, '♛'.repeat(Math.min(4, crownsN)) + (crownsN > 4 ? `+${crownsN - 4}` : '')) : null);
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

/** A row with a title, a line of text and something on the right (a button, a badge). */
function row(title: string, text: string, right: HTMLElement | null, done = false): HTMLElement {
  if (right) right.style.marginLeft = 'auto';
  return h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' }, h('div', null, h('b', null, title), text ? h('p', null, text) : null), right);
}

export function progressPanel(p: JerzyProgress, save: () => void): HTMLElement {
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

function build(p: JerzyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const now = fightOf(p);
  const pct = Math.round((woundsOf(p, now.land, now.tier) / Math.max(1, hpOf(now.spec, now.tier))) * 100);
  const open = fights(p);
  // the map: six lands
  const map = h('div', { class: 'arcade-album' }, DRAGONS.map((d, i) => {
    const c = p.cleared[i] ?? 0;
    const isNow = i === now.land;
    const state = isNow ? 'now' : c > 0 ? 'done' : 'later';
    const label = `${townName(d.kind)} · ${isNow ? t('panel.now', { pct }) : c > 0 ? t('panel.done') : t('panel.later')}`;
    return town(d, state, label, c);
  }));
  // the fights the map allows: the one chosen now, the others to pick
  const fightRows = open.map(f => {
    const spec = DRAGONS[f.land];
    const chosen = f.land === now.land && f.tier === now.tier;
    const title = t('panel.fightLine', { name: cap(dragonName(spec.kind)), road: roadName(f.tier) });
    const right = chosen ? h('span', { class: 'badge ok' }, t('panel.picked')) : button(t('panel.pick'), true, () => {
      if (pickFight(p, f.land)) changed();
    });
    return row(title, `${townName(spec.kind)} — ${cap(dragonName(spec.kind))} ${t(`story.${spec.kind}` as Key)}`, right, chosen);
  });
  // the companions
  const nSlots = slots(p);
  const pals = COMPANIONS.map(id => {
    const own = p.companions.includes(id), along = p.party.includes(id);
    let right: HTMLElement;
    if (!own) right = h('span', { class: 'badge' }, '?');
    else if (along) right = button(t('panel.leave'), true, () => { if (toggleParty(p, id as CompanionId)) changed(); });
    else right = button(t('panel.take'), p.party.length < nSlots, () => { if (toggleParty(p, id as CompanionId)) changed(); });
    return row(own ? `${palName(id)}${along ? ` · ${t('panel.along')}` : ''}` : `? · ${palHow(id)}`, own ? palText(id) : '', right, along);
  });
  // the forge
  const forge = FORGE.map(f => {
    const id: ForgeId = f.id;
    const lv = forgeLevel(p, id), cost = forgeCost(id, lv);
    const right = cost === null
      ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(t('panel.buy', { cost: fmtNum(cost) }), p.bank >= cost, () => {
        if (buyForge(p, id)) changed();
      });
    return row(`${t(`forge.${id}` as Key)} · ${lv}/${f.max}`, t(`forge.${id}.text` as Key), right);
  });
  const armour = h('div', { class: 'arcade-chips' }, ARMOUR.map(id => {
    const own = hasArmour(p, id);
    return h('span', { class: own ? 'on' : 'muted', title: own ? armourText(id) : armourHow(id) }, own ? `${armourName(id)} · ${armourText(id)}` : `? · ${armourHow(id)}`);
  }));
  const treasury = h('div', { class: 'arcade-chips' }, TREASURES.map(id => {
    const own = p.treasures.includes(id);
    return h('span', { class: own ? 'on' : 'muted', title: own ? treasureText(id) : '?' }, own ? `${treasureName(id)} · ${treasureText(id)}` : '?');
  }));
  // the Book of Dragons: the dragons met so far (and the next one), each weak spot once found
  const met = DRAGONS.filter((_, i) => (p.cleared[i] ?? 0) > 0 || i === now.land || open.some(f => f.land === i));
  const codex = met.map(d => {
    const found = p.flaws.includes(d.kind);
    return row(`${cap(dragonName(d.kind))}${found ? ` · ${flawName(d.flaw)}` : ''}`, found ? flawText(d.flaw) : t('panel.codexHidden', { hint: flawHint(d.flaw) }), null, found);
  });
  const duets = h('div', { class: 'arcade-chips' }, DUETS.map(d => {
    const own = p.duets.includes(d.id);
    return h('span', { class: own ? 'on' : 'muted', title: own ? duetText(d.id) : '?' }, own ? `${duetName(d.id)} · ${duetText(d.id)}` : '?');
  }));
  const anyCleared = p.cleared.some(c => c > 0);
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.bank'), fmtNum(p.bank)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.bestRun'), p.bestRun > 0 ? fmtNum(p.bestRun) : '—'),
      stat(t('panel.crowns'), fmtNum(crowns(p)))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    h('div', { class: 'arcade-sub' }, t('panel.next')), ...fightRows,
    anyCleared ? h('p', { class: 'muted' }, t('panel.roads')) : null,
    h('div', { class: 'arcade-sub' }, t('panel.pals', { slots: nSlots })), ...pals,
    h('div', { class: 'arcade-sub' }, t('panel.codex', { have: p.flaws.length, total: DRAGONS.length })), ...codex,
    h('div', { class: 'arcade-sub' }, t('panel.forge')), ...forge,
    h('div', { class: 'arcade-sub' }, t('panel.armoury', { have: ARMOUR.filter(id => hasArmour(p, id)).length, total: ARMOUR.length })), armour,
    h('div', { class: 'arcade-sub' }, t('panel.treasury', { have: p.treasures.length, total: TREASURES.length })), treasury,
    h('div', { class: 'arcade-sub' }, t('panel.duets', { have: p.duets.length, total: DUETS.length })), duets,
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
