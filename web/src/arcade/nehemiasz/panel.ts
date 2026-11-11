/**
 * Nehemiasz's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the day of the campaign, the wall of Jerusalem as its ten gates (built with their
 * stars, the one being built with its day, the rest waiting), the city (people, stores), the king's
 * letters (permanent favours bought here with the stars) and the chronicle of builders.  Built with
 * h() and createElement; a purchase saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { CHRONICLE_SIZE, GATES, PERKS, gateDays, gateFirstDay, gateName, perkCost, perkName, perkText, townName, type PerkId, type TownId } from './content';
import { t, type Key } from './i18n';
import { bestOf, buyPerk, perkLevel, perkMax, type NehProgress } from './meta';
import { paintGateTile } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** The next day to play (the day after the last one, the first of the next gate after a gate's last). */
export function nextDay(p: NehProgress): number {
  if (p.gateDay >= gateDays(p.gate)) return p.gate >= GATES.length - 1 ? 1 : gateFirstDay(p.gate + 1);
  return gateFirstDay(p.gate) + p.gateDay;
}

function gateTile(i: number, state: 'done' | 'now' | 'later', stars: number, label: string): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGateTile(ctx, 52, 40, i, state, stars);
  }
  return h('div', { class: state === 'later' ? null : 'on', title: gateName(i) }, c, h('span', null, gateName(i)), h('small', null, label));
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

export function progressPanel(p: NehProgress, save: () => void): HTMLElement {
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

function build(p: NehProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const nd = nextDay(p);
  const gateNow = p.gateDay >= gateDays(p.gate) ? (p.gate + 1) % GATES.length : p.gate;
  const wrapped = p.gateDay >= gateDays(p.gate) && p.gate >= GATES.length - 1;
  const map = h('div', { class: 'arcade-album' }, GATES.map((_, i) => {
    const stars = p.stars[i] ?? 0;
    const done = !wrapped && (i < gateNow || (p.year > 0 && stars > 0 && i !== gateNow));
    const state = i === gateNow ? 'now' : done ? 'done' : 'later';
    const label = state === 'now'
      ? t('panel.now', { d: Math.max(1, gateNow === p.gate ? p.gateDay + 1 : 1), n: gateDays(i) })
      : state === 'done' ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : t('panel.later');
    return gateTile(i, state, stars, label);
  }));
  const letters = PERKS.map(id => {
    const pid: PerkId = id;
    const lv = perkLevel(p, pid), cost = perkCost(pid, lv);
    const right = cost === null
      ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(t('panel.buy', { cost }), p.starBank >= cost, () => {
        if (buyPerk(p, pid)) changed();
      });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${perkName(pid)} · ${lv}/${perkMax(pid)}`), h('p', null, perkText(pid))), right);
  });
  const chronicle = h('div', { class: 'arcade-chips' }, p.chronicle.map(c => {
    const [kind, id] = c.split(':');
    const text = kind === 'town' ? townName(id as TownId) : kind === 'gate' && (GATES as readonly string[]).includes(id)
      ? `${gateName(GATES.indexOf(id as typeof GATES[number]))} · ${t(`gate.${id}.who` as Key)}` : null;
    return text ? h('span', { class: 'on' }, text) : null;
  }));
  const city = h('div', { class: 'arcade-chips' },
    h('span', { class: 'on' }, t('people', { n: p.people })),
    h('span', null, t('panel.stores', { stone: fmtNum(Math.floor(p.stone)), timber: fmtNum(Math.floor(p.timber)), bread: fmtNum(Math.floor(p.bread)) })));
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.day'), p.year > 0 ? `${t('panel.year', { n: p.year + 1 })} · ${nd}` : t('panel.dayV', { day: nd })),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.bank'), fmtNum(p.starBank))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    h('div', { class: 'arcade-sub' }, t('panel.city')), city,
    h('div', { class: 'arcade-sub' }, t('panel.letters')), ...letters,
    h('div', { class: 'arcade-sub' }, t('panel.chronicle', { have: p.chronicle.length, total: CHRONICLE_SIZE })), chronicle,
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
