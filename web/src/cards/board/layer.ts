/**
 * A two-screen session (src/cards/DESIGN.md §5): the full-screen layer that pairs the pad, takes
 * the band's resting reference, runs one game or the daily workout's three, and ends on the
 * summary.  It owns the link to the pad and answers its clock pings; the trial loop (loop.ts)
 * decides the trials, the stage (stage.ts) draws them, the band track (band.ts) records the
 * headband.  The layer is modal, like the arcade games' (the app underneath is inert).
 */
import type { Hub, HubSample } from '../../hub';
import { REASON_TEXT } from '../../hub';
import { mulberry32 } from '../../core/random';
import { fmtNum, lang } from '../../i18n';
import { TOOL_INFO } from '../../tools';
import type { TrainingResult } from '../../training/score';
import { itemSvg, svgEl } from '../art/draw';
import { ChannelLink, LocalLink, newRoom, padUrl, RelayLink, type DuoLink, type LinkKind, type LinkMessage, type PeerEvent } from '../duo/link';
import { asPadMsg, PROTOCOL, type BoardMsg, type FeedbackMsg, type PadLayout, type PadState } from '../duo/protocol';
import { qrMatrix, qrPath } from '../duo/qr';
import { gameMeta } from '../games';
import { headline, sessionStats, unitOf } from '../games/stats';
import type { GameId, TrialRecord } from '../games/types';
import { t } from '../i18n';
import { PadView } from '../pad/view';
import type { CardSession, CardStore, GamePlay } from '../store';
import { BandTrack, type BandRecord } from './band';
import { TrialLoop } from './loop';
import { Stage } from './stage';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const btn = (label: string, fn: () => void, cls = 'k-btn-ui'): HTMLButtonElement => {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
};

export interface SessionPlan {
  kind: 'game' | 'workout';
  games: GameId[];
  /** seconds of play per game */
  seconds: number;
  pad: LinkKind;
  marks: boolean;
  /** record the band (when its signal is live) */
  band: boolean;
  /** also record Mendi's raw signal with trial markers */
  raw: boolean;
  /** where each game starts, and whether it gets its practice first */
  levels: Partial<Record<GameId, number>>;
  practice: Partial<Record<GameId, boolean>>;
  /** each game's best headline so far */
  bests: Partial<Record<GameId, number>>;
  /** the pad page's base on the local network (relay), e.g. http://192.168.1.20:8420/app/ */
  lanBase?: string;
}

export interface LayerDeps {
  hub: Hub;
  store: CardStore;
  /** save a training result in the app (Sesje, the day score) */
  saveTraining: (r: TrainingResult) => Promise<void>;
  /** markers into a running recording (no-op otherwise) */
  mark: (label: string) => void;
  /** Mendi's raw recording: start one for this session (false if it could not), stop it */
  record: { start: (name: string, sec: number) => Promise<boolean>; stop: () => Promise<void> };
  openSheet: () => void;
  /** a session was saved (the module's lists refresh) */
  onSaved: (s: CardSession) => void;
  /** the layer closed */
  onClose: () => void;
}

/** A pad that has said nothing for this long is gone (ms); it pings every 1.5 s (pad/view.ts). */
export const PAD_SILENT_MS = 4000;
/** The rest between the daily workout's games (s). */
const REST_SEC = 15;
/** The shortest game worth saving (s of play). */
const MIN_SAVE_SEC = 20;

type Step = 'pairing' | 'baseline' | 'game' | 'rest' | 'summary' | 'closed';

export class CardsLayer {
  private root: HTMLElement | null = null;
  private plan: SessionPlan | null = null;
  private link: DuoLink | null = null;
  private padLink: DuoLink | null = null;
  private padView: PadView | null = null;
  private padId: string | null = null;
  private padSeen = 0;
  private padRtt: number | null = null;
  private room = '';
  private stepNow: Step = 'closed';
  /** where the session is; the layer's data-step follows it (the summary takes the whole screen) */
  private get step(): Step { return this.stepNow; }
  private set step(s: Step) {
    this.stepNow = s;
    if (this.root) this.root.dataset.step = s;
  }
  private loop: TrialLoop | null = null;
  private stage: Stage | null = null;
  private gameIdx = 0;
  private plays: GamePlay[] = [];
  private band: BandTrack | null = null;
  private bandMeta: { source: 'device' | 'simulator'; device: string } | null = null;
  private rawRecording = false;
  private raf = 0;
  private startedAt = 0;
  private restUntil = 0;
  private lastLayout: PadLayout | null = null;
  /** the items marked done on the current layout (found targets, passed stops): a rejoined pad gets them again */
  private kept: FeedbackMsg[] = [];
  private lastState: { state: PadState; input: boolean; text?: string } = { state: 'pairing', input: false };
  private seq = 0;
  private ui: {
    card: HTMLElement; badge: HTMLElement; title: HTMLElement; sub: HTMLElement; clock: HTMLElement; score: HTMLElement;
    stageBox: HTMLElement; foot: HTMLElement; sheet: HTMLElement; padCol: HTMLElement | null; bandChip: HTMLElement;
  } | null = null;
  private readonly onSample = (e: Event) => this.sample((e as CustomEvent<HubSample>).detail);
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.step === 'game') { e.preventDefault(); this.togglePause(); }
  };
  private readonly onVisibility = () => {
    if (!document.hidden || this.step !== 'game') return;
    this.pause();
    this.padPause = false;   // back from another tab, the player resumes by hand
  };

  constructor(private readonly d: LayerDeps) {}

  get active(): boolean { return this.step !== 'closed'; }
  /** something would be lost by leaving: the reference, a game or the rest between games (not pairing, not the saved summary) */
  get busy(): boolean { return this.step === 'baseline' || this.step === 'game' || this.step === 'rest'; }

  // ── opening and closing ──────────────────────────────────────────

  /** Forget everything of the last session (the layer is one object, reused for every session). */
  private reset(): void {
    this.loop = null;
    this.stage = null;
    this.stageGame = null;
    this.band = null;
    this.bandMeta = null;
    this.bandPhase = null;
    this.padPause = false;
    this.padRtt = null;
    this.lastLayout = null;
    this.kept = [];
    this.lastState = { state: 'pairing', input: false };
    this.baseUi = null;
    this.pairStatus = null;
    this.pairNext = null;
    this.plays = [];
    this.gameIdx = 0;
  }

  open(plan: SessionPlan): void {
    if (this.active) return;
    this.reset();
    this.plan = plan;
    this.startedAt = Date.now() / 1000;
    this.build();
    document.querySelector('.app')?.setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    this.d.hub.addEventListener('sample', this.onSample);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.connect(plan.pad);
    if (plan.pad === 'local') this.afterPairing();
    else this.showPairing();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  private close(): void {
    cancelAnimationFrame(this.raf);
    this.send({ t: 'bye' });
    this.step = 'closed';
    this.d.hub.removeEventListener('sample', this.onSample);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.padView?.destroy();
    this.padView = null;
    // the "bye" gets a moment to leave; the links are taken now, so a session opened meanwhile keeps its own
    const link = this.link, padLink = this.padLink;
    this.link = this.padLink = null;
    setTimeout(() => { link?.close(); padLink?.close(); }, 200);
    if (this.rawRecording) void this.d.record.stop();
    this.rawRecording = false;
    this.root?.remove();
    this.root = null;
    this.ui = null;
    document.querySelector('.app')?.removeAttribute('inert');
    document.documentElement.style.overflow = '';
    this.reset();
    this.d.onClose();
  }

  // ── the link to the pad ──────────────────────────────────────────

  private connect(kind: LinkKind): void {
    this.room = newRoom();
    this.padId = null;
    this.padSeen = 0;
    if (kind === 'local') {
      const [board, pad] = LocalLink.pair();
      this.link = board;
      this.padLink = pad;
    } else if (kind === 'channel') {
      this.link = new ChannelLink(this.room, 'board', 'board');
    } else {
      // an id of its own per session: the relay lets only this board back into the room (brainlink/duo_api.py)
      const id = `b${Math.random().toString(36).slice(2, 12)}`;
      this.link = new RelayLink(RelayLink.urlFor(this.room, 'board', id), 'board');
      this.link.addEventListener('peer', e => {
        const p = (e as CustomEvent<PeerEvent>).detail;
        if (p.role === 'pad' && p.event === 'leave' && p.id === this.padId) this.padSeen = 0;
      });
    }
    this.link.addEventListener('message', e => this.onPad((e as CustomEvent<LinkMessage>).detail));
    if (this.padLink && this.ui?.padCol) this.padView = new PadView({ root: this.ui.padCol, link: this.padLink, embedded: true });
  }

  private send(m: BoardMsg): void {
    if (!this.link) return;
    this.link.send(m, this.padId ?? undefined);
  }

  private onPad({ data, from }: LinkMessage): void {
    const m = asPadMsg(data);
    if (!m) return;
    const now = performance.now();
    if (m.t === 'ping') {
      // answered first, before anything else can delay it: the reply's timestamp is the clock sync
      this.link?.send({ t: 'pong', a: m.a, b: performance.now() }, from);
    }
    const isNew = from !== this.padId;
    this.padId = from;
    const wasGone = !this.padSeen || now - this.padSeen > PAD_SILENT_MS;
    this.padSeen = now;
    if (m.t === 'join' || isNew || wasGone) this.greet();
    // the pad is back after the game stopped for it: carry on, as the pause screen promised
    if (wasGone && this.padPause && this.step === 'game' && !document.hidden && this.loop?.phase === 'paused') this.resume();
    if (m.t === 'sync') this.padRtt = m.rtt;
    if (m.t === 'tap' && this.loop && this.step === 'game') this.loop.tap(m.item, m.panel, m.tb, now);
    if (m.t === 'leave') this.padSeen = 0;
    if (this.step === 'pairing') this.renderPairing();
  }

  /** Bring a (re)joined pad up to date: who we are, the current layout and state. */
  private greet(): void {
    const g = this.currentGame();
    this.send({ t: 'hello', v: PROTOCOL, game: g ?? '', title: g ? t(`game.${g}.title`) : t('pad.title'), marks: !!this.plan?.marks });
    if (this.lastLayout) this.send({ t: 'layout', seq: ++this.seq, layout: this.lastLayout });
    for (const fb of this.kept) this.send(fb);
    this.send({ t: 'state', ...this.lastState });
  }

  private padState(state: PadState, input: boolean, text?: string): void {
    this.lastState = { state, input, ...(text !== undefined ? { text } : {}) };
    this.send({ t: 'state', ...this.lastState });
  }

  private padLayout(layout: PadLayout): void {
    this.lastLayout = layout;
    this.kept = [];
    this.send({ t: 'layout', seq: ++this.seq, layout });
  }

  private get padPresent(): boolean { return this.plan?.pad === 'local' || (this.padSeen > 0 && performance.now() - this.padSeen < PAD_SILENT_MS); }

  private currentGame(): GameId | null { return this.plan?.games[this.gameIdx] ?? null; }

  // ── the layer's DOM ──────────────────────────────────────────────

  private build(): void {
    const plan = this.plan!;
    const root = h('div', 'k-layer k-theme');
    root.dataset.pad = plan.pad;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    const shell = h('div', 'k-shell');
    const card = h('div', 'k-card k-board');
    const head = h('header', 'k-head');
    const badge = h('span', 'k-badge', '01');
    const titles = h('div', 'k-titles');
    const title = h('h1', 'k-title');
    const sub = h('p', 'k-sub');
    titles.append(title, sub);
    const meta = h('div', 'k-meta');
    const clock = h('span', 'k-clock');
    const score = h('span', 'k-score');
    const pause = btn(t('run.pause'), () => this.togglePause(), 'k-icon-btn');
    pause.setAttribute('aria-label', t('run.pause'));
    pause.append(svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, svgEl('path', { d: 'M8.5 6v12M15.5 6v12', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' })));
    pause.firstChild?.remove();
    meta.append(score, clock, pause);
    head.append(badge, titles, meta);
    const stageBox = h('div', 'k-stagebox');
    const foot = h('footer', 'k-foot');
    const bandChip = h('span', 'k-bandchip');
    foot.append(h('i', 'k-dot'), h('span', 'k-foot-text'), bandChip, h('span', 'k-stars', '★ ★ ★'));
    card.append(head, stageBox, foot);
    shell.append(card);
    let padCol: HTMLElement | null = null;
    if (plan.pad === 'local') {
      padCol = h('div', 'k-padcol');
      shell.append(padCol);
    }
    const sheet = h('div', 'k-sheet');
    sheet.hidden = true;
    root.append(shell, sheet);
    document.body.append(root);
    this.root = root;
    this.ui = { card, badge, title, sub, clock, score, stageBox, foot, sheet, padCol, bandChip };
    this.setHead(plan.games[0]);
  }

  private setHead(game: GameId): void {
    const ui = this.ui!;
    ui.title.textContent = t(`game.${game}.title`);
    ui.sub.textContent = t(`game.${game}.tagline`);
    ui.foot.querySelector('.k-foot-text')!.textContent = t(`game.${game}.trains`);
  }

  private sheet(...kids: Node[]): void {
    const s = this.ui!.sheet;
    s.replaceChildren(h('div', 'k-sheet-card', undefined));
    s.firstElementChild!.append(...kids);
    s.hidden = false;
  }

  private hideSheet(): void { if (this.ui) this.ui.sheet.hidden = true; }

  // ── pairing ─────────────────────────────────────────────────────

  private pairStatus: HTMLElement | null = null;
  private pairNext: HTMLButtonElement | null = null;

  private showPairing(): void {
    this.step = 'pairing';
    const plan = this.plan!;
    const base = plan.pad === 'relay' ? plan.lanBase ?? location.href : new URL(import.meta.env.BASE_URL, location.href).toString();
    const url = padUrl(base, this.room, plan.pad === 'relay' ? 'relay' : 'channel', lang);
    const kids: Node[] = [h('h2', undefined, t('pair.title'))];
    if (plan.pad === 'relay') {
      kids.push(h('p', undefined, t('pair.scan')));
      const m = qrMatrix(url, 'M');
      const { size, d } = qrPath(m, 4);
      const qr = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'k-qr', role: 'img', 'shape-rendering': 'crispEdges' },
        svgEl('rect', { width: size, height: size, fill: '#fff' }), svgEl('path', { d, fill: '#0C3992' }));
      const title = svgEl('title');
      title.textContent = url;
      qr.prepend(title);
      kids.push(qr);
    } else {
      kids.push(btn(t('pair.window'), () => {
        const w = window.open(url, 'emmanuel-pad', 'popup,width=900,height=640');
        if (!w) this.pairStatus!.textContent = t('pair.windowBlocked', { url });
      }, 'k-btn-ui primary'));
    }
    const link = h('p', 'k-url');
    link.textContent = url;
    const room = h('p', 'k-room');
    room.append(h('span', undefined, t('pair.room')), h('b', undefined, this.room));
    this.pairStatus = h('p', 'k-pair-status', t('pair.waiting'));
    this.pairNext = btn(t('pair.continue'), () => this.afterPairing(), 'k-btn-ui primary');
    this.pairNext.disabled = true;
    kids.push(link, room, this.pairStatus, h('div', 'k-actions'));
    (kids[kids.length - 1] as HTMLElement).append(btn(t('pair.cancel'), () => this.close()), this.pairNext);
    this.sheet(...kids);
    this.renderPairing();
  }

  private renderPairing(): void {
    if (!this.pairStatus || !this.pairNext) return;
    const ok = this.padPresent;
    this.pairStatus.textContent = ok ? `${t('pair.connected')}${this.padRtt !== null ? ` · ${t('pair.latency', { ms: Math.round(this.padRtt) })}` : ''}` : t('pair.waiting');
    this.pairStatus.dataset.ok = String(ok);
    this.pairNext.disabled = !ok;
  }

  // ── the band's baseline ─────────────────────────────────────────

  private bandLive(): boolean {
    const s = this.d.hub.status;
    return !!s.tool && (s.source === 'simulator' || (s.source === 'device' && s.device.streaming));
  }

  private afterPairing(): void {
    this.hideSheet();
    const plan = this.plan!;
    const s = this.d.hub.status;
    if (plan.band && s.tool && this.bandLive()) {
      this.band = new BandTrack(s.tool);
      this.bandMeta = { source: s.source === 'simulator' ? 'simulator' : 'device', device: s.device.name ?? TOOL_INFO[s.tool].device };
      if (plan.raw && s.tool === 'fnirs' && s.source === 'device') {
        void this.d.record.start(`karty-${plan.kind === 'workout' ? 'dzien' : plan.games[0]}`, Math.min(7200, plan.games.length * (plan.seconds + 90) + 120))
          .then(ok => { this.rawRecording = ok; });
      }
      this.d.mark(`karty:start:${plan.games.join('+')}`);
      this.band.startBaseline();
      this.step = 'baseline';
      this.padState('idle', false, t('pad.look'));
      this.renderBaseline();
    } else this.startGame();
  }

  private baseUi: { bar: HTMLElement; why: HTMLElement } | null = null;

  private renderBaseline(): void {
    const stage = this.ensureStage(this.currentGame()!);
    const bar = h('div', 'k-bar');
    bar.append(h('i'));
    const why = h('p', 'k-why');
    stage.message(t('run.base'), t('run.baseText'), [bar, why, btn(t('run.baseSkip'), () => {
      this.band = null;
      this.startGame();
    }, 'k-btn-ui')]);
    this.baseUi = { bar, why };
  }

  private sample(s: HubSample): void {
    const b = this.band;
    if (!b) return;
    const done = b.onSample(s);
    if (this.step === 'baseline' && this.baseUi) {
      (this.baseUi.bar.firstElementChild as HTMLElement).style.width = `${Math.round(b.calProgress * 100)}%`;
      this.baseUi.why.textContent = !b.reliable && b.reason ? t('run.baseWaiting', { why: REASON_TEXT[b.reason] }) : '';
    }
    if (done && this.step === 'baseline') this.startGame();
    this.renderBandChip();
  }

  private renderBandChip(): void {
    const ui = this.ui, b = this.band;
    if (!ui) return;
    if (!b) { ui.bandChip.hidden = true; return; }
    ui.bandChip.hidden = false;
    const last = b.scorer.series[b.scorer.series.length - 1];
    ui.bandChip.textContent = `${TOOL_INFO[b.tool].band}${b.calibrated && last !== undefined && last !== null ? ` · ${last >= 0 ? '+' : '−'}${fmtNum(Math.abs(last), 0)}%` : ''}`;
    ui.bandChip.dataset.ok = String(b.reliable);
  }

  // ── a game ──────────────────────────────────────────────────────

  private ensureStage(game: GameId): Stage {
    const ui = this.ui!;
    if (!this.stage || this.stageGame !== game) {
      this.stage = new Stage(game);
      this.stage.marks = !!this.plan?.marks;
      this.stageGame = game;
      ui.stageBox.replaceChildren(this.stage.el);
    }
    return this.stage;
  }

  private stageGame: GameId | null = null;

  private startGame(): void {
    const plan = this.plan!;
    const game = plan.games[this.gameIdx];
    const meta = gameMeta(game)!;
    this.setHead(game);
    this.greet();
    // practice and the countdown are task time but not play: neither the rest block nor the play block
    this.band?.setPhase('off');
    const stage = this.ensureStage(game);
    const ui = this.ui!;
    const override = Number(new URLSearchParams(location.search).get('trainingSec'));
    const seconds = Number.isFinite(override) && override >= 10 ? Math.min(900, override) : plan.seconds;
    const level = plan.levels[game] ?? 1;
    const rng = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0);
    this.loop = new TrialLoop(meta, { rng, level, plannedSec: seconds, practice: plan.practice[game] ?? true }, {
      show: (s, legend, cue) => stage.show(s, legend, cue, this.loop?.rule != null),
      layout: l => this.padLayout(l),
      feedback: fb => {
        if (fb.keep && fb.ok) this.kept.push(fb);
        this.send(fb);
      },
      padState: (s, input, text) => this.padState(s, input, text ?? (s === 'practice' && !input ? t('run.practice') : undefined)),
      countdown: n => {
        stage.countdown(n);
        if (n === 0) {
          this.band?.blockStart(game);
          this.d.mark(`karty:${game}:play`);
        }
      },
      level: (l, change) => {
        stage.note(t(change > 0 ? 'run.levelUp' : 'run.levelDown', { n: l }));
        ui.badge.textContent = String(l).padStart(2, '0');
      },
      trial: rec => {
        this.d.mark(`k:${game}:${rec.i}:${rec.ok ? 1 : 0}`);
        this.renderScore();
        this.blip(rec.ok);
      },
      verdict: ok => stage.verdict(ok),
      end: () => this.endGame(),
    });
    ui.badge.textContent = String(this.loop.level).padStart(2, '0');
    this.step = 'game';
    this.hideSheet();
    if (this.loop.meta.practice > 0 && (plan.practice[game] ?? true)) stage.note(t('run.practiceText'), 3200);
    this.loop.begin(performance.now());
    this.renderScore();
  }

  private renderScore(): void {
    const ui = this.ui, loop = this.loop;
    if (!ui || !loop) return;
    ui.score.textContent = loop.phase === 'practice' ? t('run.practice') : `${loop.trials.filter(x => x.ok).length} ${t('run.correct')}`;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const ui = this.ui;
    if (!ui) return;
    if (this.step === 'pairing') this.renderPairing();
    const loop = this.loop;
    if (this.step === 'game' && loop) {
      // the pad went quiet: stop the clock instead of counting misses it cannot help
      // as of the last word from it: the silent seconds are not play, and their timeouts are not misses
      if (loop.phase === 'play' && !this.padPresent) {
        if (this.padSeen > 0) loop.lost(this.padSeen, now);
        this.pause(t('run.padLost'));
        this.padPause = true;
        this.renderScore();
      }
      // (a tick can end the game: endGame() clears this.loop, so the clock reads the loop it ticked)
      loop.tick(now);
      const left = Math.max(0, this.plan ? this.plannedOf() - loop.playedMs(now) / 1000 : 0);
      ui.clock.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    }
    if (this.step === 'rest') {
      const left = Math.max(0, (this.restUntil - now) / 1000);
      ui.clock.textContent = `0:${String(Math.ceil(left)).padStart(2, '0')}`;
      const bar = ui.stageBox.querySelector<HTMLElement>('.k-bar i');
      if (bar) bar.style.width = `${Math.round((1 - left / REST_SEC) * 100)}%`;
      if (left <= 0) this.nextGame();
    }
  };

  private plannedOf(): number {
    const override = Number(new URLSearchParams(location.search).get('trainingSec'));
    return Number.isFinite(override) && override >= 10 ? Math.min(900, override) : this.plan!.seconds;
  }

  // ── pause ───────────────────────────────────────────────────────

  private togglePause(): void {
    if (this.step !== 'game' || !this.loop) return;
    if (this.loop.phase === 'paused') this.resume(); else this.pause();
  }

  private pause(why?: string): void {
    const loop = this.loop;
    if (!loop || loop.phase === 'paused' || loop.phase === 'done' || loop.phase === 'idle') return;
    loop.pause(performance.now());
    if (this.band && this.band.phase !== 'baseline') {
      this.bandPhase = this.band.phase;
      this.band.setPhase('off');
    }
    const played = loop.playedMs() / 1000;
    const actions = h('div', 'k-actions');
    actions.append(btn(t('run.resume'), () => this.resume(), 'k-btn-ui primary'));
    if (played >= MIN_SAVE_SEC || this.plays.length) actions.append(btn(t('run.endSave'), () => { this.hideSheet(); loop.stop(); }));
    actions.append(btn(t('run.discard'), () => this.close()));
    const kids: Node[] = [h('h2', undefined, t('run.paused'))];
    if (why) kids.push(h('p', 'k-why', why));
    kids.push(actions);
    this.sheet(...kids);
  }

  /** the game stopped because the pad went quiet (it resumes by itself when the pad is back) */
  private padPause = false;

  private resume(): void {
    const loop = this.loop;
    this.padPause = false;
    if (!loop || loop.phase !== 'paused') return;
    this.hideSheet();
    loop.resume(performance.now());
    if (this.band?.calibrated && this.bandPhase) this.band.setPhase(this.bandPhase);
    this.bandPhase = null;
  }

  /** the band's phase when the game paused (restored on resume) */
  private bandPhase: 'off' | 'rest' | 'play' | null = null;

  // ── between games, and the end ──────────────────────────────────

  private endGame(): void {
    const loop = this.loop!;
    const game = loop.meta.id;
    this.band?.blockEnd();
    this.d.mark(`karty:${game}:end`);
    const playedSec = loop.playedMs() / 1000;
    const trials: TrialRecord[] = loop.trials;
    // stopped in practice or the countdown: nothing was played
    if (trials.length || playedSec >= 1) this.plays.push({
      game, levelStart: loop.startLevel, levelEnd: loop.level, plannedSec: this.plannedOf(), playedSec: Math.round(playedSec * 10) / 10,
      trials, stats: sessionStats(game, trials, playedSec), early: loop.early,
    });
    this.loop = null;
    if (this.gameIdx < this.plan!.games.length - 1) this.rest();
    else void this.finish().catch(e => {
      console.error(e);
      this.renderSummary(null, false, e instanceof Error ? e.message : String(e));
    });
  }

  private rest(): void {
    this.step = 'rest';
    this.restUntil = performance.now() + REST_SEC * 1000;
    const next = this.plan!.games[this.gameIdx + 1];
    const stage = this.ensureStage(this.plan!.games[this.gameIdx]);
    const bar = h('div', 'k-bar');
    bar.append(h('i'));
    stage.message(t('run.rest'), t('run.restText', { game: t(`game.${next}.title`) }), [bar, btn(t('run.restSkip'), () => this.nextGame(), 'k-btn-ui')]);
    this.padState('idle', false, t('run.rest'));
  }

  private nextGame(): void {
    if (this.step !== 'rest') return;
    this.gameIdx++;
    this.startGame();
  }

  private async finish(): Promise<void> {
    this.step = 'summary';
    this.padState('done', false);
    const plan = this.plan!;
    const worth = this.plays.some(p => p.playedSec >= MIN_SAVE_SEC);
    let band: BandRecord | null = null;
    if (this.band && this.bandMeta) band = this.band.record(this.bandMeta);
    const session: CardSession = {
      v: 1, id: `k${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      kind: plan.kind, start: this.startedAt, end: Date.now() / 1000, pad: plan.pad,
      plays: this.plays, band, sync: this.syncInfo(),
    };
    if (this.rawRecording) {
      this.rawRecording = false;
      await this.d.record.stop().catch(() => undefined);
    }
    let saved: CardSession | null = null;
    let failed: string | undefined;
    if (worth) {
      try {
        await this.d.store.put(session);
        saved = session;
        this.d.onSaved(session);
      } catch (e) {
        // the summary still shows what was played; it says the session was not kept
        console.error(e);
        failed = e instanceof Error ? e.message : String(e);
      }
      if (saved && this.band && this.bandMeta && this.band.scorer.playedSec >= MIN_SAVE_SEC) {
        await this.d.saveTraining(this.trainingResult(session, this.band, this.bandMeta)).catch(e => console.error(e));
      }
    }
    this.renderSummary(saved, worth, failed);
  }

  /** The session as one of the app's training results (Sesje, the day, the streak). */
  private trainingResult(session: CardSession, band: BandTrack, meta: { source: 'device' | 'simulator'; device: string }): TrainingResult {
    const plan = this.plan!;
    const plays = this.plays.filter(p => p.trials.length);
    const plannedSec = this.plays.reduce((s, p) => s + p.plannedSec, 0);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const rt = (ms: number | null) => (ms === null ? '—' : `${Math.round(ms)} ms`);
    if (plan.kind === 'workout') {
      // three games in three units: the workout's own number is correct answers per minute across all of them
      const correct = plays.reduce((s, p) => s + p.stats.correct, 0);
      const n = plays.reduce((s, p) => s + p.stats.trials, 0);
      const min = plays.reduce((s, p) => s + p.playedSec, 0) / 60;
      return band.toResult({ id: session.id, ...meta, plannedSec }, {
        id: 'karty:dzien', title: t('home.daily'), score: min > 0 ? Math.round((correct / min) * 10) / 10 : 0, unit: t('sum.unit.answers'),
        best: null,
        stats: [[t('sum.accuracy'), pct(n ? correct / n : 0)], ...plays.map(p => [t(`game.${p.game}.title`), fmtNum(headline(p.game, p.stats), unitOf(p.game) === 'span' ? 0 : 1)] as [string, string])],
      });
    }
    const first = plays[0] ?? this.plays[0];
    return band.toResult({ id: session.id, ...meta, plannedSec }, {
      id: `karty:${first.game}`, title: t(`game.${first.game}.title`),
      score: headline(first.game, first.stats), unit: t(`sum.unit.${unitOf(first.game)}`),
      best: plan.bests[first.game] ?? null,
      stats: [[t('sum.accuracy'), pct(first.stats.accuracy)], [t('sum.medianRt'), rt(first.stats.medianRt)]],
    });
  }

  private syncInfo(): CardSession['sync'] {
    if (this.plan?.pad === 'local') return { rtt: 0, uncertainty: 0 };
    return this.padRtt === null ? null : { rtt: Math.round(this.padRtt * 10) / 10, uncertainty: Math.round((this.padRtt / 2) * 10) / 10 };
  }

  private renderSummary(saved: CardSession | null, worth: boolean, failed?: string): void {
    const plan = this.plan!;
    const box = h('div', 'k-summary');
    box.append(h('p', 'k-kicker', plan.kind === 'workout' ? t('sum.workout') : t('sum.kicker')));
    for (const p of this.plays) box.append(this.playSummary(p, plan.bests[p.game] ?? null));
    if (saved?.band) box.append(this.bandSummary(saved.band));
    else if (worth) box.append(h('p', 'k-note', t('sum.bandNone')));
    if (saved?.sync && plan.pad !== 'local') box.append(h('p', 'k-note', t('sum.sync', { ms: fmtNum(saved.sync.uncertainty, 1) })));
    box.append(failed !== undefined ? h('p', 'k-why', t('sum.saveFailed', { error: failed }))
      : h('p', 'k-note', worth ? t('sum.saved') : t('sum.short')));
    const actions = h('div', 'k-actions');
    if (plan.kind === 'game') actions.append(btn(t('sum.again'), () => this.again(), 'k-btn-ui primary'));
    actions.append(btn(t('sum.done'), () => this.close()));
    box.append(actions);
    const stage = this.ensureStage(this.plays[this.plays.length - 1]?.game ?? plan.games[0]);
    stage.message('', '');
    this.ui!.stageBox.replaceChildren(box);
    this.stage = null;
    this.stageGame = null;
    this.ui!.clock.textContent = '';
  }

  private again(): void {
    const plan = this.plan!;
    const last = this.plays[this.plays.length - 1];
    if (last) {
      plan.levels[last.game] = Math.max(1, last.levelEnd);
      plan.practice[last.game] = false;
      const best = plan.bests[last.game];
      const v = headline(last.game, last.stats);
      if (best === undefined || v > best) plan.bests[last.game] = v;
    }
    this.plays = [];
    this.gameIdx = 0;
    this.startedAt = Date.now() / 1000;
    // the band's reference is still good: a short new session continues on it
    if (this.band) {
      const tool = this.band.tool, ref = this.band.meter.reference;
      this.band = new BandTrack(tool);
      this.band.startBaseline(ref);
    }
    this.startGame();
  }

  private playSummary(p: GamePlay, best: number | null): HTMLElement {
    const s = p.stats;
    const v = headline(p.game, s);
    const unit = unitOf(p.game);
    const sec = h('section', 'k-play');
    sec.append(h('h3', undefined, t(`game.${p.game}.title`)));
    const big = h('p', 'k-big');
    big.append(h('b', undefined, fmtNum(v, unit === 'span' ? 0 : 1)), h('span', undefined, t(`sum.unit.${unit}`)));
    sec.append(big);
    if (best === null) sec.append(h('p', 'k-note', t('sum.first')));
    else if (v > best) sec.append(h('p', 'k-record', t('sum.record')));
    else sec.append(h('p', 'k-note', t('sum.best', { v: fmtNum(best, unit === 'span' ? 0 : 1) })));
    const grid = h('dl', 'k-stats');
    const add = (k: string, val: string, note?: string) => {
      const d = h('div');
      d.append(h('dt', undefined, k), h('dd', undefined, val));
      if (note) d.title = note;
      grid.append(d);
    };
    add(t('sum.accuracy'), t('sum.pct', { n: Math.round(s.accuracy * 100) }));
    add(t('sum.medianRt'), s.medianRt === null ? '—' : t('sum.ms', { n: Math.round(s.medianRt) }));
    if (s.iqrRt !== null) add(t('sum.iqr'), t('sum.ms', { n: Math.round(s.iqrRt) }));
    add(t('sum.level'), p.levelStart === p.levelEnd ? String(p.levelEnd) : `${p.levelStart} → ${p.levelEnd}`);
    add(t('sum.trials'), String(s.trials));
    add(t('sum.errors'), String(s.errors));
    if (s.timeouts) add(t('sum.timeouts'), String(s.timeouts));
    if (s.interference !== undefined && s.interference !== null) add(t('sum.interference'), t('sum.ms', { n: s.interference }), t('sum.interferenceNote'));
    if (s.asyncMs !== undefined && s.asyncMs !== null) add(t('sum.async'), t('sum.ms', { n: Math.round(s.asyncMs) }), t('sum.asyncNote'));
    if (s.spanMean !== undefined && s.spanMean !== null) add(t('sum.spanMean'), fmtNum(s.spanMean, 1));
    sec.append(grid);
    if (s.interference !== undefined && s.interference !== null) sec.append(h('p', 'k-note', t('sum.interferenceNote')));
    if (s.asyncMs !== undefined && s.asyncMs !== null) sec.append(h('p', 'k-note', t('sum.asyncNote')));
    if (p.trials.some(x => x.rt !== null)) {
      const canvas = h('canvas', 'k-chart');
      canvas.setAttribute('aria-label', t('sum.chart'));
      sec.append(h('p', 'k-chart-label', t('sum.chart')), canvas);
      requestAnimationFrame(() => drawRtChart(canvas, p.trials));
    }
    return sec;
  }

  private bandSummary(b: BandRecord): HTMLElement {
    const sec = h('section', 'k-play k-band');
    sec.append(h('h3', undefined, t('sum.bandTitle', { band: TOOL_INFO[b.tool].band })));
    const grid = h('dl', 'k-stats');
    const add = (k: string, v: string) => { const d = h('div'); d.append(h('dt', undefined, k), h('dd', undefined, v)); grid.append(d); };
    const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v), 1)}%`);
    for (const blk of b.blocks) add(`${t('sum.bandPlay')} · ${t(`game.${blk.game as GameId}.title`)}`, pct(blk.mean));
    if (b.restMean !== null) add(t('sum.bandRest'), pct(b.restMean));
    add(t('sum.bandReliable'), `${b.reliablePct}%`);
    sec.append(grid);
    const canvas = h('canvas', 'k-chart k-band-chart');
    sec.append(canvas, h('p', 'k-note', t('sum.bandNote')));
    requestAnimationFrame(() => drawSeries(canvas, b.series));
    return sec;
  }

  // ── a little sound ──────────────────────────────────────────────

  private audio: AudioContext | null = null;

  private blip(ok: boolean): void {
    if (!this.plan || !this.audioOn) return;
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = ok ? 880 : 220;
      o.type = ok ? 'sine' : 'triangle';
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.2));
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    } catch { /* no audio: fine */ }
  }

  audioOn = true;
}

// ── charts ───────────────────────────────────────────────────────

function sizeCanvas(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const r = c.getBoundingClientRect();
  if (!r.width) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = r.width * dpr;
  c.height = r.height * dpr;
  const ctx = c.getContext('2d');
  ctx?.scale(dpr, dpr);
  return ctx;
}

/** Reaction time per trial: dots (navy), mistakes as hollow coral rings along the top. */
export function drawRtChart(c: HTMLCanvasElement, trials: readonly TrialRecord[]): void {
  const ctx = sizeCanvas(c);
  if (!ctx) return;
  const w = c.clientWidth, hgt = c.clientHeight, pad = 8;
  const rts = trials.map(x => x.rt).filter((v): v is number => v !== null);
  const max = Math.max(500, ...rts) * 1.1;
  const x = (i: number) => pad + ((w - 2 * pad) * (i + 0.5)) / Math.max(1, trials.length);
  const y = (v: number) => hgt - pad - ((hgt - 2 * pad) * v) / max;
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  for (const g of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(pad, y(max * g)); ctx.lineTo(w - pad, y(max * g)); ctx.stroke(); }
  ctx.fillStyle = '#6B7280';
  ctx.font = '11px Poppins, system-ui, sans-serif';
  ctx.fillText(`${Math.round(max * 0.75)} ms`, pad + 2, y(max * 0.75) - 3);
  trials.forEach((tr, i) => {
    ctx.beginPath();
    if (tr.ok && tr.rt !== null) {
      ctx.fillStyle = '#0C3992';
      ctx.arc(x(i), y(tr.rt), 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#FE6F61';
      ctx.lineWidth = 1.6;
      ctx.arc(x(i), pad + 4, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

/** The band's activity per second of play (teal line on a zero line). */
export function drawSeries(c: HTMLCanvasElement, series: readonly (number | null)[]): void {
  const ctx = sizeCanvas(c);
  if (!ctx || !series.length) return;
  const w = c.clientWidth, hgt = c.clientHeight, pad = 6;
  const vals = series.filter((v): v is number => v !== null);
  const m = Math.max(5, ...vals.map(Math.abs)) * 1.15;
  const x = (i: number) => pad + ((w - 2 * pad) * i) / Math.max(1, series.length - 1);
  const y = (v: number) => hgt / 2 - ((hgt / 2 - pad) * v) / m;
  ctx.strokeStyle = '#D1D5DB';
  ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(w - pad, y(0)); ctx.stroke();
  ctx.strokeStyle = '#00CFC1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  series.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    if (pen) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v));
    pen = true;
  });
  ctx.stroke();
}

/** A legend row as DOM (also used by the lobby's rule preview). */
export function legendRows(rows: { cue: Parameters<typeof itemSvg>[0]; answer: Parameters<typeof itemSvg>[0] }[], marks = false): HTMLElement[] {
  return rows.map(r => {
    const row = h('div', 'k-legend-row');
    row.append(itemSvg(r.cue, { marks }), h('span', 'k-arrow', '→'), itemSvg(r.answer, { marks }));
    return row;
  });
}
