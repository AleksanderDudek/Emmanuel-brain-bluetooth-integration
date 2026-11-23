/**
 * Working offline (DESIGN.md §16).  The service worker (vite-plugin-pwa, vite.config.ts) precaches the app itself —
 * every view, the focus training, the exercises and every arcade game (each its own chunk), the fonts, the
 * Scripture and the knowledge articles — so all of it opens without a network once the app was loaded online.
 *
 * Three parts are too big to precache for everyone: the two HolyHolyHoly games (separate apps embedded in an
 * iframe; the 3D one is some 22 MB of models and textures) and the exercise cards' 4K images.  The service worker
 * caches them as they are used online (vite.config.ts runtimeCaching), and this card lets the player download each
 * one ahead of time from `offline-files.json` (written by scripts/offline-files.mjs at build), see what is kept on
 * the device and remove it.  The embedded games say plainly when they are missing offline instead of showing the
 * browser's error page (src/ui/games.ts).
 */
import { fmtNum } from '../i18n';
import { t } from '../i18n/offline';
import { $, h, run, toast } from './dom';

export type PackId = 'game3d' | 'game2d' | 'cards';
export interface Pack { id: PackId; bytes: number; files: string[] }
export interface OfflineManifest { version: string; packs: Pack[] }

/** The runtime cache of the embedded games (vite.config.ts uses the same name). */
export const GAMES_CACHE = 'emmanuel-games';
const MANIFEST = 'offline-files.json';
const PACK_NAME: Record<PackId, 'off.game3d' | 'off.game2d' | 'off.cards'> = { game3d: 'off.game3d', game2d: 'off.game2d', cards: 'off.cards' };
const CONCURRENCY = 6;

/** The runtime cache a file of a pack lives in — the names vite.config.ts's runtimeCaching reads from. */
export function cacheFor(path: string): string {
  if (path.startsWith('cards/full/')) return 'cards-full';
  if (path.startsWith('cards/thumb/')) return 'cards-thumb';
  return GAMES_CACHE;
}

const abs = (path: string): string => new URL(path, document.baseURI).href;
const mb = (bytes: number): string => fmtNum(bytes / 1e6, bytes < 1e7 ? 1 : 0);
const hasCaches = (): boolean => typeof caches !== 'undefined';

/** Read the manifest: from the network when there is one (and keep it), else the kept copy. */
export async function loadManifest(): Promise<OfflineManifest | null> {
  if (!hasCaches()) return null;
  const req = abs(MANIFEST);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) {
      const copy = res.clone();
      void caches.open(GAMES_CACHE).then(c => c.put(req, copy)).catch(() => undefined);
      return (await res.json()) as OfflineManifest;
    }
  } catch { /* offline: the kept copy below */ }
  const kept = await caches.match(req);
  return kept ? ((await kept.json()) as OfflineManifest) : null;
}

/** How many of a pack's files are on the device. */
export async function cachedCount(p: Pack): Promise<number> {
  if (!hasCaches()) return 0;
  const open = new Map<string, Cache>();
  let n = 0;
  for (const f of p.files) {
    const name = cacheFor(f);
    let c = open.get(name);
    if (!c) { c = await caches.open(name); open.set(name, c); }
    if (await c.match(abs(f), { ignoreSearch: true })) n++;
  }
  return n;
}

/** Download a pack's files into their caches, a few at a time; returns how many failed. */
export async function downloadPack(p: Pack, onFile: (done: number) => void): Promise<number> {
  let next = 0, done = 0, failed = 0;
  const worker = async (): Promise<void> => {
    while (next < p.files.length) {
      const f = p.files[next++];
      try {
        const c = await caches.open(cacheFor(f));
        const key = abs(f);
        if (!(await c.match(key, { ignoreSearch: true }))) {
          const res = await fetch(key, { cache: 'no-cache' });
          if (!res.ok) throw new Error(String(res.status));
          await c.put(key, res);
        }
      } catch {
        failed++;
      }
      onFile(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, p.files.length) }, worker));
  return failed;
}

export async function removePack(p: Pack): Promise<void> {
  for (const f of p.files) await (await caches.open(cacheFor(f))).delete(abs(f), { ignoreSearch: true });
}

/** Whether an embedded game's page (`holyholyholy3d/`) can open without a network: any cache holds it. */
export async function gameCached(path: string): Promise<boolean> {
  if (!hasCaches()) return false;
  return !!(await caches.match(abs(path), { ignoreSearch: true }) ?? await caches.match(abs(`${path}index.html`), { ignoreSearch: true }));
}

/** Say when the network goes and when it comes back (the app keeps working either way). */
export function watchNetwork(): void {
  window.addEventListener('offline', () => toast(t('off.nowOffline')));
  window.addEventListener('online', () => toast(t('off.backOnline')));
}

/** The "Praca offline" card in Ustawienia. */
export class OfflineCard {
  private readonly el = $('offlineCard');
  private manifest: OfflineManifest | null = null;
  private counts = new Map<PackId, number>();
  private busy: { id: PackId | 'all'; done: number; of: number } | null = null;
  private failed = 0;

  constructor() {
    navigator.serviceWorker?.addEventListener('controllerchange', () => this.render());
    void this.refresh();
  }

  /** Re-read the manifest and what is on the device (when Ustawienia opens). */
  async refresh(): Promise<void> {
    this.render();
    this.manifest = await loadManifest();
    if (this.manifest) for (const p of this.manifest.packs) this.counts.set(p.id, await cachedCount(p));
    this.render();
    void this.usage();
  }

  private async usage(): Promise<void> {
    const est = await navigator.storage?.estimate?.().catch(() => null);
    const line = this.el.querySelector<HTMLElement>('.off-usage');
    if (!est || !line || !est.quota) return;
    line.textContent = t('off.usage', { used: mb(est.usage ?? 0), quota: mb(est.quota) });
  }

  private async get(packs: Pack[], id: PackId | 'all'): Promise<void> {
    if (this.busy) return;
    // downloaded parts should stay: ask the browser not to clear this site's storage under pressure
    void navigator.storage?.persist?.().catch(() => false);
    const of = packs.reduce((s, p) => s + p.files.length, 0);
    this.busy = { id, done: 0, of };
    this.failed = 0;
    this.render();
    let base = 0;
    for (const p of packs) {
      this.failed += await downloadPack(p, n => {
        if (this.busy) this.busy.done = base + n;
        this.progress();
      });
      base += p.files.length;
      this.counts.set(p.id, await cachedCount(p));
    }
    this.busy = null;
    this.render();
    void this.usage();
  }

  private async remove(p: Pack): Promise<void> {
    await removePack(p);
    this.counts.set(p.id, await cachedCount(p));
    this.render();
    void this.usage();
  }

  private progress(): void {
    const b = this.busy;
    const bar = this.el.querySelector<HTMLElement>('.off-bar i');
    const txt = this.el.querySelector<HTMLElement>('.off-working');
    if (!b) return;
    const pct = Math.round((100 * b.done) / Math.max(1, b.of));
    if (bar) bar.style.width = `${pct}%`;
    if (txt) txt.textContent = t('off.working', { pct });
  }

  render(): void {
    const sw = 'serviceWorker' in navigator;
    const ready = sw && !!navigator.serviceWorker.controller;
    const badge = h('span', { class: ready ? 'badge ok' : sw ? 'badge' : 'badge warn' },
      t(ready ? 'off.ready' : sw ? 'off.preparing' : 'off.unsupported'));
    const kids: (HTMLElement | null)[] = [
      h('div', { class: 'card-head' }, h('span', null, t('off.title')), ' ', badge),
      h('p', { class: 'off-status' }, t(ready ? 'off.readyText' : sw ? 'off.preparingText' : 'off.unsupportedText')),
    ];
    const m = this.manifest;
    if (sw) {
      kids.push(h('h3', { class: 'off-sub' }, t('off.extraTitle')), h('p', { class: 'muted off-note' }, t('off.extraNote')));
      if (!m) kids.push(h('p', { class: 'muted' }, t('off.noManifest')));
      else {
        const missing = m.packs.filter(p => (this.counts.get(p.id) ?? 0) < p.files.length);
        kids.push(h('ul', { class: 'off-packs' }, ...m.packs.map(p => this.row(p))));
        if (this.busy) {
          kids.push(h('div', { class: 'off-bar', role: 'progressbar', 'aria-label': t('off.title') }, h('i')),
            h('p', { class: 'muted off-working', 'aria-live': 'polite' }, ''));
        } else if (missing.length > 1) {
          const bytes = missing.reduce((s, p) => s + p.bytes, 0);
          kids.push(h('button', { class: 'btn primary', type: 'button', on: { click: run(() => this.get(missing, 'all')) } }, t('off.getAll', { mb: mb(bytes) })));
        }
        if (this.failed > 0 && !this.busy) kids.push(h('p', { class: 'off-failed' }, t('off.failed', { n: this.failed })));
      }
      kids.push(h('p', { class: 'muted off-usage' }));
    }
    this.el.replaceChildren(...kids.filter((k): k is HTMLElement => k !== null));
    this.progress();
  }

  private row(p: Pack): HTMLElement {
    const have = this.counts.get(p.id) ?? 0, all = p.files.length;
    const full = have >= all;
    const state = full ? `${t('off.got')} ✓` : have > 0 ? t('off.partial', { pct: Math.floor((100 * have) / all) }) : '';
    const btn = this.busy ? null : full
      ? h('button', { class: 'btn ghost', type: 'button', on: { click: run(() => this.remove(p)) } }, t('off.remove'))
      : h('button', { class: 'btn', type: 'button', on: { click: run(() => this.get([p], p.id)) } }, t('off.get'));
    return h('li', { class: full ? 'off-pack got' : 'off-pack' },
      h('span', { class: 'off-name' }, t(PACK_NAME[p.id])),
      h('small', { class: 'muted' }, [t('off.size', { mb: mb(p.bytes) }), state].filter(Boolean).join(' · ')),
      btn);
  }
}

/** The embedded game's note when it is not on the device and there is no network. */
export function gameMissingNote(): HTMLElement {
  return h('div', { class: 'game-offline', role: 'status' },
    h('h2', null, t('off.gameMissing')),
    h('p', null, t('off.gameMissingText')),
    h('a', { class: 'btn primary', href: '#ustawienia' }, t('off.gameMissingGo')));
}
