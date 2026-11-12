/**
 * Rozświetl's "Postępy" card in the lobby, from the app's shared classes (styles.css): the records, the
 * day's picture, the album of the eight pairs (a dark name until transformed, then the bright one with how
 * often and how much gold; a tap makes it the next picture), which pictures play (built-in, mine, both),
 * the player's own pairs — an "after" photo and, if they like, a "before" (kit/images.ts keeps them only on
 * this device: the card says so), a name, delete — and the help line (DESIGN §13.3), small but whole.
 * Built with h(); a choice saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import {
  cleanLabel, deleteImage, imagePicker, imagesAvailable, listImages, saveImage, setLabel, thumbUrl, type StoredImage,
} from '../kit/images';
import { dayKey, daySeed } from '../kit/progress';
import { PAIR_IDS, pairFrom, pairTitle, pairTo, type PairId } from './content';
import { pct, t } from './i18n';
import { addOwn, albumCount, bestOf, dayPair, isPair, removeOwn, tilesFor, type OwnPair, type RozProgress, type Source } from './meta';
import { paintScene } from './scenes';

const GAME = 'rozswietl';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(label: string, on: boolean, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = h('button', { class: on ? `${cls} primary` : cls, type: 'button', 'aria-pressed': on ? 'true' : 'false' }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A pair's little picture for the album: the bright place once transformed, else the dark one. */
function thumb(id: PairId, bright: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) paintScene(ctx, c.width, c.height, id, bright);
  return c;
}

/** Today's key and seed, as the runner forms them: the same day's picture as in play. */
function today(): { day: string; seed: number } {
  const day = dayKey();
  return { day, seed: daySeed(GAME, day) };
}

export function progressPanel(p: RozProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const state = { busy: false, error: '', images: new Map<string, StoredImage>() };
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, state, changed, refresh)) root.appendChild(el);
  };
  const changed = (): void => {
    save();
    render();
  };
  const refresh = (): void => {
    if (!imagesAvailable()) return;
    listImages(GAME).then(list => {
      state.images = new Map(list.map(r => [r.id, r]));
      render();
    }).catch(() => undefined);
  };
  render();
  refresh();
  return root;
}

interface PanelState { busy: boolean; error: string; images: Map<string, StoredImage> }

function build(p: RozProgress, st: PanelState, changed: () => void, refresh: () => void): HTMLElement[] {
  const best = bestOf(p);
  const { day, seed } = today();
  const dp = dayPair(seed);
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.pictures'), fmtNum(p.pictures)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.chain'), p.bestChain >= 2 ? `×${p.bestChain}` : '—'),
      stat(t('panel.tiles'), fmtNum(tilesFor(p.sessions, 0)))),
    h('p', { class: 'muted' }, p.dayDone === day ? t('panel.dayDone', { title: pairTitle(dp) }) : t('panel.day', { title: pairTitle(dp) })),
  ];
  // the album: tap a picture to make it the next one
  const album = h('div', { class: 'arcade-album' }, PAIR_IDS.map(id => {
    const e = p.album[id];
    const done = !!e && e.n > 0;
    const picked = p.pick === id;
    const sub = done ? `${t('panel.times', { n: e.n })}${e.gold > 0 ? ` · ${t('panel.gold', { pct: pct(e.gold) })}` : ''}` : t('panel.never');
    const cell = h('div', {
      class: [done ? 'on' : '', picked ? 'legend' : ''].filter(Boolean).join(' ') || null,
      role: 'button', tabindex: '0', 'aria-pressed': picked ? 'true' : 'false', title: pairTitle(id),
    }, thumb(id, done), done ? pairTo(id) : pairFrom(id), h('small', null, sub));
    const pick = () => {
      p.pick = picked ? null : id;
      changed();
    };
    cell.addEventListener('click', pick);
    cell.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        pick();
      }
    });
    return cell;
  }));
  const pickTitle = p.pick ? (isPair(p.pick) ? pairTitle(p.pick) : p.own.find(o => o.id === p.pick)?.label ?? '') : '';
  out.push(
    h('div', { class: 'arcade-sub' }, t('panel.albumOf', { n: albumCount(p) })), album,
    h('p', { class: 'muted' }, pickTitle ? t('panel.nextIs', { title: pickTitle }) : t('panel.choose')),
  );
  // which pictures play
  const src = (s: Source, key: 'panel.src.builtin' | 'panel.src.own' | 'panel.src.both') => button(t(key), p.source === s, () => {
    p.source = s;
    changed();
  });
  const sources = h('div', { class: 'arcade-chips' }, src('builtin', 'panel.src.builtin'), src('own', 'panel.src.own'), src('both', 'panel.src.both'));
  out.push(h('div', { class: 'arcade-sub' }, t('panel.source')), sources);
  // own pictures
  out.push(h('div', { class: 'arcade-sub' }, t('panel.own')));
  if (!imagesAvailable()) {
    out.push(h('p', { class: 'img-note' }, t('panel.noStore')));
  } else {
    out.push(h('p', { class: 'muted' }, t('panel.ownIntro')));
    for (const o of p.own) out.push(ownRow(p, o, st, changed, refresh));
    const add = imagePicker(st.busy ? t('panel.saving') : t('panel.addAfter'), file => {
      if (st.busy) return;
      st.busy = true;
      st.error = '';
      changed();
      const n = p.own.length + 1;
      const label = t('panel.ownName', { n });
      saveImage(GAME, 'after', file, label).then(rec => {
        addOwn(p, { id: `own-${rec.id}`, after: rec.id, before: null, label: rec.label || label, added: rec.added });
        st.images.set(rec.id, rec);
      }).catch(() => {
        st.error = t('panel.error');
      }).finally(() => {
        st.busy = false;
        changed();
      });
    });
    out.push(h('div', { class: 'arcade-chips' }, add));
    if (st.error) out.push(h('p', { class: 'img-note', role: 'alert' }, st.error));
    out.push(h('p', { class: 'img-note' }, t('panel.ownNote')));
  }
  // the help line: small but readable, always there
  out.push(h('p', { class: 'img-note' }, t('panel.help')));
  return out.filter((x): x is HTMLElement => !!x);
}

/** One own pair: its two pictures (or the veil's words), its name, a "before" to add or remove, delete. */
function ownRow(p: RozProgress, o: OwnPair, st: PanelState, changed: () => void, refresh: () => void): HTMLElement {
  const img = (id: string | null, alt: string): HTMLElement => {
    const rec = id ? st.images.get(id) : undefined;
    const box = h('div', { class: 'img-thumb' });
    if (rec) box.append(h('img', { src: thumbUrl(rec), alt }));
    else box.append(h('div', { class: 'muted' }, id ? '…' : t('panel.veiled')));
    return box;
  };
  const thumbs = h('div', { class: 'img-thumbs' }, img(o.after, `${o.label} · ${t('panel.after')}`), img(o.before, `${o.label} · ${t('panel.before')}`));
  thumbs.style.width = '168px';
  thumbs.style.flex = '0 0 auto';
  const name = h('input', { type: 'text', value: o.label, maxlength: '40', 'aria-label': t('panel.label'), placeholder: t('panel.labelHint') });
  name.addEventListener('change', () => {
    const label = cleanLabel(name.value) || o.label;
    o.label = label;
    void setLabel(o.after, label).catch(() => undefined);
    if (o.before) void setLabel(o.before, label).catch(() => undefined);
    changed();
  });
  const controls = h('div', { class: 'arcade-chips' });
  if (o.before) {
    controls.append(button(t('panel.deleteBefore'), false, () => {
      const id = o.before!;
      o.before = null;
      void deleteImage(id).catch(() => undefined);
      changed();
    }));
  } else {
    controls.append(imagePicker(t('panel.addBefore'), file => {
      saveImage(GAME, 'before', file, o.label).then(rec => {
        o.before = rec.id;
        st.images.set(rec.id, rec);
      }).catch(() => {
        st.error = t('panel.error');
      }).finally(() => changed());
    }));
  }
  controls.append(button(t('panel.delete'), false, () => {
    const gone = removeOwn(p, o.id);
    if (gone) {
      void deleteImage(gone.after).catch(() => undefined);
      if (gone.before) void deleteImage(gone.before).catch(() => undefined);
    }
    changed();
    refresh();
  }));
  const right = h('div', null, name, controls);
  right.style.display = 'flex';
  right.style.flexDirection = 'column';
  right.style.gap = '8px';
  right.style.minWidth = '0';
  right.style.flex = '1 1 auto';
  const e = p.album[o.id];
  const sub = e ? `${t('panel.times', { n: e.n })}${e.gold > 0 ? ` · ${t('panel.gold', { pct: pct(e.gold) })}` : ''}` : t('panel.never');
  right.append(h('p', { class: 'muted' }, sub));
  return h('div', { class: 'arcade-daily' }, thumbs, right);
}
