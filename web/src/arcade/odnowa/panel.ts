/**
 * Odnowa's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the records, the
 * tissue grown so far (a tile per niche: its cells, its full patches, or what opens it), the niche of the next
 * session (in turn, or chosen), the traits the cell has earned (mitochondria, enzymes, lysosomes) with their
 * next milestone, the Wiedza cards met (each with its number, its sentence and its source), and the song and
 * its sing-along line, each with a switch.  Built with h(); a choice saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { CARDS, NICHES, cardNum, cardText, cardTitle, nicheName, type NicheId } from './content';
import { t } from './i18n';
import { bestOf, cardShare, nicheOpen, patchOf, sessionNiche, traitState, TRAITS, type OdnowaProgress, type Trait } from './meta';
import { paintCellIcon } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function tile(n: NicheId, on: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, '#1f5a52');
    g.addColorStop(1, '#0c2629');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 52, 40);
    ctx.globalAlpha = on ? 1 : 0.35;
    paintCellIcon(ctx, n, 18, 21, 9);
    paintCellIcon(ctx, n, 34, 19, 8);
    ctx.globalAlpha = 1;
  }
  return c;
}

function button(label: string, can: boolean, onClick: () => void, primary = true): HTMLButtonElement {
  const b = h('button', { class: can && primary ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

export function progressPanel(p: OdnowaProgress, save: () => void): HTMLElement {
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

const traitName = (tr: Trait, level: number): string => t(`panel.trait.${tr}` as 'panel.trait.mito', { n: level });

function build(p: OdnowaProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const cells = p.tissue.gut + p.tissue.skin + p.tissue.blood;
  const next = sessionNiche(p);
  // the tissue: a tile per niche
  const album = h('div', { class: 'arcade-album' }, NICHES.map(n => {
    const open = nicheOpen(p, n);
    const pt = patchOf(p, n);
    const sub = open ? t('panel.patch', { cells: pt.cells, of: pt.of, patches: pt.patches }) : t('panel.locked', { n: RULES.nicheAt[n] });
    return h('div', { class: open ? 'on' : null, title: nicheName(n) }, tile(n, open), `${nicheName(n)} · ${fmtNum(p.tissue[n])}`, h('small', null, sub));
  }));
  // the next session's niche: in turn, or one chosen
  const choice = h('div', { class: 'arcade-chips' },
    button(`${t('panel.auto')}${p.niche === 'auto' ? ` · ${nicheName(next)}` : ''}`, true, () => {
      p.niche = 'auto';
      changed();
    }, p.niche === 'auto'),
    NICHES.map(n => button(nicheName(n), nicheOpen(p, n), () => {
      p.niche = n;
      changed();
    }, p.niche === n)));
  // the traits
  const traits = TRAITS.map(tr => {
    const s = traitState(p, tr);
    const right = s.next === null ? h('span', { class: 'badge ok' }, t('panel.max')) : h('span', { class: 'badge' }, `${s.level}/${s.max}`);
    right.style.marginLeft = 'auto';
    const line = s.next === null ? t('panel.max') : t(`panel.next.${tr}` as 'panel.next.mito', { next: fmtNum(s.next) });
    return h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, traitName(tr, s.level)), h('p', null, line)), right);
  });
  // Wiedza: the cards met, each with its source
  const met = CARDS.filter(c => p.cards.includes(c.id));
  const cardsEls = met.map(c => h('div', { class: 'arcade-daily' },
    h('div', null, h('b', null, `${cardTitle(c.id)} · ${cardNum(c.id)}`), h('p', null, cardText(c.id)), h('small', { class: 'muted' }, c.src))));
  const locked = CARDS.length - met.length;
  // the song and its line
  const toggle = (name: string, on: boolean, flip: () => void): HTMLElement => {
    const right = button(on ? t('panel.turnOff') : t('panel.turnOn'), true, () => {
      flip();
      changed();
    }, !on);
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, `${name} · ${on ? t('panel.on') : t('panel.off')}`)), right);
  };
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.cells'), fmtNum(cells)),
      stat(t('panel.repairs'), fmtNum(p.repairs)),
      stat(t('panel.atp'), fmtNum(p.atpTotal))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.tissue')), album,
    h('div', { class: 'arcade-sub' }, t('panel.niche')), choice,
    h('div', { class: 'arcade-sub' }, t('panel.traits')), ...traits,
    h('div', { class: 'arcade-sub' }, `${t('panel.cards', { have: met.length, all: CARDS.length })} · ${t('pct', { n: Math.round(cardShare(p) * 100) })}`), ...cardsEls,
    locked > 0 ? h('div', { class: 'arcade-chips' }, h('span', { class: 'muted' }, `? × ${locked} — ${t('panel.cardLocked')}`)) : null,
    toggle(t('panel.song'), p.song, () => { p.song = !p.song; }),
    p.song ? toggle(t('panel.lyrics'), p.lyrics, () => { p.lyrics = !p.lyrics; }) : null,
    h('p', { class: 'muted' }, t('panel.songNote')),
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
