/**
 * Ja jestem…'s "Postępy" card in the lobby (DESIGN §13.8), from the app's shared classes (styles.css):
 *
 *   the numbers     declarations received of 18, sessions, the most pieces lit, the window's detail
 *   the form        (Polish) "Mów do mnie: jestem silny / jestem silna", asked once, changeable
 *   the next vision its little window, its sentence and verse, and the sketch being prepared right here
 *                   (the founder: the picture is processed before the game); pin it, or choose another
 *   own visions     a picture of the player's dream and their own word (≤ 24 characters), kept only on
 *                   this device (kit/images.ts); the word is set as text, never as markup
 *   the album       the eighteen as little windows — in colour once received (×n), in pencil until then
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { lang } from '../../i18n';
import { h } from '../../ui/dom';
import { deleteImage, imagePicker, imagesAvailable, listImages, saveImage, setLabel, thumbUrl, type StoredImage } from '../kit/images';
import { passage } from '../kit/scripture';
import { DECLS, DECL_ORDER, WORD_MAX, cleanWord, declWord, formSample, label, sceneText, sentence, type DeclId, type Form } from './content';
import { t, piecesText } from './i18n';
import {
  addOwn, chooseNext, declKey, dropOwn, keyDecl, keyOwn, nextNew, nextVision, ownKey, pinVision, received, type JestemProgress,
} from './meta';
import { paintPicture } from './pictures';
import { forget, prepareSoon, analysed } from './prep';
import { windowPath } from './paint';
import { RULES } from './rules';

/** Whether the chooser of declarations is open (kept across redraws of the card). */
let chooserOpen = false;
/** The own picture whose word is being edited. */
let editing: string | null = null;

const dpr = (): number => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** A little arched window with a declaration's picture: in colour, or as a pencil sketch (not yet received). */
function windowThumb(id: DeclId, cssW: number, cssH: number, colour: boolean): HTMLCanvasElement {
  const k = dpr();
  const c = h('canvas', { width: String(Math.round(cssW * k)), height: String(Math.round(cssH * k)), 'aria-hidden': 'true' });
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const wh = cssH - 2, ww = wh * (RULES.PW / RULES.PH);
  const r = { x: (cssW - ww) / 2, y: 1, w: ww, h: wh };
  const pic = document.createElement('canvas');
  pic.width = Math.round(ww * k);
  pic.height = Math.round(wh * k);
  const pc = pic.getContext('2d', { willReadFrequently: !colour });
  if (pc) {
    paintPicture(id, pc, pic.width, pic.height);
    if (!colour) {
      // a pencil sketch's look: grey, light, warm paper
      const d = pc.getImageData(0, 0, pic.width, pic.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
        const v = 150 + l * 0.42;
        d.data[i] = v + 18; d.data[i + 1] = v + 10; d.data[i + 2] = v - 4;
      }
      pc.putImageData(d, 0, 0);
    }
  }
  ctx.fillStyle = '#2b2226';
  ctx.fill(windowPath(r, 1.5));
  ctx.save();
  ctx.clip(windowPath(r));
  ctx.drawImage(pic, r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.strokeStyle = colour ? 'rgba(246,212,136,0.8)' : 'rgba(120,104,96,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke(windowPath(r, 1.5));
  return c;
}

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

export function progressPanel(p: JestemProgress, save: () => void): HTMLElement {
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

/** The word of a declaration in the player's form (Polish), for the card's labels. */
const wordOf = (p: JestemProgress, id: DeclId): string => declWord(id, p.form);

function build(p: JestemProgress, changed: () => void): HTMLElement[] {
  const out: (HTMLElement | null)[] = [];
  const next = nextVision(p);
  const nd = keyDecl(next), nown = keyOwn(next);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.received'), `${received(p)}/18`),
    stat(t('panel.sessions'), String(p.sessions)),
    stat(t('panel.best'), p.sessions > 0 ? String(p.best) : '—'),
    stat(t('panel.detail'), p.cells > 0 ? piecesText(p.cells) : '—')));
  out.push(h('p', { class: 'muted' }, t('panel.rule')));

  // ── the form (Polish only) ──
  if (lang === 'pl') {
    const id = formSample(nd ?? nextNew(p));
    const pick = (f: Form) => button(label(declWord(id, f)), () => { p.form = f; changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.form === f) });
    out.push(h('div', { class: 'arcade-sub' }, t('panel.form')),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.form') }, pick('m'), pick('f')),
      p.form === null ? h('p', { class: 'img-note' }, t('panel.formNote')) : null);
  }

  // ── the next vision ──
  const status = h('p', { class: 'img-note' }, t('panel.preparing'));
  const setStatus = () => {
    const a = analysed(next);
    status.textContent = a ? t('intro.ready') : t('panel.preparing');
  };
  setStatus();
  prepareSoon(next, () => setStatus());
  const pinned = p.pin === next;
  out.push(h('div', { class: 'arcade-sub' }, `${t('panel.next')}${pinned ? ` · ${t('panel.pinned')}` : ''}`));
  if (nd) {
    const d = DECLS[nd];
    const thumb = windowThumb(nd, 64, 76, true);
    const pin = button(pinned ? t('panel.unpin') : t('panel.pin'), () => { pinVision(p, pinned ? null : next); changed(); });
    pin.style.marginLeft = 'auto';
    out.push(h('div', { class: 'arcade-daily' }, thumb,
      h('div', null, h('b', null, sentence(wordOf(p, nd))), h('p', null, `${sceneText(nd)} · ${passage(d.verse).ref}`), status), pin));
  } else if (nown) {
    const img = h('img', { alt: '' });
    img.style.width = '64px';
    img.style.height = '76px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '32px 32px 6px 6px';
    const title = h('b', null, t('own'));
    const pin = button(pinned ? t('panel.unpin') : t('panel.pin'), () => { pinVision(p, pinned ? null : next); changed(); });
    pin.style.marginLeft = 'auto';
    const box = h('div', { class: 'arcade-daily' }, img, h('div', null, title, h('p', null, `${t('panel.own')} · ${passage('php4.13').ref}`), status), pin);
    void listImages('jestem', 'vision').then(list => {
      const rec = list.find(r => r.id === nown);
      if (!rec) return;
      img.src = thumbUrl(rec);
      const word = cleanWord(rec.label);
      // the player's own word, as text
      title.textContent = word ? sentence(word) : t('own');
    }).catch(() => undefined);
    out.push(box);
  }
  const row = h('div', { class: 'row' });
  row.append(button(chooserOpen ? t('panel.hide') : t('panel.choose'), () => { chooserOpen = !chooserOpen; changed(); }));
  if (p.next || p.pin) row.append(button(t('panel.auto'), () => { p.next = null; p.pin = null; changed(); }, 'btn ghost'));
  out.push(row);
  if (chooserOpen) {
    out.push(h('div', { class: 'arcade-album' }, DECL_ORDER.map(id => {
      const e = p.album[id];
      const tile = h('div', { class: next === declKey(id) ? 'on legend' : e?.n ? 'on' : null, role: 'button', tabindex: '0', title: sceneText(id) },
        windowThumb(id, 52, 40, !!e?.n), label(wordOf(p, id)), h('small', null, e?.n ? t('panel.times', { n: e.n }) : t('panel.sketch')));
      const choose = () => { chooseNext(p, declKey(id)); chooserOpen = false; changed(); };
      tile.addEventListener('click', choose);
      tile.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); } });
      return tile;
    })));
  }

  // ── own visions ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.own')));
  if (!imagesAvailable()) {
    out.push(h('p', { class: 'img-note' }, t('panel.ownNoStore')));
  } else {
    const note = h('p', { class: 'img-note' }, t('panel.ownNote'));
    const err = h('p', { class: 'img-note', hidden: true }, t('panel.ownError'));
    const grid = h('div', { class: 'img-thumbs' });
    const editor = h('div');
    out.push(note, imagePicker(t('panel.ownAdd'), file => {
      err.hidden = true;
      void saveImage('jestem', 'vision', file, '').then(rec => {
        addOwn(p, rec.id);
        editing = rec.id;
        changed();
      }).catch(() => { err.hidden = false; });
    }), err, grid, editor);
    void listImages('jestem', 'vision').then(list => fillOwn(p, list, grid, editor, changed)).catch(() => undefined);
  }

  // ── the album ──
  out.push(h('div', { class: 'arcade-sub' }, `${t('panel.album')} · ${received(p)}/18`));
  const album = h('div', { class: 'arcade-album' }, DECL_ORDER.map(id => {
    const e = p.album[id];
    return h('div', { class: e?.n ? (e.rays + e.rings >= 6 ? 'on legend' : 'on') : null, title: `${sceneText(id)} · ${passage(DECLS[id].verse).ref}` },
      windowThumb(id, 52, 40, !!e?.n), label(wordOf(p, id)),
      h('small', null, e?.n ? `${t('panel.times', { n: e.n })} · ${e.best}` : t('panel.sketch')));
  }));
  out.push(album);
  // the player's own visions received, after the eighteen: their picture and their word (as text)
  const ownDone = p.own.filter(o => o.n > 0);
  if (ownDone.length && imagesAvailable()) {
    void listImages('jestem', 'vision').then(list => {
      for (const o of ownDone) {
        const rec = list.find(r => r.id === o.id);
        if (!rec) continue;
        const img = h('img', { src: thumbUrl(rec), alt: '' });
        img.style.width = '52px';
        img.style.height = '40px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '20px 20px 4px 4px';
        const word = cleanWord(rec.label);
        album.append(h('div', { class: 'on', title: `${t('own')} · ${passage('php4.13').ref}` }, img, word ? label(word) : t('own'),
          h('small', null, `${t('panel.times', { n: o.n })} · ${o.best}`)));
      }
    }).catch(() => undefined);
  }
  return out.filter((x): x is HTMLElement => !!x);
}

/** The player's own pictures: thumbnails (a tap chooses one for the next session), and the chosen one's word. */
function fillOwn(p: JestemProgress, list: StoredImage[], grid: HTMLElement, editor: HTMLElement, changed: () => void): void {
  const known = new Set(p.own.map(o => o.id));
  // a picture kept on the device but missing from the progress (another profile's save) joins it
  let added = false;
  for (const r of list) if (!known.has(r.id)) { addOwn(p, r.id); added = true; }
  const ids = new Set(list.map(r => r.id));
  for (const o of [...p.own]) if (!ids.has(o.id)) { dropOwn(p, o.id); added = true; }
  if (added) { changed(); return; }
  if (!list.length) {
    grid.replaceWith(h('p', { class: 'img-note' }, t('panel.ownNone')));
    return;
  }
  const next = nextVision(p);
  grid.replaceChildren(...list.map(rec => {
    const key = ownKey(rec.id);
    const del = button(t('panel.ownDelete'), () => {
      void deleteImage(rec.id).then(() => {
        dropOwn(p, rec.id);
        forget(key);
        if (editing === rec.id) editing = null;
        changed();
      });
    }, 'btn');
    const img = h('img', { src: thumbUrl(rec), alt: cleanWord(rec.label) || t('own') });
    const cell = h('div', { class: next === key || editing === rec.id ? 'img-thumb on' : 'img-thumb', role: 'button', tabindex: '0' }, img, del);
    const open = (e: Event) => {
      if ((e.target as Element).closest('button')) return;
      editing = rec.id;
      changed();
    };
    cell.addEventListener('click', open);
    return cell;
  }));
  const rec = list.find(r => r.id === editing) ?? null;
  if (!rec) return;
  const input = h('input', { type: 'text', maxlength: String(WORD_MAX), placeholder: t('panel.ownPlaceholder'), 'aria-label': t('panel.ownWord') });
  input.value = cleanWord(rec.label);
  const key = ownKey(rec.id);
  const saveWord = () => {
    const word = cleanWord(input.value);
    input.value = word;
    return setLabel(rec.id, word).then(() => forget(key));
  };
  const use = button(t('panel.ownUse'), () => {
    void saveWord().then(() => {
      if (!cleanWord(input.value)) { input.focus(); return; }
      chooseNext(p, key);
      changed();
    });
  }, 'btn primary');
  editor.replaceChildren(
    h('label', { class: 'f' }, t('panel.ownWord'), input),
    h('div', { class: 'row' }, button(t('panel.ownSave'), () => { void saveWord().then(() => changed()); }), use),
  );
}
