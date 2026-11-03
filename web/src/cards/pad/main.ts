/**
 * pad.html — the pad on its own page (src/cards/DESIGN.md §5.3): the second window of a laptop, or a
 * phone or tablet on the same Wi-Fi.  It loads nothing of the app but the pad: no Bluetooth, no
 * database, no service worker of its own, so it also runs where those are unavailable (a page the
 * desktop server serves over plain http on the local network is not a secure context).
 *
 * The room and the link come in the URL's fragment (#r=K7QM&v=relay); opened without one, the page
 * asks for the room code the board shows.
 */
import '../cards.css';
import { lang } from '../../i18n';
import { ChannelLink, newPeerId, parsePadHash, RelayLink, isRoom, type DuoLink } from '../duo/link';
import { t } from '../i18n';
import { PadView } from './view';

document.documentElement.lang = lang;
document.title = t('pad.docTitle');
document.body.classList.add('k-pad-page', 'k-theme');
const root = document.getElementById('pad')!;
root.className = 'k-pad-root';

/** This pad's id survives a reload, so the relay replaces its old connection instead of counting a second pad. */
function padId(): string {
  try {
    const saved = sessionStorage.getItem('brainlink.padId');
    if (saved) return saved;
    const id = newPeerId();
    sessionStorage.setItem('brainlink.padId', id);
    return id;
  } catch {
    return newPeerId();
  }
}

/** Keep the screen on while playing, where the browser allows it (secure contexts only). */
async function stayAwake(): Promise<void> {
  try { await navigator.wakeLock?.request('screen'); } catch { /* not allowed here: the screen may dim */ }
}

function start(room: string, via: 'channel' | 'relay'): void {
  const id = padId();
  const link: DuoLink = via === 'channel' ? new ChannelLink(room, 'pad', id) : new RelayLink(RelayLink.urlFor(room, 'pad', id), 'pad');
  const bar = document.createElement('div');
  bar.className = 'k-pad-bar';
  if (document.documentElement.requestFullscreen) {
    const full = document.createElement('button');
    full.type = 'button';
    full.className = 'k-btn-ui';
    full.textContent = t('pad.full');
    full.addEventListener('click', () => { void document.documentElement.requestFullscreen().catch(() => undefined); void stayAwake(); });
    bar.append(full);
  }
  const host = document.createElement('div');
  host.style.cssText = 'flex:1;min-height:0;display:flex';
  root.replaceChildren(bar, host);
  new PadView({ root: host, link });
  link.addEventListener('state', () => {
    if (link instanceof RelayLink && link.refused) {
      const p = document.createElement('p');
      p.className = 'k-pad-overlay';
      p.textContent = t('pad.refused', { why: link.refused });
      host.append(p);
    }
  });
  void stayAwake();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void stayAwake(); });
}

function joinForm(): void {
  const box = document.createElement('form');
  box.className = 'k-join';
  const h1 = document.createElement('h1');
  h1.textContent = t('pad.join');
  const p = document.createElement('p');
  p.textContent = t('pad.joinText');
  const input = document.createElement('input');
  input.autocomplete = 'off';
  input.maxLength = 8;
  input.setAttribute('aria-label', t('pad.roomLabel'));
  input.placeholder = 'K7QM';
  const go = document.createElement('button');
  go.type = 'submit';
  go.className = 'k-btn-ui primary big';
  go.textContent = t('pad.joinBtn');
  box.append(h1, p, input, go);
  box.addEventListener('submit', e => {
    e.preventDefault();
    const room = input.value.trim().toUpperCase();
    if (!isRoom(room)) { input.focus(); return; }
    // served by the desktop server (it has the relay) → relay; opened from the static app → another window here
    const via = location.pathname.includes('/app/') ? 'relay' : 'channel';
    location.hash = `r=${room}&v=${via}`;
  });
  root.replaceChildren(box);
  input.focus();
}

function route(): void {
  const r = parsePadHash(location.hash);
  if (r) start(r.room, r.via); else joinForm();
}

window.addEventListener('hashchange', () => location.reload());
route();
