/**
 * The player's own pictures for the visualisation games (DESIGN.md §13.2): a dream for Ja jestem…, a
 * "before" and an "after" for Rozświetl.  They are kept **only on this device** — IndexedDB
 * `brainlink-images`, apart from the sessions' database so its upgrades never wait on pictures —
 * resized to at most 1280 px and stored as JPEG; nothing is ever uploaded.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { h } from '../../ui/dom';
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
}

interface ImagesDB extends DBSchema {
  images: { key: string; value: StoredImage; indexes: { by_game: string } };
}

export const IMAGE_MAX_SIDE = 1280;
/** A label longer than this is cut (a word for a declaration, a name for a pair). */
export const LABEL_MAX = 40;
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

/** The size a picture is drawn at so its longer side is at most `max` (never enlarged). */
export function scaledSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(1, w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Decode a picture (EXIF orientation applied where the browser can). */
async function decode(blob: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch { /* an older engine or an odd format: try an <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e instanceof Error ? e : new Error('image decode failed');
  }
}

/** Decode a picture onto a canvas whose longer side is at most `maxSide`, and read its pixels. */
export async function loadPixels(blob: Blob, maxSide: number): Promise<{ pixels: Pixels; canvas: HTMLCanvasElement }> {
  const pic = await decode(blob);
  try {
    const size = scaledSize(pic.w, pic.h, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic.src, 0, 0, size.w, size.h);
    const data = ctx.getImageData(0, 0, size.w, size.h);
    return { pixels: { width: data.width, height: data.height, data: data.data }, canvas };
  } finally {
    pic.close();
  }
}

/**
 * Keep a picture the player chose: decoded, resized to ≤ `maxSide`, re-encoded as JPEG, stored on this
 * device.  Rejects when the browser cannot read the file (e.g. HEIC outside Safari) or storage fails.
 */
export async function saveImage(game: string, role: string, file: Blob, label = '', maxSide = IMAGE_MAX_SIDE): Promise<StoredImage> {
  const { canvas } = await loadPixels(file, maxSide);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('could not encode the picture'))), 'image/jpeg', 0.88);
  });
  return putImage({ game, role, label, w: canvas.width, h: canvas.height, blob });
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
 * (a phone offers its gallery and camera).  `onFile` gets the chosen file; the input is cleared so the
 * same file can be chosen again.
 */
export function imagePicker(text: string, onFile: (file: File) => void): HTMLElement {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'img-pick-input' });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  });
  return h('label', { class: 'btn ghost img-pick' }, text, input);
}
