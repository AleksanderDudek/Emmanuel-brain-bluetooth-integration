/**
 * Trening skupienia (DESIGN.md §5): the setup view and the full-screen run —
 * mood check, breathwork, calibration, the game (canvas + HUD) and the
 * summary.  The session logic lives in src/training/session.ts.
 */
import type { Hub, HubSample, HubStatus } from '../hub';
import { REASON_TEXT } from '../hub';
import type { AppSettings, SceneId, TrainingPrefs } from '../settings';
import type { SessionDB } from '../storage/db';
import { TOOL_INFO } from '../tools';
import { TrainingAudio } from '../training/audio';
import { drawScenePreview, SceneRenderer, SCENES } from '../training/scene';
import { dayScore, isTopSession, newMilestones, type Mood, type TrainingResult } from '../training/score';
import { FocusSession } from '../training/session';
import { $, fmtDur, h, run, toast } from './dom';

const SVGNS = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...kids: SVGElement[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}
const icon = (id: string) => s('svg', { 'aria-hidden': 'true' }, s('use', { href: `#${id}` }));

const LENGTHS: TrainingPrefs['minutes'][] = [3, 5, 10, 15];
const FACE_LABELS = ['Bardzo źle', 'Źle', 'Tak sobie', 'Dobrze', 'Bardzo dobrze'];
const FEELINGS = ['spokój', 'energia', 'skupienie', 'radość', 'wdzięczność', 'ciekawość', 'zmęczenie', 'stres', 'niepokój', 'napięcie', 'rozproszenie', 'smutek'];
const CUES: { at: number | 'half' | 'last'; text: string }[] = [
  { at: 2, text: 'Celem treningu jest poprawa skupienia' },
  { at: 8, text: '…przez sterowanie grą samym umysłem' },
  { at: 14, text: 'Skup się, ale zostań rozluźniony' },
  { at: 24, text: 'Miłego treningu!' },
  { at: 'half', text: 'Twój mózg staje się silniejszy z każdą sesją' },
  { at: 'last', text: 'Jeszcze chwila — utrzymaj kulę wysoko' },
];
const DIP_CUE = 'Chwilowe spadki to część drogi';

function face(level: number): SVGSVGElement {
  const k = [-7, -3.5, 0, 4.5, 8][level];
  return s('svg', { viewBox: '0 0 44 44', 'aria-hidden': 'true' },
    s('circle', { cx: 22, cy: 22, r: 19, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
    s('circle', { cx: 15.5, cy: 18, r: 2, fill: 'currentColor' }),
    s('circle', { cx: 28.5, cy: 18, r: 2, fill: 'currentColor' }),
    s('path', { d: `M13 ${29 - k / 3} Q22 ${29 + k} 31 ${29 - k / 3}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
}

/** A stylised brain outline for the calibration screen. */
function brain(): SVGSVGElement {
  const p = (d: string) => s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  return s('svg', { viewBox: '0 0 120 96', class: 'calib-brain', 'aria-hidden': 'true' },
    p('M58 10c-6-6-18-5-22 3-9-2-17 5-15 14-9 3-12 14-6 21-5 8 0 19 10 20 1 9 11 15 20 11 5 6 13 6 13 6V10z'),
    p('M62 10c6-6 18-5 22 3 9-2 17 5 15 14 9 3 12 14 6 21 5 8 0 19-10 20-1 9-11 15-20 11-5 6-13 6-13 6V10z'),
    p('M36 13c2 6 8 8 12 6M21 27c4 5 11 5 15 1M15 48c6 2 11-1 13-6M25 68c3-6 9-8 14-5M84 13c-2 6-8 8-12 6M99 27c-4 5-11 5-15 1M105 48c-6 2-11-1-13-6M95 68c-3-6-9-8-14-5'));
}

/** Area chart of a session's activity per second, baseline at 0. */
export function drawOverview(canvas: HTMLCanvasElement, series: readonly (number | null)[], fill: readonly string[]): void {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = r.width, hh = r.height;
  const vals = series.map(v => v ?? 0);
  if (vals.length < 2) return;
  const hi = Math.max(10, ...vals), lo = Math.min(-5, ...vals);
  const y = (v: number) => 6 + (hh - 12) * (1 - (v - lo) / (hi - lo));
  const g = ctx.createLinearGradient(0, 0, 0, hh);
  g.addColorStop(0, fill[0]); g.addColorStop(0.35, fill[1]); g.addColorStop(0.7, fill[2]); g.addColorStop(1, fill[3]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, hh);
  vals.forEach((v, i) => ctx.lineTo((w * i) / (vals.length - 1), y(v)));
  ctx.lineTo(w, hh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y(0));
  ctx.lineTo(w, y(0));
  ctx.stroke();
  ctx.setLineDash([]);
}

const signPct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`);

// ── setup view ─────────────────────────────────────────────────────
export class FocusSetup {
  private previewsDrawn = false;

  constructor(private readonly settings: AppSettings, private readonly save: () => Promise<void>, onStart: () => void) {
    const p = settings.training;
    $('lenPick').replaceChildren(...LENGTHS.map(m => h('button', {
      class: 'btn', type: 'button', role: 'radio', 'aria-checked': String(p.minutes === m),
      on: { click: () => this.set({ minutes: m }) },
    }, `${m} min`)));
    $('scenePick').replaceChildren(...(Object.keys(SCENES) as SceneId[]).map(id => h('button', {
      class: 'scene', type: 'button', role: 'radio', 'aria-checked': String(p.scene === id), 'data-scene': id, 'aria-label': SCENES[id].name,
      on: { click: () => this.set({ scene: id }) },
    }, h('canvas', { 'aria-hidden': 'true' }), h('span', null, SCENES[id].name))));
    const bind = (id: string, key: 'mood' | 'breathwork' | 'glow' | 'zoom' | 'hud' | 'sound' | 'chime') => {
      const el = $<HTMLInputElement>(id);
      el.checked = p[key];
      el.addEventListener('change', () => this.set({ [key]: el.checked }));
    };
    bind('optMood', 'mood'); bind('optBreath', 'breathwork'); bind('optGlow', 'glow'); bind('optZoom', 'zoom');
    bind('optHud', 'hud'); bind('optSound', 'sound'); bind('optChime', 'chime');
    const vol = $<HTMLInputElement>('optVolume');
    vol.value = String(p.volume);
    vol.addEventListener('change', () => this.set({ volume: Number(vol.value) }));
    $('btnFocusStart').addEventListener('click', run(onStart));
  }

  private set(patch: Partial<TrainingPrefs>): void {
    Object.assign(this.settings.training, patch);
    void this.save();
    const p = this.settings.training;
    $('lenPick').querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => b.setAttribute('aria-checked', String(LENGTHS[i] === p.minutes)));
    $('scenePick').querySelectorAll<HTMLButtonElement>('.scene').forEach(b => b.setAttribute('aria-checked', String(b.dataset.scene === p.scene)));
  }

  /** Called when the view is shown (the thumbnails need a laid-out canvas). */
  shown(): void {
    if (this.previewsDrawn) return;
    requestAnimationFrame(() => {
      $('scenePick').querySelectorAll<HTMLButtonElement>('.scene').forEach(b => drawScenePreview(b.querySelector('canvas')!, b.dataset.scene as SceneId));
      this.previewsDrawn = true;
    });
  }

  render(st: HubStatus): void {
    const badge = $('focusBadge'), ready = $('focusReady'), hint = $('focusHint'), btn = $<HTMLButtonElement>('btnFocusStart');
    const tool = st.tool;
    let text: string, cls = 'badge', label: string, can = true, note = '';
    if (!tool) {
      text = 'Wybierz opaskę u góry: fNIRS (Mendi) albo EEG (HALO).';
      label = 'brak opaski'; can = false;
    } else if (st.source === 'off' || st.signal.reason === 'no_device') {
      text = `Połącz ${TOOL_INFO[tool].device} albo włącz symulator.`;
      label = 'brak sygnału'; can = false;
      note = 'Przycisk opaski w prawym górnym rogu.';
    } else if (st.signal.reliable) {
      text = st.source === 'simulator' ? 'Symulator gotowy.' : 'Sygnał dobry — możesz zaczynać.';
      label = 'gotowe'; cls += ' ok';
      if (st.source === 'simulator') note = 'Na symulatorze kulą sterujesz przyciskiem „Symuluj skupienie” w trakcie gry.';
    } else {
      text = st.signal.reason ? REASON_TEXT[st.signal.reason] : 'Czekam na sygnał';
      label = st.signal.reason === 'baseline' ? `linia bazowa ${Math.round(st.signal.progress * 100)}%` : 'czekam';
      cls += ' warn';
      note = 'Możesz zacząć — kalibracja poczeka na dobry sygnał.';
    }
    if (ready.textContent !== text) ready.textContent = text;
    badge.textContent = label;
    badge.className = cls;
    btn.disabled = !can;
    if (hint.textContent !== note) hint.textContent = note;
    const tips = tool ? [TOOL_INFO[tool].fit, 'Usiądź wygodnie, ekran na wysokości oczu, ogranicz ruchy głowy.', 'Przyciemnij światło i wycisz powiadomienia.'] : [];
    const tipsEl = $('focusTips');
    if (tipsEl.dataset.tool !== (tool ?? '')) {
      tipsEl.dataset.tool = tool ?? '';
      tipsEl.replaceChildren(...tips.map(t => h('li', null, t)));
    }
  }
}

// ── the run ────────────────────────────────────────────────────────
export interface RunnerDeps {
  hub: Hub;
  db: SessionDB;
  settings: AppSettings;
  /** markers into a running recording (no-op otherwise) */
  mark: (label: string) => void;
  onSaved: (r: TrainingResult) => void;
  /** leave the run: 'again' restarts the setup flow, 'done' goes home */
  onExit: (next: 'again' | 'done' | 'cancel') => void;
}

export class FocusRunner {
  private readonly root = $('immersive');
  private session: FocusSession | null = null;
  private audio: TrainingAudio | null = null;
  private renderer: SceneRenderer | null = null;
  private raf = 0;
  private lastFrame = 0;
  private lastSampleAt = 0;
  private cueTimers: ReturnType<typeof setTimeout>[] = [];
  private shownCues = new Set<string>();
  private dipSec = 0;
  private ui: {
    cal?: { bar: HTMLElement; text: HTMLElement; reason: HTMLElement };
    game?: { hud: HTMLElement; card: HTMLElement; bar: HTMLElement; points: HTMLElement; act: HTMLElement; ctrl: HTMLElement;
             cardVal: HTMLElement; cue: HTMLElement; hold: HTMLElement; sim: HTMLButtonElement | null };
  } = {};
  private simFocus = false;
  private completing = false;
  active = false;

  constructor(private readonly d: RunnerDeps) {
    d.hub.addEventListener('sample', e => this.onSample((e as CustomEvent<HubSample>).detail));
    document.addEventListener('visibilitychange', () => {
      if (!this.active) return;
      if (document.hidden) this.audio?.suspend(); else this.audio?.resume();
    });
    window.addEventListener('resize', () => this.renderer?.resize());
    document.addEventListener('keydown', e => {
      if (this.active && e.key === 'Escape' && this.session?.phase === 'game') { e.preventDefault(); this.askEnd(); }
    });
  }

  /** From the "Rozpocznij" click (audio may start only after a gesture). */
  start(): void {
    if (this.active) return;
    const tool = this.d.hub.tool;
    if (!tool) throw new Error('Najpierw wybierz opaskę');
    const p = this.d.settings.training;
    this.active = true;
    this.root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    // ?trainingSec=40 shortens the session (tests and demos)
    const override = Number(new URLSearchParams(location.search).get('trainingSec'));
    const planned = Number.isFinite(override) && override >= 10 ? Math.min(900, override) : p.minutes * 60;
    this.session = new FocusSession(tool, planned);
    this.audio = new TrainingAudio(p.volume, p.sound, p.chime);
    this.audio.start();
    this.shownCues.clear();
    this.dipSec = 0;
    this.simFocus = false;
    this.completing = false;
    const next = () => (p.breathwork ? this.breath() : this.calibration());
    if (p.mood) this.mood(next); else next();
  }

  private show(el: HTMLElement): void {
    this.root.replaceChildren(el);
  }

  private closeBtn(onClick: () => void): HTMLButtonElement {
    return h('button', { class: 'icon-btn top-close', type: 'button', 'aria-label': 'Przerwij', on: { click: onClick } }, icon('i-close'));
  }

  // ── mood ───────────────────────────────────────────────────────
  private mood(next: () => void): void {
    let pick: number | null = null;
    const words = new Set<string>();
    const done = h('button', { class: 'btn primary big', type: 'button', disabled: true }, 'Dalej');
    const faces = h('div', { class: 'faces', role: 'group', 'aria-label': 'Samopoczucie' }, FACE_LABELS.map((label, i) => {
      const b = h('button', { class: 'face', type: 'button', 'aria-pressed': 'false', 'aria-label': label, title: label }, face(i));
      b.addEventListener('click', () => {
        pick = i;
        faces.querySelectorAll('.face').forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
        done.disabled = false;
      });
      return b;
    }));
    const wordEls = h('div', { class: 'words' }, FEELINGS.map(wd => {
      const b = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false' }, wd);
      b.addEventListener('click', () => {
        if (words.has(wd)) words.delete(wd);
        else if (words.size < 5) words.add(wd);
        b.classList.toggle('on', words.has(wd));
        b.setAttribute('aria-pressed', String(words.has(wd)));
      });
      return b;
    }));
    done.addEventListener('click', () => {
      if (pick !== null) this.session!.mood = { face: (pick + 1) as Mood['face'], words: [...words] };
      next();
    });
    this.show(h('div', { class: 'phase' }, this.closeBtn(() => this.cancel()),
      h('p', { class: 'eyebrow' }, 'Przed sesją'), h('h2', null, 'Jak się dziś czujesz?'), faces,
      h('p', { class: 'muted' }, 'Wybierz do pięciu słów, które pasują (opcjonalnie):'), wordEls,
      h('div', { class: 'row center' }, done, h('button', { class: 'btn ghost', type: 'button', on: { click: next } }, 'Pomiń'))));
  }

  // ── breathwork: cyclic sighing ─────────────────────────────────
  private breath(): void {
    const TOTAL = 60;
    const steps: [string, number, number][] = [['Wdech nosem', 2.5, 0.82], ['Jeszcze krótki wdech', 1, 1], ['Długi wydech ustami', 5.5, 0.42]];
    const rings = [h('i'), h('i'), h('i')];
    const word = h('b', null, 'Gotowi?');
    const count = h('small', null, `${TOTAL} s`);
    const circle = h('div', { class: 'breath', 'aria-live': 'polite' }, rings, word, count);
    let t0 = performance.now(), stepIdx = -1, stepEnd = 0, alive = true;
    const finish = () => {
      if (!alive || !this.active) return;
      alive = false;
      this.session!.breathworkSec = Math.round(Math.min(TOTAL, (performance.now() - t0) / 1000));
      this.calibration();
    };
    const tick = () => {
      if (!alive || !this.active) return;
      const el = (performance.now() - t0) / 1000;
      if (el >= TOTAL) return finish();
      if (el >= stepEnd) {
        stepIdx = (stepIdx + 1) % steps.length;
        const [txt, dur, scale] = steps[stepIdx];
        stepEnd = el + dur;
        word.textContent = txt;
        circle.style.setProperty('--s', String(scale));
        circle.style.setProperty('--t', `${dur}s`);
      }
      count.textContent = `${Math.ceil(TOTAL - el)} s`;
      requestAnimationFrame(tick);
    };
    this.show(h('div', { class: 'phase' }, this.closeBtn(() => this.cancel()),
      h('p', { class: 'eyebrow' }, 'Oddech · westchnienie cykliczne'),
      h('h2', null, 'Dwa wdechy nosem, długi wydech ustami'),
      circle, h('div', { class: 'row center mt16' }, h('button', { class: 'btn ghost', type: 'button', on: { click: finish } }, 'Pomiń'))));
    t0 = performance.now();
    requestAnimationFrame(tick);
  }

  // ── calibration ────────────────────────────────────────────────
  private calibration(): void {
    if (!this.active || !this.session) return;
    this.session.beginCalibration();
    const bar = h('div'), text = h('p', { class: 'muted' }), reason = h('p', { class: 'calib-reason', role: 'status' });
    const tool = this.session!.tool;
    this.ui.cal = { bar, text, reason };
    this.show(h('div', { class: 'phase' }, this.closeBtn(() => this.cancel()),
      brain(),
      h('p', { class: 'eyebrow' }, 'Kalibracja'),
      h('h2', null, tool === 'fnirs' ? 'Szukam przepływu krwi i tlenu…' : 'Szukam fal mózgowych…'),
      h('div', { class: 'progress calib-bar' }, bar), text,
      h('p', { class: 'muted' }, 'Siedź spokojnie, z miękką, nieskupioną uwagą — to punkt odniesienia dla całej sesji.'), reason));
    this.d.mark('training:start');
  }

  private renderCalibration(): void {
    const ses = this.session!, ui = this.ui.cal;
    if (!ui) return;
    const baseline = ses.calStage === 'baseline';
    const st = this.d.hub.status.signal;
    const p = baseline ? st.progress * 0.4 : 0.4 + ses.calProgress * 0.6;
    ui.bar.style.width = `${Math.round(p * 100)}%`;
    ui.text.textContent = baseline ? `Linia bazowa opaski: ${Math.round(st.progress * 100)}%` : `Punkt odniesienia: ${Math.round(ses.calProgress * 100)}%`;
    const r = ses.reason && ses.reason !== 'baseline' ? REASON_TEXT[ses.reason] : '';
    if (ui.reason.textContent !== r) ui.reason.textContent = r;
  }

  // ── game ───────────────────────────────────────────────────────
  private game(): void {
    const p = this.d.settings.training;
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const num = (id: string, label: string) => {
      const v = h('b', null, '0');
      return { el: h('span', { title: label, 'aria-label': label }, icon(id), v), v };
    };
    const points = num('i-drop', 'Tlen (punkty)'), act = num('i-brain', 'Aktywność'), ctrl = num('i-gauge', 'Kontrola');
    const bar = h('div');
    const hud = h('div', { class: 'hud' + (p.hud ? '' : ' hide') }, h('div', { class: 'hud-bar' }, bar), h('div', { class: 'hud-nums' }, points.el, act.el, ctrl.el));
    const cardVal = h('b', null, '+0.0%');
    const card = h('div', { class: 'hud-card' + (p.hud ? '' : ' hide') }, icon('i-brain'), h('small', null, 'Aktywność'), cardVal);
    const cue = h('div', { class: 'cue', 'aria-live': 'polite' });
    const hold = h('div', { class: 'hold', hidden: true, role: 'status' });
    const end = h('button', { class: 'icon-btn end', type: 'button', 'aria-label': 'Zakończ sesję', on: { click: (e: Event) => { e.stopPropagation(); this.askEnd(); } } }, icon('i-close'));
    let sim: HTMLButtonElement | null = null;
    if (this.d.hub.status.source === 'simulator') {
      sim = h('button', { class: 'btn sim-focus', type: 'button', 'aria-pressed': 'false' }, '▲ Symuluj skupienie');
      sim.addEventListener('click', e => {
        e.stopPropagation();
        this.simFocus = !this.simFocus;
        sim!.setAttribute('aria-pressed', String(this.simFocus));
        sim!.classList.toggle('on', this.simFocus);
        const tool = this.session!.tool;
        this.d.hub.setSimState(this.simFocus ? (tool === 'fnirs' ? 'task' : 'focus') : (tool === 'fnirs' ? 'rest' : 'baseline'));
      });
    }
    const stage = h('div', { class: 'game', role: 'application', 'aria-label': 'Trening skupienia. Stuknij, aby ukryć lub pokazać wyniki.' },
      canvas, hud, card, cue, hold, end, sim);
    stage.addEventListener('click', () => {
      hud.classList.toggle('hide');
      card.classList.toggle('hide');
    });
    this.show(stage);
    this.ui.game = { hud, card, bar, points: points.v, act: act.v, ctrl: ctrl.v, cardVal, cue, hold, sim };
    this.renderer = new SceneRenderer(canvas, p.scene, { glow: p.glow, zoom: p.zoom });
    this.renderer.resize();
    this.d.mark('training:calibrated');
    this.scheduleCues();
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      if (!this.active || this.session?.phase !== 'game') return;
      const dt = Math.min(0.1, (t - this.lastFrame) / 1000);
      this.lastFrame = t;
      const ses = this.session;
      // draw between the 10 Hz samples: the curve scrolls smoothly
      const now = ses.gameT + Math.min(0.15, (t - this.lastSampleAt) / 1000);
      this.renderer!.draw(ses.history, now, ses.level, ses.reliable, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private scheduleCues(): void {
    this.cueTimers.forEach(clearTimeout);
    this.cueTimers = [];
    const planned = this.session!.plannedSec;
    for (const c of CUES) {
      const at = c.at === 'half' ? planned / 2 : c.at === 'last' ? planned - 30 : c.at;
      if (at < 0 || at >= planned - 5) continue;
      this.cueTimers.push(setTimeout(() => this.cue(c.text), at * 1000));
    }
  }

  private cue(text: string): void {
    const el = this.ui.game?.cue;
    if (!el || !this.active || this.shownCues.has(text)) return;
    this.shownCues.add(text);
    el.textContent = text;
    el.classList.add('show');
    this.cueTimers.push(setTimeout(() => el.classList.remove('show'), 4500));
  }

  private renderHud(): void {
    const ses = this.session!, g = this.ui.game;
    if (!g) return;
    g.bar.style.width = `${ses.progress * 100}%`;
    g.points.textContent = String(Math.floor(ses.scorer.points));
    const a = ses.level === null ? '—' : `${Math.round(ses.level)}%`;
    g.act.textContent = ses.level !== null && ses.level > 0 ? `+${a}` : a;
    g.ctrl.textContent = `${Math.round(ses.scorer.control)} s`;
    g.cardVal.textContent = signPct(ses.level);
    const reason = ses.recalibrating ? `Nowa linia bazowa — kalibruję ponownie (${Math.round(ses.meter.calProgressNow * 100)}%)`
      : ses.reliable ? '' : ses.reason ? REASON_TEXT[ses.reason] : 'Czekam na sygnał';
    g.hold.hidden = !reason;
    if (g.hold.textContent !== reason) g.hold.textContent = reason;
  }

  private onSample(sample: HubSample): void {
    const ses = this.session;
    if (!this.active || !ses || ses.phase === 'prep' || ses.phase === 'done') return;
    const was = ses.phase;
    const out = ses.onSample(sample);
    this.lastSampleAt = performance.now();
    if (was === 'calibration') {
      if (out.calibrated) this.game();
      else this.renderCalibration();
      return;
    }
    if (out.star) {
      this.audio?.star();
      this.renderer?.burst();
    }
    this.audio?.setActivity(ses.level);
    // a longer dip after a good start gets one word of encouragement
    if (ses.reliable && ses.level !== null && ses.level < -3) this.dipSec += sample.dt; else this.dipSec = 0;
    if (this.dipSec > 6 && ses.scorer.points > 20) this.cue(DIP_CUE);
    this.renderHud();
    if (out.finished) void this.complete();
  }

  private askEnd(): void {
    const ses = this.session;
    if (!ses || this.completing) return;
    const keep = ses.worthSaving;
    if (!confirm(keep ? 'Zakończyć sesję teraz? Wynik zostanie zapisany.' : 'Zakończyć sesję? Jest za krótka, by ją zapisać.')) return;
    if (keep) void this.complete();
    else this.cancel();
  }

  private stopRun(): void {
    cancelAnimationFrame(this.raf);
    this.cueTimers.forEach(clearTimeout);
    this.cueTimers = [];
    this.audio?.stop();
    this.audio = null;
    this.renderer = null;
    this.ui = {};
    if (this.simFocus) {
      this.d.hub.setSimState(this.session?.tool === 'eeg' ? 'baseline' : 'rest');
      this.simFocus = false;
    }
  }

  cancel(): void {
    if (!this.active || this.completing) return;
    if (this.session && this.session.phase !== 'calibration') this.d.mark('training:end');
    this.stopRun();
    this.session = null;
    this.leave('cancel');
  }

  private leave(next: 'again' | 'done' | 'cancel'): void {
    this.active = false;
    this.root.hidden = true;
    this.root.replaceChildren();
    document.documentElement.style.overflow = '';
    this.d.onExit(next);
  }

  // ── summary ────────────────────────────────────────────────────
  private async complete(): Promise<void> {
    const ses = this.session;
    if (!ses || this.completing) return;
    this.completing = true;
    ses.finish();
    this.stopRun();
    this.d.mark('training:end');
    const st = this.d.hub.status;
    const before = await this.d.db.listTrainings().catch(() => [] as TrainingResult[]);
    const result = ses.toResult({
      id: `focus_${Date.now()}`, source: st.source === 'device' ? 'device' : 'simulator',
      device: st.source === 'device' ? (st.device.name ?? TOOL_INFO[ses.tool].device) : 'Symulator', scene: this.d.settings.training.scene,
    });
    try {
      await this.d.db.putTraining(result);
    } catch (e) {
      toast(`Nie udało się zapisać wyniku: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    const all = [result, ...before];
    const day = dayScore(all);
    const miles = newMilestones(before, result);
    const top = isTopSession(all, result);
    this.d.onSaved(result);
    this.summary(result, day, miles, top, all.filter(r => new Date(r.start_time * 1000).toDateString() === new Date().toDateString()).length);
  }

  private summary(r: TrainingResult, day: ReturnType<typeof dayScore>, miles: { title: string }[], top: boolean, todayCount: number): void {
    const ring = h('div', { class: 'ring', role: 'img', 'aria-label': `Wynik dnia ${day.score} na 100` }, h('b', null, String(day.score)));
    ring.style.setProperty('--p', String(day.score));
    const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
    const overview = h('canvas', { class: 'overview', 'aria-label': 'Przebieg aktywności w sesji' });
    const time = new Date(r.start_time * 1000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const el = h('div', { class: 'summary' }, h('div', { class: 'summary-inner' },
      h('div', { class: 'summary-top' }, ring, h('div', null,
        h('p', { class: 'eyebrow' }, 'Wynik dnia'),
        h('h2', null, day.label),
        h('p', { class: 'muted' }, `Sesja ${todayCount} · ${time}${top && todayCount > 1 ? ' · najlepsza dziś' : ''}`),
        day.streak > 0 ? h('p', { class: 'streak mt8' }, icon('i-flame'), `${day.streak} ${day.streak === 1 ? 'dzień' : 'dni'} z rzędu`) : null)),
      miles.map(m => h('div', { class: 'milestone' }, icon('i-star'), `Nowy kamień milowy: ${m.title}`)),
      h('div', { class: 'summary-grid' },
        stat('Aktywność', signPct(r.activity_avg_pct)), stat('Kontrola', String(r.control_sec), 's'),
        stat('Tlen', String(r.points), 'p'), stat('Sesja', fmtDur(r.played_sec), 'min')),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Przebieg sesji', h('span', { class: 'hint' }, 'aktywność względem początku · linia = 0')), overview),
      h('p', { class: 'muted' }, [
        `Zaangażowanie ${day.commitment}/70 · wynik ${day.performance}/30.`,
        r.reliable_pct < 90 ? ` Sygnał wiarygodny przez ${r.reliable_pct}% czasu.` : '',
        r.source === 'simulator' ? ' Sesja na symulatorze.' : '',
        r.completed ? '' : ' Sesja zakończona przed czasem.',
      ].join('')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary big', type: 'button', on: { click: () => this.leave('again') } }, 'Nowa sesja'),
        h('button', { class: 'btn big', type: 'button', on: { click: () => this.leave('done') } }, 'Gotowe'))));
    this.show(el);
    this.session = null;
    requestAnimationFrame(() => drawOverview(overview, r.series, SCENES[this.d.settings.training.scene].fill));
  }
}
