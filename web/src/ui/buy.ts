/**
 * Where to buy the two headbands, at the bottom of every tab (`[data-buy]` in index.html).
 * While no real band streams (none chosen, the source off, the simulator) it is a card: each band
 * with what it measures and what it does in Emmanuel, the chosen one first; once a band streams,
 * it shrinks to one quiet line.  The links go to the makers' own shops, in a new tab; there are
 * no prices (they change), and the app is not affiliated with the makers and earns nothing.
 */
import type { HubStatus } from '../hub';
import { t } from '../i18n/shell';
import { TOOL_INFO, TOOLS, type Tool } from '../tools';
import { h } from './dom';

export const SHOP_URL: Readonly<Record<Tool, string>> = {
  fnirs: 'https://www.mendi.io/products/mendi',
  eeg: 'https://www.brainaccess.ai/shop/brainaccess-halo/',
};

/** 'line' once a real band streams (a short reconnect included, so it does not flicker); the full card otherwise. */
export const buyMode = (s: HubStatus): 'card' | 'line' =>
  s.tool && s.source === 'device' && (s.device.streaming || s.device.reconnecting) ? 'line' : 'card';

/** The bands in the order to show them: the chosen one first. */
const bandOrder = (tool: Tool | null): Tool[] => (tool ? [tool, ...TOOLS.filter(x => x !== tool)] : [...TOOLS]);

const shopLink = (tool: Tool, label: string, cls: string) => h('a', {
  class: cls, href: SHOP_URL[tool], target: '_blank', rel: 'noopener noreferrer',
  'aria-label': t('buy.linkAria', { band: TOOL_INFO[tool].device }),
}, label);

function card(tool: Tool | null): Node[] {
  return [
    h('div', { class: 'card-head' }, t('buy.title')),
    h('div', { class: 'buy-bands' }, bandOrder(tool).map(b => h('section', { class: `buy-band${b === tool ? ' on' : ''}`, 'data-band': b },
      h('h3', null, TOOL_INFO[b].device, h('small', null, TOOL_INFO[b].label), b === tool ? h('span', { class: 'badge tool' }, t('buy.selected')) : null),
      h('p', null, t(b === 'fnirs' ? 'buy.fnirs.measures' : 'buy.eeg.measures')),
      h('p', { class: 'buy-app' }, t(b === 'fnirs' ? 'buy.fnirs.app' : 'buy.eeg.app')),
      shopLink(b, t('buy.link'), 'btn')))),
    h('p', { class: 'buy-note' }, t('buy.note')),
  ];
}

function line(tool: Tool | null): Node[] {
  const links = bandOrder(tool).flatMap((b, i) => [i ? h('span', { 'aria-hidden': 'true' }, '·') : null, shopLink(b, `${TOOL_INFO[b].device} ↗`, '')]);
  return [h('span', null, t('buy.footLead')), ...links.filter((x): x is HTMLElement => !!x),
          h('span', { class: 'buy-sep', 'aria-hidden': 'true' }, '·'), h('span', { class: 'buy-indep' }, t('buy.footNote'))];
}

export class BuyBox {
  private sig = '';

  render(s: HubStatus): void {
    const mode = buyMode(s);
    const sig = `${mode}|${s.tool}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const root of document.querySelectorAll<HTMLElement>('[data-buy]')) {
      root.className = mode === 'card' ? 'buy card' : 'buy line';
      root.setAttribute('aria-label', t('buy.title'));
      root.replaceChildren(...(mode === 'card' ? card(s.tool) : line(s.tool)));
      root.hidden = false;
    }
  }
}
