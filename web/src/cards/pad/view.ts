/**
 * The pad (src/cards/DESIGN.md §5.3): the touch screen in the player's hands.  It draws the layout
 * the board sends, reports every touch the instant it lands (pointerdown, with the event's own
 * timestamp, converted to the board's clock), flashes the board's verdicts, and keeps the clock
 * sync going.  It decides nothing: the same view runs inside the board's page (split screen),
 * in a second window and on a second device (pad.html).
 */
import { handOutline, HAND_TIPS, itemSvg, svgEl } from '../art/draw';
import { ClockSync } from '../duo/clock';
import type { DuoLink, LinkMessage } from '../duo/link';
import { asBoardMsg, PROTOCOL, type PadLayout, type PadPanel, type PadState } from '../duo/protocol';
import { colorName, glyphName, t } from '../i18n';
import { COLORS } from '../palette';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

export interface PadViewOptions {
  /** where the pad draws itself (it fills it) */
  root: HTMLElement;
  link: DuoLink;
  /** inside the board's page: no header of its own */
  embedded?: boolean;
}

/** Ping often while the estimate settles, then every few seconds to follow drift (ms). */
const PING_FAST = 400, PING_SLOW = 4000, FAST_PINGS = 8;

export class PadView {
  readonly clock = new ClockSync();
  private readonly el: HTMLElement;
  private readonly head: HTMLElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly panels: HTMLElement;
  private readonly overlay: HTMLElement;
  private layout: PadLayout | null = null;
  private seq = -1;
  private marks = false;
  private input = false;
  private state: PadState = 'pairing';
  private taps = 0;
  private pings = 0;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private boardSeen = false;
  private readonly onMessage = (e: Event) => this.handle((e as CustomEvent<LinkMessage>).detail.data);
  private readonly onState = () => this.renderStatus();
  /** a field is laid out across the longer side: it turns when the screen does */
  private portrait = false;
  private readonly resize = new ResizeObserver(() => {
    const p = this.isPortrait();
    if (p !== this.portrait && this.layout?.panels.some(x => x.arrange === 'field')) this.render(this.layout);
  });

  constructor(private readonly o: PadViewOptions) {
    this.el = h('div', `k-pad${o.embedded ? ' embedded' : ''}`);
    this.head = h('header', 'k-pad-head');
    this.title = h('b', 'k-pad-title', t('pad.title'));
    this.status = h('span', 'k-pad-status');
    this.head.append(this.title, this.status);
    this.panels = h('div', 'k-pad-panels');
    this.overlay = h('div', 'k-pad-overlay');
    this.overlay.setAttribute('role', 'status');
    this.el.append(...(o.embedded ? [] : [this.head]), this.panels, this.overlay);
    o.root.replaceChildren(this.el);
    // pointerdown, not click: the touch is the response, and a click arrives a frame or more later
    this.panels.addEventListener('pointerdown', e => this.onPointer(e));
    this.panels.addEventListener('contextmenu', e => e.preventDefault());
    o.link.addEventListener('message', this.onMessage);
    o.link.addEventListener('state', this.onState);
    this.resize.observe(o.root);
    this.setOverlay(t('pad.waiting'));
    this.renderStatus();
    this.join();
  }

  /** What the board last said: the session's state, and whether taps count right now. */
  get padState(): PadState { return this.state; }
  get inputOpen(): boolean { return this.input; }

  /** Say hello (again: the board may have joined after us) and start the clock sync. */
  join(): void {
    this.o.link.send({ t: 'join', v: PROTOCOL, w: innerWidth, h: innerHeight, touch: matchMedia('(pointer: coarse)').matches });
    this.pings = 0;
    this.schedulePing(50);
  }

  private schedulePing(ms: number): void {
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => {
      this.o.link.send({ t: 'ping', a: performance.now() });
      this.pings++;
      this.schedulePing(this.pings < FAST_PINGS ? PING_FAST : PING_SLOW);
    }, ms);
  }

  destroy(): void {
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.resize.disconnect();
    this.o.link.removeEventListener('message', this.onMessage);
    this.o.link.removeEventListener('state', this.onState);
    this.el.remove();
  }

  private handle(data: unknown): void {
    const m = asBoardMsg(data);
    if (!m) return;
    if (!this.boardSeen) {
      this.boardSeen = true;
      this.renderStatus();
    }
    switch (m.t) {
      case 'hello':
        this.title.textContent = m.title;
        this.marks = m.marks;
        if (this.layout) this.render(this.layout);
        break;
      case 'layout':
        if (m.seq <= this.seq) return;
        this.seq = m.seq;
        this.layout = m.layout;
        this.render(m.layout);
        break;
      case 'state':
        this.state = m.state;
        this.input = m.input;
        this.el.dataset.state = m.state;
        this.setOverlay(m.text ?? (m.state === 'play' ? '' : this.defaultText(m.state)));
        break;
      case 'fb':
        this.flash(m.item, m.panel ?? 0, m.ok, !!m.keep);
        break;
      case 'pong': {
        const s = this.clock.add(m.a, m.b, performance.now());
        if (s && this.pings % 4 === 0) {
          const b = this.clock.best();
          if (b) this.o.link.send({ t: 'sync', offset: b.offset, rtt: b.rtt });
        }
        break;
      }
      case 'bye':
        this.state = 'done';
        this.input = false;
        this.setOverlay(t('pad.bye'));
        break;
    }
  }

  private defaultText(s: PadState): string {
    return s === 'pause' ? t('pad.paused') : s === 'done' ? t('pad.done') : s === 'countdown' ? '' : t('pad.look');
  }

  private setOverlay(text: string): void {
    this.overlay.textContent = text;
    this.overlay.hidden = !text;
  }

  private renderStatus(): void {
    const st = this.o.link.state;
    const key = st === 'closed' ? 'pad.linkClosed' : st === 'connecting' ? 'pad.linkConnecting' : this.boardSeen ? 'pad.linkOk' : 'pad.linkNoBoard';
    this.status.textContent = t(key);
    this.el.dataset.link = st === 'open' && this.boardSeen ? 'ok' : 'wait';
    if (st === 'open' && !this.boardSeen) this.join();
  }

  // ── input ────────────────────────────────────────────────────────

  private onPointer(e: PointerEvent): void {
    const target = (e.target as Element | null)?.closest<Element>('[data-item]');
    if (!target) return;
    e.preventDefault();
    const item = target.getAttribute('data-item') ?? '';
    const panel = Number(target.getAttribute('data-panel') ?? 0);
    // the event's own timestamp (same clock as performance.now()), not the moment this handler runs
    const ts = e.timeStamp > 0 ? e.timeStamp : performance.now();
    this.o.link.send({ t: 'tap', item, panel, ts, tb: this.clock.toBoard(ts), n: ++this.taps });
    target.classList.remove('k-press');
    void (target as HTMLElement).getBoundingClientRect();
    target.classList.add('k-press');
    setTimeout(() => target.classList.remove('k-press'), 180);
  }

  private flash(item: string, panel: number, ok: boolean, keep: boolean): void {
    const el = this.panels.querySelector(`[data-item="${CSS.escape(item)}"][data-panel="${panel}"]`);
    if (!el) return;
    el.classList.remove('k-ok', 'k-bad');
    void (el as HTMLElement).getBoundingClientRect();
    el.classList.add(ok ? 'k-ok' : 'k-bad');
    if (keep && ok) el.classList.add('k-done');
    if (!ok) navigator.vibrate?.(40);
    setTimeout(() => el.classList.remove('k-ok', 'k-bad'), 320);
  }

  // ── drawing ─────────────────────────────────────────────────────

  private isPortrait(): boolean { return this.o.root.clientHeight > this.o.root.clientWidth * 1.05; }

  private render(layout: PadLayout): void {
    this.portrait = this.isPortrait();
    this.panels.replaceChildren(...layout.panels.map((p, i) => this.panelEl(p, i, layout.panels.length)));
    this.panels.dataset.count = String(layout.panels.length);
  }

  private label(it: PadPanel['items'][number]): string {
    if (it.glyph) return glyphName(it.glyph);
    if (it.label !== undefined) return it.label;
    if (it.pips) return String(it.pips);
    return it.color ? colorName(it.color) : it.id;
  }

  private button(it: PadPanel['items'][number], panel: number, tag: 'button' | 'div' = 'button'): HTMLElement {
    const b = h(tag, 'k-btn');
    b.setAttribute('data-item', it.id);
    b.setAttribute('data-panel', String(panel));
    if (tag === 'button') (b as HTMLButtonElement).type = 'button';
    b.setAttribute('aria-label', this.label(it));
    if (it.done) b.classList.add('k-done');
    b.append(itemSvg({ ...it, done: false }, { marks: this.marks }));
    return b;
  }

  private panelEl(p: PadPanel, i: number, count: number): HTMLElement {
    const wrap = h('section', `k-panel k-${p.arrange}`);
    if (count > 1) wrap.append(h('p', 'k-panel-cap', t(i === 0 ? 'pad.leftHand' : 'pad.rightHand')));
    const body = h('div', 'k-panel-body');
    wrap.append(body);
    if (p.arrange === 'grid') {
      const cols = p.cols ?? Math.ceil(Math.sqrt(p.items.length));
      const grid = h('div', 'k-gridbox');
      grid.style.setProperty('--cols', String(cols));
      grid.style.setProperty('--rows', String(Math.ceil(p.items.length / cols)));
      grid.append(...p.items.map(it => this.button(it, i)));
      body.append(grid);
    } else if (p.arrange === 'ring') {
      const ring = h('div', 'k-ring');
      ring.append(svgEl('svg', { viewBox: '0 0 100 100', class: 'k-ring-line', 'aria-hidden': 'true' },
        svgEl('circle', { cx: 50, cy: 50, r: 37, fill: 'none', stroke: '#8A7160', 'stroke-width': 1.6 })));
      p.items.forEach((it, k) => {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / p.items.length;
        const b = this.button(it, i);
        b.style.left = `${50 + 37 * Math.cos(a)}%`;
        b.style.top = `${50 + 37 * Math.sin(a)}%`;
        b.style.setProperty('--size', p.items.length > 6 ? '22%' : '25%');
        ring.append(b);
      });
      body.append(ring);
    } else if (p.arrange === 'hand') {
      const hand = h('div', 'k-handbox');
      hand.append(handOutline());
      p.items.forEach((it, k) => {
        const [x, y] = HAND_TIPS[k] ?? [50, 50];
        const b = this.button(it, i);
        b.style.left = `${x}%`;
        b.style.top = `${y}%`;
        hand.append(b);
      });
      body.append(hand);
    } else if (p.arrange === 'quad') {
      const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'k-quad', role: 'group' });
      const q: Record<string, string> = {
        tl: 'M50 50L50 6A44 44 0 0 0 6 50Z', tr: 'M50 50L94 50A44 44 0 0 0 50 6Z',
        bl: 'M50 50L6 50A44 44 0 0 0 50 94Z', br: 'M50 50L50 94A44 44 0 0 0 94 50Z',
      };
      for (const it of p.items) {
        const path = svgEl('path', { d: q[it.id] ?? '', class: 'k-quarter', 'data-item': it.id, 'data-panel': i, tabindex: 0, 'aria-label': t(`pad.quad.${it.id as 'tl'}`) });
        if (it.color && Object.hasOwn(COLORS, it.color)) {
          path.style.setProperty('--hint', COLORS[it.color]);
          path.setAttribute('data-hint', it.color);
        }
        svg.append(path);
      }
      svg.append(svgEl('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: '#0C3992', 'stroke-width': 2.4, 'pointer-events': 'none' }),
        svgEl('path', { d: 'M50 6V94M6 50H94', stroke: '#0C3992', 'stroke-width': 2.4, 'pointer-events': 'none' }));
      body.append(svg);
    } else {
      const field = h('div', 'k-fieldbox');
      // the board never shows where the items are, so a tall screen may turn the field on its side
      const aspect = p.aspect ?? 1.5;
      const turn = this.portrait && aspect > 1;
      field.style.setProperty('--aspect', String(turn ? 1 / aspect : aspect));
      // a dot's radius is a fraction of the field's shorter side: its height, or its width once turned
      field.style.setProperty('--rs', String(turn ? 1 : 1 / aspect));
      for (const it of p.items) {
        const b = this.button(it, i);
        const [x, y] = turn ? [it.y ?? 0.5, it.x ?? 0.5] : [it.x ?? 0.5, it.y ?? 0.5];
        b.style.left = `${x * 100}%`;
        b.style.top = `${y * 100}%`;
        b.style.setProperty('--r', String(it.r ?? 0.07));
        field.append(b);
      }
      body.append(field);
    }
    return wrap;
  }
}
