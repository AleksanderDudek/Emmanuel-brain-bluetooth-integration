/**
 * The player's own pictures for the visualisation games (DESIGN.md §13.2): a dream for Ja jestem…, a
 * "before" and an "after" for Rozświetl.  They are kept **only on this device** — IndexedDB
 * `brainlink-images`, apart from the sessions' database so its upgrades never wait on pictures —
 * resized to at most 1280 px and stored as JPEG; nothing is ever uploaded.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { h } from '../../ui/dom';
import { cleanMotion, type Motion } from './living';
import type { Pixels } from './mosaic';

export interface StoredImage {
  id: string;
  /** the game that keeps it (`jestem`, `rozswietl`) */
  game: string;
  /** what it is for in that game (`vision`, `before`, `after`; a pair shares a label) */
  role: string;
  /** the player's own name for it (plain text, never markup) */
  label: string;
  w: number;
  h: number;
  /** when it was added (ms since the epoch) */
  added: number;
  blob: Blob;
  /** how it moves in play (kit/living.ts); absent: the motion recommended for it, with depth (round 12) */
  motion?: Motion;
}

interface ImagesDB extends DBSchema {
  images: { key: string; value: StoredImage; indexes: { by_game: string } };
}

export const IMAGE_MAX_SIDE = 1280;
/** A label longer than this is cut (an own affirmation — up to 100 characters since 2026-11-17 — or a name for a pair). */
export const LABEL_MAX = 100;
const DB_NAME = 'brainlink-images';

let dbp: Promise<IDBPDatabase<ImagesDB>> | null = null;

function db(): Promise<IDBPDatabase<ImagesDB>> {
  dbp ??= openDB<ImagesDB>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('images', { keyPath: 'id' }).createIndex('by_game', 'game');
    },
    // a newer version elsewhere wants to upgrade: step aside
    blocking() {
      const p = dbp;
      dbp = null;
      void p?.then(x => x.close());
    },
  });
  return dbp;
}

/** Pictures can be kept here (IndexedDB exists; a private window may still refuse — calls then reject). */
export const imagesAvailable = (): boolean => typeof indexedDB !== 'undefined';

const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** A label as plain, trimmed text of at most LABEL_MAX characters (controls stripped). */
export function cleanLabel(s: string): string {
  return [...s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, LABEL_MAX).join('');
}

/** Keep a prepared picture as it is (no decoding): imports and tests. */
export async function putImage(rec: Omit<StoredImage, 'id' | 'added'> & Partial<Pick<StoredImage, 'id' | 'added'>>): Promise<StoredImage> {
  const full: StoredImage = { ...rec, id: rec.id ?? newId(), added: rec.added ?? Date.now(), label: cleanLabel(rec.label ?? '') };
  await (await db()).put('images', full);
  return full;
}

/** A game's pictures, newest first (only one role if given). */
export async function listImages(game: string, role?: string): Promise<StoredImage[]> {
  const all = await (await db()).getAllFromIndex('images', 'by_game', game);
  return all.filter(r => role === undefined || r.role === role).sort((a, b) => b.added - a.added);
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  return (await db()).get('images', id);
}

export async function deleteImage(id: string): Promise<void> {
  await (await db()).delete('images', id);
  revokeThumb(id);
}

export async function setLabel(id: string, label: string): Promise<void> {
  const d = await db();
  const rec = await d.get('images', id);
  if (rec) await d.put('images', { ...rec, label: cleanLabel(label) });
}

/** Keep how a picture moves (an unknown motion is not kept). */
export async function setMotion(id: string, motion: Motion): Promise<void> {
  const m = cleanMotion(motion);
  if (!m) return;
  const d = await db();
  const rec = await d.get('images', id);
  if (rec) await d.put('images', { ...rec, motion: m });
}

/** The size a picture is drawn at so its longer side is at most `max` (never enlarged). */
export function scaledSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(1, w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** The file types the pickers offer: every image a browser may read, and the popular ones by name (a desktop
 * file dialog filters by extension; a phone offers its gallery and camera). */
export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.avif,.heic,.heif,.tif,.tiff,.svg';

/** Why a picture could not be kept — each game says it in its own words. */
export type ImageFailure = 'notImage' | 'heic' | 'format' | 'tooBig' | 'storage';

/** A picture that could not be read or kept, with the reason (`ImageError.reason`). */
export class ImageError extends Error {
  constructor(readonly reason: ImageFailure, message: string = reason) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Larger files are refused before decoding (a phone's 48 MP photo is ~15 MB; a RAW or a scan can be far more). */
export const IMAGE_MAX_BYTES = 60 * 1024 * 1024;

const HEIC = /\.(heic|heif)$/i;
/** HEIC/HEIF (an iPhone's photo): Safari reads it, Chrome, Firefox and Edge do not. */
export const isHeic = (f: Blob & { name?: string }): boolean => /heic|heif/i.test(f.type) || HEIC.test(f.name ?? '');

const IMG_EXT = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif|tiff?|svg|ico)$/i;
/** Whether a file looks like a picture at all (its type, or its name when a system gives no type). */
export const looksLikeImage = (f: Blob & { name?: string }): boolean => /^image\//i.test(f.type) || (!f.type && IMG_EXT.test(f.name ?? '')) || IMG_EXT.test(f.name ?? '');

/** Decode a picture (EXIF orientation applied where the browser can). */
async function decode(blob: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch { /* an older engine or an odd format (an SVG, a TIFF in Safari): try an <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // an SVG without its own size decodes to 0 × 0: give it a square to draw into
    const w = img.naturalWidth || 1024, hh = img.naturalHeight || 1024;
    return { src: img, w, h: hh, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError(isHeic(blob) ? 'heic' : 'format', 'image decode failed');
  }
}

/** Decode a picture onto a canvas whose longer side is at most `maxSide`, and read its pixels. */
export async function loadPixels(blob: Blob, maxSide: number, flatten = false): Promise<{ pixels: Pixels; canvas: HTMLCanvasElement }> {
  const pic = await decode(blob);
  try {
    const size = scaledSize(pic.w, pic.h, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.imageSmoothingQuality = 'high';
    if (flatten) {
      // a transparent PNG/WebP/GIF/SVG would turn black as a JPEG: lay it on white
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
    }
    ctx.drawImage(pic.src, 0, 0, size.w, size.h);
    const data = ctx.getImageData(0, 0, size.w, size.h);
    return { pixels: { width: data.width, height: data.height, data: data.data }, canvas };
  } finally {
    pic.close();
  }
}

/**
 * Keep a picture the player chose: decoded (any format the browser reads: JPEG, PNG, WebP, GIF's first frame,
 * BMP, AVIF, SVG; HEIC in Safari), turned upright by its EXIF, resized to ≤ `maxSide`, flattened onto white
 * where it was transparent, re-encoded as JPEG, stored on this device.  Rejects with an `ImageError` saying why:
 * not a picture, an iPhone's HEIC outside Safari, a format the browser cannot read, too big, or storage refused.
 */
export async function saveImage(game: string, role: string, file: Blob & { name?: string }, label = '', maxSide = IMAGE_MAX_SIDE): Promise<StoredImage> {
  if (!looksLikeImage(file)) throw new ImageError('notImage');
  if (file.size > IMAGE_MAX_BYTES) throw new ImageError('tooBig');
  const { canvas } = await loadPixels(file, maxSide, true);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new ImageError('format', 'could not encode the picture'))), 'image/jpeg', 0.9);
  });
  try {
    return await putImage({ game, role, label, w: canvas.width, h: canvas.height, blob });
  } catch (e) {
    throw new ImageError('storage', e instanceof Error ? e.message : 'storage failed');
  }
}

/** A canvas holding pixels (a sketch, a veil) to draw with drawImage. */
export function pixelsToCanvas(px: Pixels): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return canvas;
}

// ── the lobby's controls ─────────────────────────────────────────────────────────

const thumbs = new Map<string, string>();

/** An object URL for a picture's thumbnail (`<img src>`), cached until `revokeThumb`. */
export function thumbUrl(rec: Pick<StoredImage, 'id' | 'blob'>): string {
  let url = thumbs.get(rec.id);
  if (!url) {
    url = URL.createObjectURL(rec.blob);
    thumbs.set(rec.id, url);
  }
  return url;
}

export function revokeThumb(id: string): void {
  const url = thumbs.get(id);
  if (url) URL.revokeObjectURL(url);
  thumbs.delete(id);
}

/**
 * A picker for the progress card: a button-styled label around a hidden file input that accepts images
 * (a phone offers its gallery and camera; a desktop's dialog lists JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC…).
 * `onFile` gets the chosen file; the input is cleared so the same file can be chosen again.
 */
export function imagePicker(text: string, onFile: (file: File) => void): HTMLElement {
  const input = h('input', { type: 'file', accept: IMAGE_ACCEPT, class: 'img-pick-input' });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  });
  return h('label', { class: 'btn ghost img-pick' }, text, input);
}

/** The first picture among dropped or pasted items (files first, then a copied image), or null. */
export function firstImage(list: { files?: FileList | null; items?: DataTransferItemList | null } | null | undefined): File | null {
  if (!list) return null;
  for (const f of Array.from(list.files ?? [])) if (looksLikeImage(f)) return f;
  for (const it of Array.from(list.items ?? [])) {
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (f && looksLikeImage(f)) return f;
  }
  return null;
}

/**
 * Let a picture be dropped on `el` (a desktop: dragged from a folder or another page) or pasted while the card is
 * open (Ctrl/⌘ V of a copied image).  The element gets the class `img-drop-on` while a file hovers over it.
 * Returns a function that removes the listeners (call it when the card closes).
 */
export function imageDrop(el: HTMLElement, onFile: (file: File) => void, pasteTarget: Document | HTMLElement | null = typeof document !== 'undefined' ? document : null): () => void {
  let depth = 0;
  const has = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const enter = (e: DragEvent) => { if (!has(e)) return; e.preventDefault(); depth++; el.classList.add('img-drop-on'); };
  const over = (e: DragEvent) => { if (!has(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
  const leave = () => { depth = Math.max(0, depth - 1); if (!depth) el.classList.remove('img-drop-on'); };
  const drop = (e: DragEvent) => {
    if (!has(e)) return;
    e.preventDefault();
    depth = 0;
    el.classList.remove('img-drop-on');
    const f = firstImage(e.dataTransfer);
    if (f) onFile(f);
  };
  const paste = (e: Event) => {
    if (!el.isConnected) return;
    const t = e.target as HTMLElement | null;
    // typing into a field pastes text there, never a picture
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const f = firstImage((e as ClipboardEvent).clipboardData);
    if (f) { e.preventDefault(); onFile(f); }
  };
  el.addEventListener('dragenter', enter);
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', drop);
  pasteTarget?.addEventListener('paste', paste);
  return () => {
    el.removeEventListener('dragenter', enter);
    el.removeEventListener('dragover', over);
    el.removeEventListener('dragleave', leave);
    el.removeEventListener('drop', drop);
    pasteTarget?.removeEventListener('paste', paste);
  };
}
