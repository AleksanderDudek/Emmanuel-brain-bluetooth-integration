/**
 * Start: today's date, the one next step (pick a band → connect → baseline →
 * train), quick launch, and today's score with the last session.  On the first
 * run (no band chosen yet) it greets with the name and the tagline.
 */
import { arcadeEntry, gameOfDay, resultFill } from '../arcade/registry';
import type { HubStatus } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import { fmtDate, fmtSigned } from '../i18n';
import { t } from '../i18n/shell';
import type { SceneId } from '../settings';
import { TOOL_INFO, type Tool } from '../tools';
import { drawScenePreview } from '../training/scene';
import { dayScore, type TrainingResult } from '../training/score';
import { artImage, bandTags, drawArcadeCards, EXERCISES, GAME_ACTIVITIES, polishNote, whyNot, type Activity } from './activities';
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

const STEP_LABELS: [Step, string][] = [['tool', t('step.band')], ['signal', t('step.signal')], ['baseline', t('step.baseline')], ['ready', t('step.train')]];

const greeting = (d = new Date()): string => {
  const hr = d.getHours();
  return t(hr < 5 ? 'greet.night' : hr < 12 ? 'greet.morning' : hr < 18 ? 'greet.afternoon' : 'greet.evening');
};

export class StartView {
  private sig = '';
  private trainings: TrainingResult[] = [];
  private tilesFor: string | null = null;
  private visible = false;

  constructor(private readonly actions: StartActions, private readonly scene: () => SceneId) {
    document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.addEventListener('click', () => actions.pickTool(b.dataset.pick as Tool)));
    $('startDate').textContent = fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
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
    // the first run greets with the wordmark (the accent on "el", as in the app bar) and the tagline; later, the time of day
    $('startTitle').replaceChildren(...(tool ? [`${greeting()} `] : ['Emmanu', h('span', { class: 'accent' }, 'el'), '. ']),
      h('em', null, tool ? t('start.focusTime') : t('app.tagline')));
    $('startLede').textContent = tool ? `${TOOL_INFO[tool].device} (${TOOL_INFO[tool].label}). ${TOOL_INFO[tool].measures}` : t('start.intro');
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
        title = t('next.reconnectTitle');
        text = t('next.reconnectText');
        actions = [btn(t('next.bandSettings'), this.actions.openSheet)];
      } else {
        title = st.device.connected ? t('next.connected', { band: info.device }) : t('next.putOn', { band: info.device });
        text = st.device.connected ? t('next.connectedOff') : info.fit;
        actions = [btn(st.device.connected ? t('next.useBand') : t('common.connectBand'), this.actions.connect, true),
                   btn(t('common.useSim'), this.actions.simulator)];
      }
    } else if (step === 'baseline') {
      title = tool === 'fnirs' ? t('next.baselineFnirs') : t('next.warmupEeg');
      text = t('next.baselineText', { pct: Math.round(st.signal.progress * 100) });
      actions = [btn(t('common.liveSignal'), '#sygnal')];
    } else if (st.signal.reliable) {
      title = st.source === 'simulator' ? t('next.simReady') : st.signal.warning ? t('next.readyWeak') : t('next.allReady');
      text = st.source === 'simulator' ? t('next.simText')
        : st.signal.warning ? `${WARNING_TEXT[st.signal.warning]}.${st.signal.detail ? ` (${st.signal.detail})` : ''}`
        : t('next.goodText');
      actions = [btn(t('common.focusTraining'), '#trening/focus', true), btn(t('common.games'), '#gry'), btn(t('common.liveSignal'), '#sygnal')];
    } else {
      title = st.signal.reason ? REASON_TEXT[st.signal.reason] : t('next.waiting');
      text = st.signal.reason === 'poor_signal' ? info.fit : t('next.pausedText');
      actions = [btn(t('common.liveSignal'), '#sygnal'), btn(t('next.bandSettings'), this.actions.openSheet)];
    }
    $('nextTitle').textContent = title;
    $('nextText').textContent = text;
    $('nextActions').replaceChildren(...actions);
  }

  private renderTiles(tool: Tool | null): void {
    const today = gameOfDay().id;
    const key = `${tool}|${this.scene()}|${today}`;
    if (key === this.tilesFor) return;
    this.tilesFor = key;
    const tile = (a: Activity, extra = '') => {
      const why = whyNot(a, tool, true);
      const note = polishNote(a);
      return h('a', { class: `tile${a.id === 'focus' ? ' feature' : ''}${extra}`, href: a.href, 'data-activity': a.id, 'aria-disabled': String(!!why && !a.optional) },
        a.id === 'focus' ? h('canvas', { 'aria-hidden': 'true' })
          : h('div', { class: `tile-art ${a.art}` }, a.arcade ? h('canvas', { class: 'arcade-art', 'aria-hidden': 'true' }) : artImage(a)),
        h('span', { class: 'tag' }, a.id === today ? t('tag.today') : bandTags(a).join(' · ')),
        note ? h('span', { class: 'lang-note' }, note) : null,
        h('b', null, a.title),
        h('small', null, why ?? (a.id === 'focus' ? t('tile.focus') : a.arcade ? a.arcade.tagline
          : a.optional ? t('tile.holy') : t('tile.balance'))));
    };
    $('trainTiles').replaceChildren(...EXERCISES().map(a => tile(a)),
      h('a', { class: 'tile', href: '#sygnal' }, h('div', { class: 'tile-art art-signal' }), h('span', { class: 'tag' }, t('tile.live')),
        h('b', null, t('tile.signal')), h('small', null, tool === 'eeg' ? t('tile.signalEeg') : t('tile.signalFnirs'))));
    // the game of the day leads the row
    const games = GAME_ACTIVITIES().sort((a, b) => Number(b.id === today) - Number(a.id === today));
    $('gameTiles').replaceChildren(...games.map(a => tile(a, ' tile-game')));
    drawArcadeCards($('gameTiles'), games);
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
    ring.setAttribute('aria-label', t('today.ring', { score: day.score }));
    $('todayLabel').textContent = day.label;
    const todays = list.filter(r => new Date(r.start_time * 1000).toDateString() === new Date().toDateString()).length;
    $('todayMeta').textContent = `${todays ? t('today.sessions', { n: todays }) : t('today.none')} · ${t('today.streak', { n: day.streak })}`;
    const last = list[0];
    const pct = last.activity_avg_pct;
    const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
    const spark = h('canvas', { class: 'spark', 'aria-label': t('today.spark') });
    const game = last.kind === 'game' && last.game ? arcadeEntry(last.game.id)?.title ?? last.game.title : null;
    $('lastSession').replaceChildren(
      h('div', { class: 'card-head' }, game ? t('today.lastGame', { title: game }) : t('today.last'),
        h('span', { class: 'hint' }, fmtDate(last.start_time * 1000, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))),
      h('div', { class: 'last' },
        stat(t('stat.activity'), pct === null ? '—' : fmtSigned(pct, 1), pct === null ? '' : '%'), stat(t('stat.control'), String(last.control_sec), 's'),
        stat(t('stat.oxygen'), String(last.points), t('unit.points')), stat(t('stat.session'), fmtDur(last.played_sec), 'min')),
      spark);
    requestAnimationFrame(() => drawOverview(spark, last.series, resultFill(last)));
  }
}
