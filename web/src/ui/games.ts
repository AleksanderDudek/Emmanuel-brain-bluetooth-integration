/**
 * Games inside the app (DESIGN.md §4): a full-screen layer with the game in a
 * same-origin <iframe> (`?hub=1`), fed with the app's band through the
 * Hub's GameHost — the band stays connected here, the game never pairs it.
 */
import type { Hub, HubStatus } from '../hub';
import type { GameId } from './router';
import { $, h } from './dom';

export interface GameInfo { id: GameId; title: string; path: string; text: string }

export const GAMES: Record<GameId, GameInfo> = {
  holyholyholy: {
    id: 'holyholyholy', title: 'HolyHolyHoly', path: 'holyholyholy/',
    text: 'Anioł stróż zjada i trawi traumy, zamieniając je w prawdę. Skupienie ładuje Ogień Ducha, równowaga półkul — Aurę Pokoju.',
  },
  holyholyholy3d: {
    id: 'holyholyholy3d', title: 'HolyHolyHoly 3D', path: 'holyholyholy3d/',
    text: 'Siedmiu archaniołów, opowieść z Chrystusem i prawdziwe umiejętności CBT. Utrzymane skupienie daje mnożnik do ×3.',
  },
};

export class GameLayer {
  private readonly layer = $('gameLayer');
  private frame: HTMLIFrameElement | null = null;
  private lastSig = '';
  current: GameId | null = null;

  constructor(private readonly hub: Hub, private readonly onClose: () => void, openSheet: () => void) {
    $('gameClose').addEventListener('click', () => this.onClose());
    // the device sheet is a modal dialog: it opens above the game, so the band can be connected mid-game
    $('gameBand').addEventListener('click', openSheet);
    $('gameFull').addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.layer.requestFullscreen?.().catch(() => undefined);
    });
  }

  open(id: GameId): void {
    if (this.current === id) return;
    this.close();
    const g = GAMES[id];
    this.current = id;
    $('gameTitle').textContent = g.title;
    const frame = h('iframe', {
      title: g.title, src: `${import.meta.env.BASE_URL}${g.path}?hub=1`,
      allow: 'fullscreen; autoplay; microphone; gamepad', referrerpolicy: 'same-origin',
    });
    $('gameFrame').replaceChildren(frame);
    this.frame = frame;
    this.hub.games.attach(frame.contentWindow);
    this.layer.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    this.lastSig = '';
    frame.focus();
  }

  close(): void {
    if (!this.current) return;
    this.hub.games.attach(null);
    this.frame?.remove();   // stops the game's audio and loops
    this.frame = null;
    this.current = null;
    this.layer.hidden = true;
    document.documentElement.style.overflow = '';
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }

  /** The bar's line about the band the game is using. */
  render(s: HubStatus): void {
    if (!this.current) return;
    let text: string;
    if (s.tool !== 'fnirs') text = 'Gra czyta opaskę Mendi (fNIRS) — teraz bez opaski';
    else if (s.source === 'simulator') text = 'Sygnał: symulator BrainLink';
    else if (s.source === 'device' && s.device.streaming) text = `Opaska z BrainLink: ${s.device.name ?? 'Mendi'}${s.device.battery !== null ? ` · ${s.device.battery}%` : ''}`;
    else text = 'Bez opaski — połącz ją w BrainLink, gra przejmie sygnał';
    if (!this.hub.games.connected) text += ' · gra się wczytuje…';
    if (text !== this.lastSig) {
      this.lastSig = text;
      $('gameLink').textContent = text;
    }
  }
}
