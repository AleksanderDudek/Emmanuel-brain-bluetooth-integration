// @vitest-environment happy-dom
/**
 * The player's own pictures (src/arcade/kit/images.ts): kept only on this device in their own
 * IndexedDB, listed per game newest first, labelled as plain text, deleted for good.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  LABEL_MAX, cleanLabel, deleteImage, getImage, imagePicker, listImages, putImage, saveImage, scaledSize, setLabel,
  IMAGE_ACCEPT, ImageError, firstImage, imageDrop, isHeic, looksLikeImage,
} from '../src/arcade/kit/images';

const blob = (s = 'x') => new Blob([s], { type: 'image/jpeg' });

describe('kit/images', () => {
  it('keeps pictures per game and role, newest first, and forgets them on delete', async () => {
    const a = await putImage({ game: 'rozswietl-t1', role: 'after', label: 'Dom', w: 800, h: 600, blob: blob('a'), added: 1 });
    const b = await putImage({ game: 'rozswietl-t1', role: 'before', label: 'Dom', w: 800, h: 600, blob: blob('b'), added: 2 });
    await putImage({ game: 'jestem-t1', role: 'vision', label: 'zdrowa', w: 600, h: 800, blob: blob('c'), added: 3 });
    expect((await listImages('rozswietl-t1')).map(r => r.id)).toEqual([b.id, a.id]);
    expect((await listImages('rozswietl-t1', 'after')).map(r => r.id)).toEqual([a.id]);
    expect(await listImages('nobody')).toEqual([]);
    const got = await getImage(a.id);
    expect(got?.label).toBe('Dom');
    expect(got?.w).toBe(800);   // (the test database's structured clone drops Blob contents; browsers keep them)
    await deleteImage(a.id);
    expect(await getImage(a.id)).toBeUndefined();
    expect((await listImages('rozswietl-t1')).map(r => r.id)).toEqual([b.id]);
  });

  it('labels as plain trimmed text, cut to the limit', async () => {
    expect(cleanLabel('  w\npracy\tmarzeń  ')).toBe('w pracy marzeń');
    expect(cleanLabel('x'.repeat(100))).toHaveLength(LABEL_MAX);
    expect(cleanLabel('<b>silna</b>')).toBe('<b>silna</b>');   // kept as text; the game sets textContent, never markup
    const r = await putImage({ game: 'jestem-t2', role: 'vision', label: '', w: 1, h: 1, blob: blob() });
    await setLabel(r.id, '  zdrowa ');
    expect((await getImage(r.id))?.label).toBe('zdrowa');
  });

  it('never enlarges a picture and keeps its shape when it shrinks it', () => {
    expect(scaledSize(4000, 3000, 1280)).toEqual({ w: 1280, h: 960 });
    expect(scaledSize(3000, 4000, 1280)).toEqual({ w: 960, h: 1280 });
    expect(scaledSize(640, 480, 1280)).toEqual({ w: 640, h: 480 });
    expect(scaledSize(0, 0, 1280)).toEqual({ w: 1, h: 1 });
  });

  it('offers a picker: a labelled button around a file input for images that clears after a pick', () => {
    const picked: File[] = [];
    const el = imagePicker('Dodaj zdjęcie', f => picked.push(f));
    const input = el.querySelector('input')!;
    expect(el.tagName).toBe('LABEL');
    expect(el.textContent).toContain('Dodaj zdjęcie');
    expect(input.getAttribute('accept')).toBe(IMAGE_ACCEPT);
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.heic']) expect(IMAGE_ACCEPT).toContain(ext);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(picked).toEqual([file]);
  });

  it('tells pictures from other files, by type or by name, and names the HEIC of an iPhone', () => {
    expect(looksLikeImage(new File(['x'], 'a.PNG', { type: '' }))).toBe(true);
    expect(looksLikeImage(new File(['x'], 'photo.heic', { type: '' }))).toBe(true);
    expect(looksLikeImage(new File(['x'], 'x.bin', { type: 'image/webp' }))).toBe(true);
    expect(looksLikeImage(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))).toBe(false);
    expect(isHeic(new File(['x'], 'IMG_0001.HEIC', { type: '' }))).toBe(true);
    expect(isHeic(new File(['x'], 'a.jpg', { type: 'image/heif' }))).toBe(true);
    expect(isHeic(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('refuses what is not a picture before decoding, with a reason', async () => {
    await expect(saveImage('jestem', 'vision', new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toMatchObject({ reason: 'notImage' });
    const big = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 61 * 1024 * 1024 });
    await expect(saveImage('jestem', 'vision', big)).rejects.toBeInstanceOf(ImageError);
  });

  it('takes a dropped or pasted picture, skipping other files', () => {
    const got: File[] = [];
    const el = document.createElement('div');
    document.body.appendChild(el);
    const off = imageDrop(el, f => got.push(f));
    const pic = new File(['x'], 'b.png', { type: 'image/png' });
    const doc = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const drop = new Event('drop', { cancelable: true }) as Event & { dataTransfer: unknown };
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [doc, pic], items: [] } });
    el.dispatchEvent(drop);
    expect(got).toEqual([pic]);
    expect(firstImage({ files: [doc] as unknown as FileList })).toBeNull();
    off();
    el.dispatchEvent(drop);
    expect(got).toHaveLength(1);
    el.remove();
  });
});
