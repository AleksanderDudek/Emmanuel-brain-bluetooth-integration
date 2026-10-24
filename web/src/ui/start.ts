/**
 * Start: today's date, the one next step (pick a band → connect → baseline →
 * train), quick launch, and today's score with the last session.
 */
import { resultFill } from '../arcade/registry';
import type { HubStatus } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import type { SceneId } from '../settings';
import { TOOL_INFO, type Tool } from '../tools';
import { drawScenePreview } from '../training/scene';
import { dayScore, type TrainingResult } from '../training/score';
import { artImage, drawArcadeCards, EXERCISES, GAME_ACTIVITIES, whyNot, type Activity } from './activities';
import { $, fmtDur, h } from './dom';
import { drawOverview } from './focus';

export interface StartActions {
  pickTool: (t: Tool) => void;
  /** straight from a click: opens the browser's Bluetooth chooser */
  connect: () => void;
  simulator: () => void;
  openSheet: () => void;
}

type Step = 'tool' | 'signal' | 'baseline' | 'ready';

const STEP_LABELS: [Step, string][] = [['tool', 'Opaska'], ['signal', 'Sygnał'], ['baseline', 'Linia bazowa'], ['ready', 'Trening']];

const greeting = (d = new Date()): string => {
  const hr = d.getHours();
  return hr < 5 ? 'Dobrej nocy' : hr < 18 ? 'Dzień dobry' : 'Dobry wieczór';
};

export class StartView {
  private sig = '';
  private trainings: TrainingResult[] = [];
  private tilesFor: string | null = null;
  private visible = false;

  constructor(private readonly actions: StartActions, private readonly scene: () => SceneId) {
    document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.addEventListener('click', () => actions.pickTool(b.dataset.pick as Tool)));
    $('startDate').textContent = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  setTrainings(list: TrainingResult[]): void {
    this.trainings = list;
    this.renderToday();
  }

  shown(): void {
    this.visible = true;
    this.tilesFor = null;
    this.sig = '';
    this.renderToday();
  }

  hidden(): void { this.visible = false; }

  private stepOf(st: HubStatus): Step {
    if (!st.tool) return 'tool';
    if (st.source === 'off' || st.signal.reason === 'no_device' || st.signal.reason === 'connecting' || st.signal.reason === 'no_data') return 'signal';
    if (st.signal.reason === 'baseline') return 'baseline';
    return 'ready';
  }

  render(st: HubStatus): void {
    if (!this.visible) return;
    const step = this.stepOf(st);
    const sig = `${st.tool}|${st.source}|${step}|${st.signal.reason}|${st.signal.warning}|${step === 'baseline' ? Math.round(st.signal.progress * 20) : ''}|${st.device.connected}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const tool = st.tool;
    $('startTitle').replaceChildren(greeting() + '. ', h('em', null, tool ? 'Czas na skupienie.' : 'Z czym dziś trenujesz?'));
    $('startLede').textContent = tool
      ? `${TOOL_INFO[tool].label} · ${TOOL_INFO[tool].device}. ${TOOL_INFO[tool].measures}`
      : 'BrainLink pracuje z opaską fNIRS Mendi albo z EEG BrainAccess HALO. Wybierz jedną — zmienisz ją w każdej chwili przełącznikiem u góry.';
    $('toolPick').hidden = !!tool;
    $('nextStep').hidden = !tool;
    if (tool) this.renderNext(st, step, tool);
    this.renderTiles(tool);
  }

  private renderNext(st: HubStatus, step: Step, tool: Tool): void {
    const order = STEP_LABELS.map(s => s[0]);
    $('steps').replaceChildren(...STEP_LABELS.map(([id, label]) => h('li', {
      class: order.indexOf(id) < order.indexOf(step) ? 'done' : id === step ? 'now' : '',
    }, label)));
    const info = TOOL_INFO[tool];
    const bar = $('nextProgress');
    bar.hidden = step !== 'baseline';
    (bar.firstElementChild as HTMLElement).style.width = `${Math.round(st.signal.progress * 100)}%`;
    const btn = (label: string, onClick: (() => void) | string, primary = false) => typeof onClick === 'string'
      ? h('a', { class: 'btn' + (primary ? ' primary' : ''), href: onClick }, label)
      : h('button', { class: 'btn' + (primary ? ' primary' : ''), type: 'button', on: { click: onClick } }, label);
    let title: string, text: string;
    let actions: HTMLElement[];
    if (step === 'signal') {
      if (st.signal.reason === 'connecting') {
        title = 'Łączę ponownie z opaską…';
        text = 'Opaska zniknęła z zasięgu. Zbliż się do komputera — połączenie wróci samo.';
        actions = [btn('Ustawienia opaski', this.actions.openSheet)];
      } else {
        title = st.device.connected ? `${info.device} połączona` : `Załóż i połącz ${info.device}`;
        text = st.device.connected ? 'Opaska jest połączona, ale źródło sygnału jest wyłączone.' : info.fit;
        actions = [btn(st.device.connected ? 'Użyj opaski' : 'Połącz opaskę', this.actions.connect, true),
                   btn('Użyj symulatora', this.actions.simulator)];
      }
    } else if (step === 'baseline') {
      title = tool === 'fnirs' ? 'Zbieram linię bazową' : 'Rozgrzewam sygnał';
      text = `Siedź spokojnie i oddychaj swobodnie — ${Math.round(st.signal.progress * 100)}%.`;
      actions = [btn('Sygnał na żywo', '#sygnal')];
    } else if (st.signal.reliable) {
      title = st.source === 'simulator' ? 'Symulator gotowy' : st.signal.warning ? 'Gotowe — sygnał słaby' : 'Wszystko gotowe';
      text = st.source === 'simulator' ? 'Sztuczny sygnał — dobry do zapoznania się z treningiem.'
        : st.signal.warning ? `${WARNING_TEXT[st.signal.warning]}.${st.signal.detail ? ` (${st.signal.detail})` : ''}`
        : 'Sygnał dobry. Wybierz ćwiczenie albo zacznij od treningu skupienia.';
      actions = [btn('Trening skupienia', '#trening/focus', true), btn('Gry', '#gry'), btn('Sygnał na żywo', '#sygnal')];
    } else {
      title = st.signal.reason ? REASON_TEXT[st.signal.reason] : 'Czekam na sygnał';
      text = st.signal.reason === 'poor_signal' ? info.fit : 'Trening wstrzyma punkty, dopóki sygnał się nie poprawi.';
      actions = [btn('Sygnał na żywo', '#sygnal'), btn('Ustawienia opaski', this.actions.openSheet)];
    }
    $('nextTitle').textContent = title;
    $('nextText').textContent = text;
    $('nextActions').replaceChildren(...actions);
  }

  private renderTiles(tool: Tool | null): void {
    const key = `${tool}|${this.scene()}`;
    if (key === this.tilesFor) return;
    this.tilesFor = key;
    const tile = (a: Activity, extra = '') => {
      const why = whyNot(a, tool);
      return h('a', { class: `tile${a.id === 'focus' ? ' feature' : ''}${extra}`, href: a.href, 'data-activity': a.id, 'aria-disabled': String(!!why && !a.optional) },
        a.id === 'focus' ? h('canvas', { 'aria-hidden': 'true' })
          : h('div', { class: `tile-art ${a.art}` }, a.arcade ? h('canvas', { class: 'arcade-art', 'aria-hidden': 'true' }) : artImage(a)),
        h('span', { class: 'tag' }, a.tools.map(t => (t === 'fnirs' ? 'fNIRS' : 'EEG')).join(' · ') + (a.optional ? ' · opcjonalnie' : '')),
        h('b', null, a.title),
        h('small', null, why ?? (a.id === 'focus' ? 'Utrzymaj kulę wysoko — 3 do 15 minut.' : a.arcade ? a.arcade.tagline
          : a.optional ? 'Przejmie opaskę połączoną w BrainLink.' : 'Zadania dobierane do półkul.')));
    };
    $('trainTiles').replaceChildren(...EXERCISES().map(a => tile(a)),
      h('a', { class: 'tile', href: '#sygnal' }, h('div', { class: 'tile-art art-signal' }), h('span', { class: 'tag' }, 'na żywo'),
        h('b', null, 'Sygnał'), h('small', null, tool === 'eeg' ? 'Fale, pasma, metryki EEG.' : 'ΔHbO/ΔHbR, tętno, jakość, nagrywanie.')));
    $('gameTiles').replaceChildren(...GAME_ACTIVITIES().map(a => tile(a, ' tile-game')));
    drawArcadeCards($('gameTiles'), GAME_ACTIVITIES());
    const canvas = $('trainTiles').querySelector<HTMLCanvasElement>('.tile.feature canvas');
    if (canvas) requestAnimationFrame(() => drawScenePreview(canvas, this.scene()));
  }

  private renderToday(): void {
    const list = this.trainings;
    $('today').hidden = !list.length;
    if (!list.length || !this.visible) return;
    const day = dayScore(list);
    const ring = $('todayRing');
    ring.style.setProperty('--p', String(day.score));
    ring.replaceChildren(h('b', null, String(day.score)));
    ring.setAttribute('aria-label', `Wynik dnia ${day.score} na 100`);
    $('todayLabel').textContent = day.label;
    const todays = list.filter(r => new Date(r.start_time * 1000).toDateString() === new Date().toDateString()).length;
    $('todayMeta').textContent = `${todays ? `${todays} ${todays === 1 ? 'sesja' : 'sesje'} dziś` : 'Dziś jeszcze bez sesji'} · seria ${day.streak} ${day.streak === 1 ? 'dzień' : 'dni'}`;
    const last = list[0];
    const pct = last.activity_avg_pct;
    const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
    const spark = h('canvas', { class: 'spark', 'aria-label': 'Przebieg ostatniej sesji' });
    $('lastSession').replaceChildren(
      h('div', { class: 'card-head' }, last.kind === 'game' && last.game ? `Ostatnia sesja · ${last.game.title}` : 'Ostatnia sesja',
        h('span', { class: 'hint' }, new Date(last.start_time * 1000).toLocaleString('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))),
      h('div', { class: 'last' },
        stat('Aktywność', pct === null ? '—' : `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`), stat('Kontrola', String(last.control_sec), 's'),
        stat('Tlen', String(last.points), 'p'), stat('Sesja', fmtDur(last.played_sec), 'min')),
      spark);
    requestAnimationFrame(() => drawOverview(spark, last.series, resultFill(last)));
  }
}
