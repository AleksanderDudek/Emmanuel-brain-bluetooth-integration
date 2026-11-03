/**
 * The links between the board and the pad (src/cards/DESIGN.md §5.1).  The same protocol runs
 * over three of them, chosen by where the pad is:
 *
 * * **local** — the pad is part of the board's own page (one tablet, split screen).  Messages
 *   pass through a microtask, serialised like on a wire, so the game code cannot tell.
 * * **channel** — the pad is another window or tab of the same browser (a laptop with a touch
 *   screen, a second monitor).  BroadcastChannel, no network at all.
 * * **relay** — the pad is a second device on the same Wi-Fi.  Browsers refuse plain `ws://` from
 *   the HTTPS app and have no serverless way to find a peer, so the Emmanuel desktop server
 *   (`python run.py`) serves the app at `/app/` and relays the JSON between the two
 *   (`/api/v1/duo/ws/<room>`, brainlink/duo_api.py).  Nothing leaves the local network.
 *
 * Events: 'message' (CustomEvent<{ data, from }>), 'state' (the link opened or closed), 'peer'
 * (CustomEvent<{ event: 'join' | 'leave', role, id }>: the relay's presence notices; the local and
 * channel links have no presence of their own, so the board watches the pad's heartbeat instead).
 */

export type LinkKind = 'local' | 'channel' | 'relay';
export type LinkState = 'connecting' | 'open' | 'closed';
export type Role = 'board' | 'pad';

export interface LinkMessage { data: unknown; from: string }
export interface PeerEvent { event: 'join' | 'leave'; role: Role; id: string }

export abstract class DuoLink extends EventTarget {
  abstract readonly kind: LinkKind;
  state: LinkState = 'connecting';

  /** Send one message; `to` addresses one pad (the board's side; the pad always talks to the board). */
  abstract send(msg: object, to?: string): void;
  abstract close(): void;

  protected setState(s: LinkState): void {
    if (s === this.state) return;
    this.state = s;
    this.dispatchEvent(new Event('state'));
  }

  protected deliver(data: unknown, from: string): void {
    this.dispatchEvent(new CustomEvent<LinkMessage>('message', { detail: { data, from } }));
  }

  protected peer(e: PeerEvent): void {
    this.dispatchEvent(new CustomEvent<PeerEvent>('peer', { detail: e }));
  }
}

/** Serialise like a wire would: the receiver never shares an object with the sender. */
const wire = (msg: object): unknown => JSON.parse(JSON.stringify(msg));

// ── local: both ends in one page ────────────────────────────────

export class LocalLink extends DuoLink {
  readonly kind = 'local' as const;
  private other: LocalLink | null = null;

  private constructor(private readonly role: Role) {
    super();
  }

  /** The two ends: [board, pad]. */
  static pair(): [LocalLink, LocalLink] {
    const board = new LocalLink('board'), pad = new LocalLink('pad');
    board.other = pad;
    pad.other = board;
    board.state = pad.state = 'open';
    return [board, pad];
  }

  send(msg: object): void {
    const to = this.other;
    if (!to || this.state !== 'open') return;
    const data = wire(msg);
    queueMicrotask(() => { if (to.state === 'open') to.deliver(data, this.role === 'pad' ? 'local' : 'board'); });
  }

  close(): void {
    const o = this.other;
    this.other = null;
    this.setState('closed');
    if (o) {
      o.other = null;
      o.setState('closed');
    }
  }
}

// ── channel: two windows of one browser ─────────────────────────

interface ChannelEnvelope { role: Role; id: string; to?: string; msg: unknown }

export class ChannelLink extends DuoLink {
  readonly kind = 'channel' as const;
  private readonly ch: BroadcastChannel;

  constructor(readonly room: string, private readonly role: Role, private readonly id: string) {
    super();
    this.ch = new BroadcastChannel(`brainlink-duo:${room}`);
    this.ch.onmessage = e => {
      const env = e.data as ChannelEnvelope | null;
      if (!env || typeof env !== 'object' || env.role === this.role) return;
      if (env.to !== undefined && env.to !== this.id) return;
      this.deliver(env.msg, env.id);
    };
    this.state = 'open';
  }

  send(msg: object, to?: string): void {
    if (this.state !== 'open') return;
    const env: ChannelEnvelope = { role: this.role, id: this.id, msg: wire(msg), ...(to ? { to } : {}) };
    this.ch.postMessage(env);
  }

  close(): void {
    this.ch.close();
    this.setState('closed');
  }
}

// ── relay: two devices through the desktop server ───────────────

/** The relay's own notices (brainlink/duo_api.py). */
interface RelayNotice { t: 'relay' | 'peer' | 'relay-error'; event?: 'join' | 'leave'; role?: Role; id?: string; error?: string; peers?: { role: Role; id: string }[] }

export class RelayLink extends DuoLink {
  readonly kind = 'relay' as const;
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** why the relay refused us for good (a full room, a newer board), if it did */
  refused: string | null = null;

  /** @param url ws(s)://host/api/v1/duo/ws/<room> */
  constructor(private readonly url: string, private readonly role: Role) {
    super();
    this.open();
  }

  /** The relay's address for a room, on the server this page came from. */
  static urlFor(room: string, role: Role, id: string, loc: Location = location): string {
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}/api/v1/duo/ws/${encodeURIComponent(room)}?role=${role}&id=${encodeURIComponent(id)}`;
  }

  private open(): void {
    if (this.closed) return;
    this.setState('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setState('open');
    };
    ws.onmessage = e => {
      let data: unknown;
      try { data = JSON.parse(String(e.data)); } catch { return; }
      const n = data as RelayNotice;
      if (n && typeof n === 'object' && (n.t === 'relay' || n.t === 'peer' || n.t === 'relay-error')) {
        if (n.t === 'relay') for (const p of n.peers ?? []) this.peer({ event: 'join', role: p.role, id: p.id });
        else if (n.t === 'peer' && n.event && n.role && n.id) this.peer({ event: n.event, role: n.role, id: n.id });
        return;
      }
      const from = typeof (data as { from?: unknown }).from === 'string' ? (data as { from: string }).from : 'board';
      this.deliver(data, from);
    };
    ws.onclose = e => {
      if (this.ws !== ws) return;
      this.ws = null;
      // 4000 bad room, 4001 replaced by a newer connection, 4002 room full: retrying would not help
      // (4003 "too slow" and the network's own closes are worth a reconnect)
      if (e.code === 4000 || e.code === 4001 || e.code === 4002) {
        this.refused = e.reason || String(e.code);
        this.closed = true;
      }
      if (this.closed) { this.setState('closed'); return; }
      this.setState('connecting');
      const wait = Math.min(5000, 400 * 2 ** this.retry++);
      this.timer = setTimeout(() => this.open(), wait);
    };
    ws.onerror = () => { /* onclose follows and retries */ };
  }

  send(msg: object, to?: string): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(to && this.role === 'board' ? { ...msg, to } : msg));
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(1000); } catch { /* already gone */ }
    this.setState('closed');
  }
}

// ── rooms ────────────────────────────────────────────────────────

/** Room codes: four characters nobody misreads (no I/L/O, no 0/1). */
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newRoom(rng: () => number = Math.random, len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ROOM_ALPHABET[Math.floor(rng() * ROOM_ALPHABET.length)];
  return s;
}

export const isRoom = (v: unknown): v is string => typeof v === 'string' && /^[A-Z2-9]{4,8}$/.test(v);

/** A short id for this end of a link. */
export const newPeerId = (rng: () => number = Math.random): string => `p${Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0')}`;

/** Where the pad page is, with the room and the link in the fragment (never sent to a server). */
export function padUrl(base: string, room: string, via: 'channel' | 'relay', lang?: string): string {
  const u = new URL('pad.html', base);
  // the pad speaks the board's language (the phone's own may differ; the player is the same)
  if (lang) u.searchParams.set('lang', lang);
  u.hash = `r=${room}&v=${via}`;
  return u.toString();
}

/** The room and link the pad page was opened with (null = opened by hand, without a room). */
export function parsePadHash(hash: string): { room: string; via: 'channel' | 'relay' } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const room = (p.get('r') ?? '').toUpperCase(), via = p.get('v');
  return isRoom(room) && (via === 'channel' || via === 'relay') ? { room, via } : null;
}
