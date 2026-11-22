/**
 * Ja jestem…'s "Postępy" card in the lobby (DESIGN §13.8), from the app's shared classes (styles.css):
 *
 *   own picture     first on the card (round 11: the founder did not find it): "Dodaj własny obraz" — the kit's
 *                   picker for every popular format, a drop zone for a file dragged from a folder, a pasted
 *                   picture, a busy line while it is read, a message for each reason it cannot be; after a pick
 *                   the picture is chosen for the next session at once and its sketch is prepared right here
 *   the next vision its window (a declaration's arch, or the photo's prepared sketch in its own shape), its
 *                   affirmation and verse, "Szkic gotowy"; pin it, choose another; for an own picture the
 *                   player's own continuation after "ja" (≤ 100 characters, a live counter, plain text)
 *   its motion      an own picture's "Ruch obrazu" (round 12, kit/living.ts): the motions generated for this photo,
 *                   each playing on it in a small tile (the recommended one marked), and a depth (parallax)
 *                   switch; a choice is kept with the picture at once
 *   own pictures    kept only on this device (kit/images.ts): a tap chooses one, × deletes it
 *   the numbers     declarations received of 18, sessions, the most pieces lit, the window's detail
 *   the form        (Polish) "Mów do mnie: jestem silny / jestem silna", asked once, changeable
 *   the album       the eighteen as little windows — in colour once received (×n), in pencil until then — and
 *                   the own visions received
 *
 * Built with h(); a choice saves the progress and redraws the card.  The player's words are always set as text.
 */
import { lang } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_DEFAULT, breathAt } from '../kit/breath';
import {
  ImageError, deleteImage, imageDrop, imagePicker, imagesAvailable, listImages, saveImage, setLabel, setMotion, thumbUrl, type StoredImage,
} from '../kit/images';
import { reducedMotion } from '../kit/juice';
import { LivingPicture, isMoving, motionFor, type Motion, type MotionKind } from '../kit/living';
import { coarsePointer } from '../kit/mobile';
import { makeMosaic } from '../kit/mosaic';
import { passage } from '../kit/scripture';
import { mulberry32 } from '../../core/random';
import {
  CONT_MAX, DECLS, DECL_ORDER, cleanCont, contDefault, declWord, formSample, label, legacyCont, ownLabel, ownSentence, sceneText, sentence,
  type DeclId, type Form,
} from './content';
import { t, piecesText, type Key } from './i18n';
import {
  addOwn, chooseNext, declKey, dropOwn, keyDecl, keyOwn, legacyLabel, markCont, nextNew, nextVision, ownKey, pinVision, received,
  type JestemProgress, type VisionKey,
} from './meta';
import { paintPicture } from './pictures';
import { analysed, forget, prepareSoon, setMotionOf, setWord, type Analysis } from './prep';
import { windowPath } from './paint';
import { RULES } from './rules';
import { buildVision } from './vision';

/** Whether the chooser of declarations is open (kept across redraws of the card). */
let chooserOpen = false;
/** The status line of the own picture (kept across the redraws of the next half minute after a pick or a failure). */
let ownStatus: { text: string; error: boolean; until?: number } | null = null;
/** The continuation field should take the cursor after the next redraw (a picture was just added). */
let focusCont = false;
/** The drop zone's and the paste's listeners of the card drawn last (removed before the next draw). */
let dropOff: (() => void) | null = null;
/** A picture is being read: further files wait. */
let busy = false;

const dpr = (): number => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** A canvas of css size w × h at the device's pixel ratio, its context scaled to css px. */
function thumbCanvas(cssW: number, cssH: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const k = dpr();
  const c = h('canvas', { width: String(Math.round(cssW * k)), height: String(Math.round(cssH * k)), 'aria-hidden': 'true' });
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const ctx = c.getContext('2d');
  ctx?.setTransform(k, 0, 0, k, 0, 0);
  return { c, ctx };
}

/** A little arched window with a declaration's picture: in colour, or as a pencil sketch (not yet received). */
function windowThumb(id: DeclId, cssW: number, cssH: number, colour: boolean): HTMLCanvasElement {
  const { c, ctx } = thumbCanvas(cssW, cssH);
  if (!ctx) return c;
  const k = dpr();
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

/**
 * An own picture's prepared sketch, as the game will begin it: the pencil sketch in the photo's own shape, the
 * mosaic's thin grout over it, a gilded fillet — the player sees the picture is ready.
 */
export function sketchThumb(a: Pick<Analysis, 'sketch' | 'w' | 'h' | 'heart' | 'shape'>, cssW: number, cssH: number): HTMLCanvasElement {
  const { c, ctx } = thumbCanvas(cssW, cssH);
  if (!ctx) return c;
  const asp = a.w / a.h;
  let ww = cssW - 4, hh = ww / asp;
  if (hh > cssH - 4) { hh = cssH - 4; ww = hh * asp; }
  const r = { x: (cssW - ww) / 2, y: (cssH - hh) / 2, w: ww, h: hh };
  ctx.fillStyle = '#1d1619';
  ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  ctx.drawImage(a.sketch, r.x, r.y, r.w, r.h);
  try {
    const m = makeMosaic(a.w, a.h, 40, mulberry32(7), { relax: 1 });
    const geo = buildVision(m, { shape: a.shape, heart: a.heart });
    const s = r.w / a.w;
    ctx.strokeStyle = 'rgba(52,42,40,0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const e of geo.edges) {
      if (e.b < 0) continue;
      ctx.moveTo(r.x + e.p.x * s, r.y + e.p.y * s);
      ctx.lineTo(r.x + e.q.x * s, r.y + e.q.y * s);
    }
    ctx.stroke();
  } catch { /* the sketch alone */ }
  ctx.strokeStyle = 'rgba(246,212,136,0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
  return c;
}

/** The chooser's tile for an own picture: a frame with a plus. */
function plusThumb(cssW: number, cssH: number): HTMLCanvasElement {
  const { c, ctx } = thumbCanvas(cssW, cssH);
  if (!ctx) return c;
  ctx.strokeStyle = 'rgba(246,212,136,0.85)';
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(4.5, 2.5, cssW - 9, cssH - 5);
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - 7, cssH / 2);
  ctx.lineTo(cssW / 2 + 7, cssH / 2);
  ctx.moveTo(cssW / 2, cssH / 2 - 7);
  ctx.lineTo(cssW / 2, cssH / 2 + 7);
  ctx.stroke();
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
    dropOff?.();
    dropOff = null;
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

/** What a failed pick says, in the game's words (kit/images `ImageError.reason`). */
export function ownErrorText(e: unknown): string {
  const reason = e instanceof ImageError ? e.reason : 'other';
  return t(`panel.err.${reason}` as Key);
}

/**
 * A picture the player picked, dropped or pasted: read and kept (busy line), chosen for the next session at once,
 * its sketch prepared; a failure says why.
 */
export function addOwnPicture(
  p: JestemProgress, file: File, changed: () => void, status: (s: { text: string; error: boolean }) => void, save: typeof saveImage = saveImage,
): Promise<void> {
  if (busy) return Promise.resolve();
  busy = true;
  status({ text: t('panel.ownBusy'), error: false });
  return save('jestem', 'vision', file, '').then(rec => {
    addOwn(p, rec.id);
    chooseNext(p, ownKey(rec.id));
    ownStatus = { text: t('panel.ownChosen'), error: false, until: Date.now() + 30_000 };
    focusCont = true;
  }, (e: unknown) => {
    ownStatus = { text: ownErrorText(e), error: true, until: Date.now() + 60_000 };
  }).finally(() => {
    busy = false;
    changed();
  });
}

function build(p: JestemProgress, changed: () => void): HTMLElement[] {
  const out: (HTMLElement | null)[] = [];
  const next = nextVision(p);
  const nd = keyDecl(next), nown = keyOwn(next);
  const touch = coarsePointer();

  // ── the own picture: first on the card, impossible to miss ──
  let pickerInput: HTMLInputElement | null = null;
  if (!imagesAvailable()) {
    out.push(h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, t('panel.ownAdd')), h('p', null, t('panel.ownNoStore')))));
  } else {
    const statusEl = h('p', { class: 'img-note', role: 'status', 'aria-live': 'polite', hidden: !ownStatus });
    const setStatus = (s: { text: string; error: boolean } | null) => {
      ownStatus = s;
      statusEl.hidden = !s;
      statusEl.textContent = s?.text ?? '';
      statusEl.setAttribute('data-error', String(!!s?.error));
    };
    setStatus(ownStatus && (ownStatus.until ?? Infinity) > Date.now() ? ownStatus : null);
    const onFile = (f: File) => { void addOwnPicture(p, f, changed, setStatus); };
    const picker = imagePicker(t('panel.ownAdd'), onFile);
    picker.className = 'btn primary img-pick';
    pickerInput = picker.querySelector('input');
    const block = h('div', { class: 'arcade-daily', 'data-own': 'add' },
      plusThumb(56, 68),
      h('div', null,
        h('b', null, t('panel.own')),
        h('p', null, t('panel.ownLead')),
        h('div', { class: 'row' }, picker),
        h('p', { class: 'img-note' }, t(touch ? 'panel.ownFormatsTouch' : 'panel.ownFormats')),
        statusEl));
    dropOff = imageDrop(block, onFile);
    out.push(block);
  }

  // ── the next vision ──
  const status = h('p', { class: 'img-note' }, t('panel.preparing'));
  const pinned = p.pin === next;
  out.push(h('div', { class: 'arcade-sub' }, `${t('panel.next')}${pinned ? ` · ${t('panel.pinned')}` : ''}`));
  const pin = button(pinned ? t('panel.unpin') : t('panel.pin'), () => { pinVision(p, pinned ? null : next); changed(); });
  pin.style.marginLeft = 'auto';
  if (nd) {
    const d = DECLS[nd];
    status.textContent = analysed(next) ? t('intro.ready') : t('panel.preparing');
    prepareSoon(next, () => { status.textContent = analysed(next) ? t('intro.ready') : t('panel.preparing'); });
    out.push(h('div', { class: 'arcade-daily' }, windowThumb(nd, 64, 76, true),
      h('div', null, h('b', null, sentence(wordOf(p, nd))), h('p', null, `${sceneText(nd)} · ${passage(d.verse).ref}`), status), pin));
  } else if (nown) {
    // the photo while its sketch is prepared, then the sketch itself (the picture is ready to play)
    const thumbBox = h('div');
    const img = h('img', { alt: '' });
    img.style.width = '64px';
    img.style.height = '76px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    thumbBox.append(img);
    const title = h('b', null, ownSentence(''));
    const legacy = legacyLabel(p, nown);
    const motionBox = h('div', { class: 'living-box', 'data-own': 'motion' });
    const showReady = () => {
      const a = analysed(next);
      status.textContent = a ? t('intro.ready') : t('panel.preparing');
      // the sketch at the photo's own shape: a wide photo takes a wider thumbnail
      if (a) thumbBox.replaceChildren(sketchThumb(a, Math.round(Math.min(112, Math.max(48, 76 * (a.w / a.h)))), 76));
      // and the motions generated for it, once it is analysed
      if (a?.living && !motionBox.firstChild) fillMotion(next, nown, a, motionBox);
    };
    showReady();
    prepareSoon(next, () => showReady(), legacy);
    out.push(h('div', { class: 'arcade-daily', 'data-own': 'next' }, thumbBox,
      h('div', null, title, h('p', null, `${t('panel.own')} · ${passage('php4.13').ref}`), status), pin));
    const editor = h('div');
    out.push(editor);
    out.push(motionBox);
    void listImages('jestem', 'vision').then(list => {
      const rec = list.find(r => r.id === nown);
      if (!rec) return;
      if (!analysed(next)) img.src = thumbUrl(rec);
      img.alt = t('own');
      const cont = legacy ? legacyCont(rec.label) : cleanCont(rec.label);
      // the player's own words, as text
      title.textContent = ownSentence(cont);
      fillEditor(p, rec, cont, editor, title, changed);
    }).catch(() => undefined);
  }
  const row = h('div', { class: 'row' });
  row.append(button(chooserOpen ? t('panel.hide') : t('panel.choose'), () => { chooserOpen = !chooserOpen; changed(); }));
  if (p.next || p.pin) row.append(button(t('panel.auto'), () => { p.next = null; p.pin = null; changed(); }, 'btn ghost'));
  out.push(row);
  if (chooserOpen) {
    const tile = (cls: string | null, kids: (HTMLElement | string)[], title: string, act: () => void): HTMLElement => {
      const el = h('div', { class: cls, role: 'button', tabindex: '0', title }, ...kids);
      el.addEventListener('click', act);
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
      return el;
    };
    const tiles: HTMLElement[] = [];
    // the own picture, wherever a vision is chosen
    if (pickerInput) {
      const input = pickerInput;
      tiles.push(tile('on', [plusThumb(52, 40), t('panel.ownPick'), h('small', null, 'JPG · PNG · HEIC')], t('panel.ownAdd'), () => input.click()));
    }
    for (const id of DECL_ORDER) {
      const e = p.album[id];
      tiles.push(tile(next === declKey(id) ? 'on legend' : e?.n ? 'on' : null,
        [windowThumb(id, 52, 40, !!e?.n), label(wordOf(p, id)), h('small', null, e?.n ? t('panel.times', { n: e.n }) : t('panel.sketch'))],
        sceneText(id), () => { chooseNext(p, declKey(id)); chooserOpen = false; changed(); }));
    }
    out.push(h('div', { class: 'arcade-album' }, tiles));
  }

  // ── the player's own pictures ──
  if (imagesAvailable() && p.own.length) {
    const grid = h('div', { class: 'img-thumbs' });
    out.push(h('div', { class: 'arcade-sub' }, t('panel.ownMine')), grid);
    void listImages('jestem', 'vision').then(list => fillOwn(p, list, grid, changed)).catch(() => undefined);
  }

  // ── the numbers and the form ──
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.received'), `${received(p)}/18`),
    stat(t('panel.sessions'), String(p.sessions)),
    stat(t('panel.best'), p.sessions > 0 ? String(p.best) : '—'),
    stat(t('panel.detail'), p.cells > 0 ? piecesText(p.cells) : '—')));
  out.push(h('p', { class: 'muted' }, t('panel.rule')));
  if (lang === 'pl') {
    const id = formSample(nd ?? nextNew(p));
    const pick = (f: Form) => button(label(declWord(id, f)), () => { p.form = f; changed(); }, 'btn', { role: 'radio', 'aria-checked': String(p.form === f) });
    out.push(h('div', { class: 'arcade-sub' }, t('panel.form')),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.form') }, pick('m'), pick('f')),
      p.form === null ? h('p', { class: 'img-note' }, t('panel.formNote')) : null);
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
  // the player's own visions received, after the eighteen: their picture and their affirmation (as text)
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
        img.style.borderRadius = '3px';
        const cont = o.cont ? cleanCont(rec.label) : legacyCont(rec.label);
        album.append(h('div', { class: 'on', title: `${t('own')} · ${passage('php4.13').ref}` }, img, ownLabel(cont),
          h('small', null, `${t('panel.times', { n: o.n })} · ${o.best}`)));
      }
    }).catch(() => undefined);
  }
  return out.filter((x): x is HTMLElement => !!x);
}

/**
 * The own picture's continuation after "ja": the prefix in front of the field, plain text up to 100 characters with
 * a live counter, the default ("wszystko mogę", Philippians 4:13) when left empty; saved on the device with the picture.
 */
/**
 * "Ruch obrazu" (round 12): the motions generated for this photo (kit/living `analyseLiving` ranks them), each
 * playing on the photo itself in a small tile — the recommended one marked — and the depth (parallax) switch.
 * A choice is kept with the picture at once (kit/images `setMotion`) and the prepared vision plays it.  On a
 * device that asks for less motion the tiles stand still and a line says the game keeps the picture still.
 */
function fillMotion(key: VisionKey, ownId: string, a: Analysis, box: HTMLElement): void {
  const living = a.living;
  if (!living) return;
  const reduced = reducedMotion();
  const touch = coarsePointer();
  let cur: Motion = motionFor(a.motion, living, false);
  const th = 84, tw = Math.round(Math.min(132, Math.max(48, th * (a.w / a.h))));
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const nameOf = (k: MotionKind): string => (k === 'still' ? t(cur.parallax ? 'living.depthOnly' : 'living.still') : t(`living.${k}` as Key));
  interface Tile { kind: MotionKind; btn: HTMLButtonElement; c: HTMLCanvasElement; name: HTMLElement; lp: LivingPicture | null }
  const build1 = (kind: MotionKind): LivingPicture | null => {
    const m: Motion = { kind, parallax: cur.parallax };
    return isMoving(m) ? new LivingPicture(a.picture, tw * dpr, th * dpr, living, m, { maxPixels: 140_000 }) : null;
  };
  const hint = h('p', { class: 'img-note', 'aria-live': 'polite' });
  const saved = h('span', { class: 'img-note living-saved', 'aria-live': 'polite' });
  let savedTimer = 0;
  const refresh = () => {
    for (const tile of tiles) {
      tile.btn.setAttribute('aria-checked', String(tile.kind === cur.kind));
      tile.name.textContent = nameOf(tile.kind);
    }
    hint.textContent = `${t(`living.hint.${cur.kind}` as Key)}${cur.parallax ? ` ${t(touch ? 'living.parallaxHintTouch' : 'living.parallaxHint')}` : ''}`;
  };
  const keep = () => {
    setMotionOf(key, cur);
    void setMotion(ownId, cur).then(() => {
      saved.textContent = t('living.saved');
      clearTimeout(savedTimer);
      savedTimer = window.setTimeout(() => { saved.textContent = ''; }, 1800);
    }).catch(() => undefined);
  };
  const tiles: Tile[] = living.options.map(kind => {
    const c = h('canvas', { 'aria-hidden': 'true' });
    c.width = Math.round(tw * dpr);
    c.height = Math.round(th * dpr);
    c.style.width = `${tw}px`;
    c.style.height = `${th}px`;
    const name = h('span', null, nameOf(kind));
    const kids: HTMLElement[] = [c, name];
    if (kind === living.recommended) kids.push(h('small', { class: 'living-rec' }, t('living.recommended')));
    const btn = h('button', { class: 'living-opt', type: 'button', role: 'radio', 'aria-checked': String(kind === cur.kind) }, ...kids);
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (cur.kind === kind) return;
      cur = { ...cur, kind };
      refresh();
      keep();
      if (reduced) paint(2);
    });
    return { kind, btn, c, name, lp: build1(kind) };
  });
  const depth = h('input', { type: 'checkbox' });
  depth.checked = cur.parallax;
  depth.addEventListener('change', () => {
    cur = { ...cur, parallax: depth.checked };
    for (const tile of tiles) tile.lp = build1(tile.kind);
    refresh();
    keep();
    if (reduced) paint(2);
  });
  const paint = (tt: number) => {
    const breath = breathAt(BREATH_DEFAULT, tt).k;
    for (const tile of tiles) {
      const ctx = tile.c.getContext('2d');
      if (!ctx) continue;
      const src = tile.lp ? tile.lp.frame(tt, { breath, strength: 1 }) : a.picture;
      ctx.drawImage(src, 0, 0, tile.c.width, tile.c.height);
    }
  };
  box.replaceChildren(
    h('div', { class: 'arcade-sub' }, t('living.title')),
    h('p', { class: 'img-note' }, t('living.lead')),
    h('div', { class: 'living-pick', role: 'radiogroup', 'aria-label': t('living.title') }, ...tiles.map(x => x.btn)),
    h('div', { class: 'row' }, h('label', { class: 'switch' }, depth, h('span', null, t('living.parallax'))), saved),
    hint,
    h('p', { class: 'img-note' }, t(reduced ? 'living.reduced' : 'living.where')),
  );
  refresh();
  // the tiles play while the card is on the page (one loop; it ends when the card is redrawn or left)
  const t0 = performance.now();
  let seen = false, waits = 0;
  const loop = () => {
    if (!box.isConnected) {
      if (seen || ++waits > 300) return;
      requestAnimationFrame(loop);
      return;
    }
    seen = true;
    paint((performance.now() - t0) / 1000);
    if (!reduced) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function fillEditor(p: JestemProgress, rec: StoredImage, cont: string, editor: HTMLElement, title: HTMLElement, changed: () => void): void {
  const key = ownKey(rec.id);
  const input = h('input', {
    type: 'text', maxlength: String(CONT_MAX), placeholder: contDefault(), 'aria-label': `${t('panel.ownCont')}: ${t('panel.ownPrefix')} …`,
    autocomplete: 'off', enterkeyhint: 'done',
  });
  input.value = cont;
  input.style.flex = '1 1 14em';
  input.style.minWidth = '0';
  const count = h('span', { class: 'img-note', 'aria-live': 'off' });
  const saved = h('span', { class: 'img-note', role: 'status' });
  const counted = () => {
    const n = [...input.value].length;
    count.textContent = `${Math.min(n, CONT_MAX)} / ${CONT_MAX}`;
    title.textContent = ownSentence(input.value);
    saved.textContent = '';
  };
  counted();
  input.addEventListener('input', counted);
  const save = () => {
    const c = cleanCont(input.value);
    input.value = c;
    counted();
    return setLabel(rec.id, c).then(() => {
      markCont(p, rec.id);
      setWord(key, c);
      saved.textContent = t('panel.ownSaved');
    });
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); void save().then(changed); }
  });
  editor.replaceChildren(
    h('div', { class: 'arcade-sub' }, t('panel.ownCont')),
    h('div', { class: 'row' }, h('span', null, t('panel.ownPrefix')), input),
    h('p', { class: 'img-note' }, count, ' · ', t('panel.ownHint')),
    h('div', { class: 'row' }, button(t('panel.ownSave'), () => { void save().then(changed); }, 'btn primary'), saved),
    h('p', { class: 'img-note' }, t('panel.ownNote')),
  );
  if (focusCont) {
    focusCont = false;
    setTimeout(() => { try { input.focus({ preventScroll: true }); } catch { /* an old engine */ } }, 0);
  }
}

/** The player's own pictures: thumbnails (a tap chooses one for the next session), a delete on each. */
function fillOwn(p: JestemProgress, list: StoredImage[], grid: HTMLElement, changed: () => void): void {
  const known = new Set(p.own.map(o => o.id));
  // a picture kept on the device but missing from the progress (another profile's save) joins it
  let moved = false;
  for (const r of list) if (!known.has(r.id)) { addOwn(p, r.id); moved = true; }
  const ids = new Set(list.map(r => r.id));
  for (const o of [...p.own]) if (!ids.has(o.id)) { dropOwn(p, o.id); moved = true; }
  // a save before round 11 kept a single word: it becomes a continuation ("zdrowa" → "jestem zdrowa"), once
  const old = p.own.filter(o => !o.cont);
  if (old.length) {
    void Promise.all(old.map(o => {
      const rec = list.find(r => r.id === o.id);
      const cont = rec ? legacyCont(rec.label) : '';
      const done = () => { markCont(p, o.id); setWord(ownKey(o.id), cont); };
      return rec && rec.label ? setLabel(o.id, cont).then(done) : Promise.resolve(done());
    })).then(changed, () => undefined);
    return;
  }
  if (moved) { changed(); return; }
  const next = nextVision(p);
  grid.replaceChildren(...list.map(rec => {
    const key = ownKey(rec.id);
    const del = button('×', () => {
      void deleteImage(rec.id).then(() => {
        dropOwn(p, rec.id);
        forget(key);
        changed();
      });
    }, 'btn', { 'aria-label': t('panel.ownDelete'), title: t('panel.ownDelete') });
    const img = h('img', { src: thumbUrl(rec), alt: ownLabel(cleanCont(rec.label)) });
    const cell = h('div', { class: next === key ? 'img-thumb on' : 'img-thumb', role: 'button', tabindex: '0', 'aria-label': ownLabel(cleanCont(rec.label)) }, img, del);
    const choose = (e: Event) => {
      if ((e.target as Element).closest('button')) return;
      chooseNext(p, key);
      focusCont = true;
      changed();
    };
    cell.addEventListener('click', choose);
    cell.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(ev); } });
    return cell;
  }));
}
