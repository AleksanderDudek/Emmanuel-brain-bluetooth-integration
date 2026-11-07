/**
 * Jerzy i smok's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records and the treasury, the map of the dragon's lands (freed, held now with the share of
 * scales already knocked off, or later), the forge's permanent upgrades (bought here with the
 * treasury's scales), and the armoury's pieces with the milestone each needs.  Built with h() and
 * createElement; a purchase saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { ARMOUR, DRAGONS, FORGE, armourHow, armourName, armourText, dragonName, forgeCost, townName, type DragonSpec, type ForgeId } from './content';
import { t, type Key } from './i18n';
import { bestOf, buyForge, dragonAt, forgeLevel, hasArmour, hpOf, type JerzyProgress } from './meta';
import { paintTownTile } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function town(spec: DragonSpec, state: 'done' | 'now' | 'later', pct: number): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintTownTile(ctx, 52, 40, spec.kind, spec.arena, state);
  }
  const label = state === 'now' ? `${townName(spec.kind)} · ${t('panel.now', { pct })}` : `${townName(spec.kind)} · ${state === 'done' ? t('panel.done') : t('panel.later')}`;
  return h('div', { class: state === 'later' ? null : 'on', title: `${townName(spec.kind)}: ${dragonName(spec.kind)}` }, c, label);
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
  const { spec, circle } = dragonAt(p.dragon);
  const at = p.dragon % DRAGONS.length;
  const pct = Math.round((p.damage / Math.max(1, hpOf(spec, circle))) * 100);
  const map = h('div', { class: 'arcade-album' }, DRAGONS.map((d, i) => town(d, i < at ? 'done' : i === at ? 'now' : 'later', pct)));
  const forge = FORGE.map(f => {
    const id: ForgeId = f.id;
    const lv = forgeLevel(p, id), cost = forgeCost(id, lv);
    const right = cost === null
      ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(t('panel.buy', { cost: fmtNum(cost) }), p.bank >= cost, () => {
        if (buyForge(p, id)) changed();
      });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${t(`forge.${id}` as Key)} · ${lv}/${f.max}`), h('p', null, t(`forge.${id}.text` as Key))), right);
  });
  const armour = h('div', { class: 'arcade-chips' }, ARMOUR.map(id => {
    const own = hasArmour(p, id);
    return h('span', { class: own ? 'on' : 'muted', title: own ? armourText(id) : armourHow(id) }, own ? `${armourName(id)} · ${armourText(id)}` : `? · ${armourHow(id)}`);
  }));
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.bank'), fmtNum(p.bank)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.bestRun'), p.bestRun > 0 ? fmtNum(p.bestRun) : '—'),
      stat(t('panel.driven'), fmtNum(p.driven))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    circle > 0 ? h('p', { class: 'muted' }, t('panel.circle', { n: circle + 1 })) : null,
    h('div', { class: 'arcade-sub' }, t('panel.forge')), ...forge,
    h('div', { class: 'arcade-sub' }, t('panel.armoury', { have: ARMOUR.filter(id => hasArmour(p, id)).length, total: ARMOUR.length })), armour,
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
