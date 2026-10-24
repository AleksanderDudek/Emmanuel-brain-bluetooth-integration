/** Emmanuel — Progressive Web App entry point (layout and flows: DESIGN.md). */
import './styles.css';
import { ArcadeLobby } from './arcade/lobby';
import { ArcadeRunner } from './arcade/runner';
import { Engine, type EngineFrame, type SavedEvent } from './engine';
import { EegEngine, type EegFrame } from './eeg-engine';
import { Hub, type HubStatus } from './hub';
import { applyTexts, lang } from './i18n';
import { hasPageText, pageText, t as tPage } from './i18n/page';
import { t } from './i18n/shell';
import { loadSettings, saveSettings } from './settings';
import { SessionDB } from './storage/db';
import { FolderStore } from './storage/folder';
import { SessionLibrary } from './storage/library';
import { Recorder } from './storage/recorder';
import { TOOL_INFO, type Tool } from './tools';
import type { TrainingResult } from './training/score';
import { ActivitiesView, EXERCISES, GAME_ACTIVITIES } from './ui/activities';
import { AppBar } from './ui/appbar';
import { BalanceView } from './ui/balance';
import { BuyBox } from './ui/buy';
import { DeviceSheet, simScenarioLabel, simStateLabel } from './ui/device-sheet';
import { $, h, run, toast } from './ui/dom';
import { EegMonitor } from './ui/eeg-monitor';
import { FocusRunner, FocusSetup } from './ui/focus';
import { GameLayer } from './ui/games';
import { LanguagePicker } from './ui/language';
import { renderMonitor } from './ui/monitor';
import { setupPwa } from './ui/pwa';
import { RecordingCard } from './ui/recording';
import { Router, type Route } from './ui/router';
import { SessionsView } from './ui/sessions';
import { SettingsView } from './ui/settings-view';
import { StartView } from './ui/start';
import { ScreenAwake } from './ui/wakelock';

/** index.html in this page's language: its static texts, `lang` and the title. */
function applyPageTexts(): void {
  document.documentElement.lang = lang;
  document.title = tPage('app.docTitle');
  applyTexts(document, pageText, hasPageText);
}

/** Lift the CSS guard that hides the app until its texts are in place (styles.css: `html:not([data-texts])`). */
const revealPage = (): void => { document.documentElement.dataset.texts = lang; };

async function main(): Promise<void> {
  applyPageTexts();
  const db = await SessionDB.open('brainlink', () => {
    document.body.prepend(Object.assign(document.createElement('p'), { className: 'banner', textContent: t('main.upgrade') }));
  });
  const settings = await loadSettings(db);
  const save = () => saveSettings(db, settings);
  const folder = new FolderStore(db);
  const library = new SessionLibrary(db, folder);
  const recorder = new Recorder(db);
  const recovered = await library.recoverInterrupted();
  if (recovered) toast(t('main.recovered', { n: recovered }));

  const engine = new Engine(recorder, library, settings);
  const eeg = new EegEngine();
  const hub = new Hub(engine, eeg, settings, save);
  const sheet = new DeviceSheet(hub);
  const appbar = new AppBar(hub, () => sheet.open());
  const balance = new BalanceView(engine, () => void save());
  const eegMonitor = new EegMonitor();
  const recording = new RecordingCard(engine, folder, settings, save);
  const settingsView = new SettingsView(engine, folder, settings, save, db);
  const activities = new ActivitiesView('activities', EXERCISES());
  const gameCards = new ActivitiesView('gamesList', GAME_ACTIVITIES().filter(a => a.arcade));
  const holyCards = new ActivitiesView('gamesHoly', GAME_ACTIVITIES().filter(a => !a.arcade));
  const buy = new BuyBox();
  const awake = new ScreenAwake();

  let trainings: TrainingResult[] = await db.listTrainings().catch(() => []);
  const setTrainings = (list: TrainingResult[]) => {
    trainings = list;
    start.setTrainings(list);
    if (router.current.view === 'sesje') sessions.renderTrainings(list);
  };
  const sessions = new SessionsView(library, folder, () => (recorder.recording ? recorder.meta?.session_id ?? null : null), db, setTrainings);
  const pickTool = (tool: Tool) => void appbar.switchTo(tool);
  const useSimulator = run(async () => { await hub.useSimulator(); });
  const start = new StartView({
    pickTool, connect: sheet.connect, openSheet: () => sheet.open(),
    simulator: run(async () => { await hub.useSimulator(); toast(t('common.simOn')); }),
  }, () => settings.training.scene);
  const games = new GameLayer(hub, () => router.go('gry'), () => sheet.open());
  const runner = new FocusRunner({
    hub, db, settings,
    mark: label => { if (engine.recorder.recording) engine.mark(label); },
    onSaved: r => setTrainings([r, ...trainings]),
    onExit: next => {
      if (next === 'done') router.go('start');
      else if (next === 'again') router.go('trening/focus');
    },
  });
  const focusSetup = new FocusSetup(settings, save, () => runner.start());
  const arcade = new ArcadeRunner({
    hub, db, settings,
    mark: label => { if (engine.recorder.recording) engine.mark(label); },
    onSaved: r => setTrainings([r, ...trainings]),
    onExit: () => lobby.resume(),
    history: () => trainings,
    openSheet: () => sheet.open(),
  });
  const lobby = new ArcadeLobby({ db, settings, save, onPlay: (entry, mod, progress) => {
    lobby.suspend();
    arcade.start(entry, mod, progress);
  } });

  // ── the language: choosing one reloads the app, so it asks first when that would cut something off ──
  let leaving = false;
  const bandInUse = () => { const d = hub.active?.device; return !!d && (d.isConnected || d.info.reconnecting); };
  new LanguagePicker({
    state: () => ({ band: bandInUse(), recording: recorder.recording, session: runner.active || arcade.active || games.current !== null }),
    release: async () => {
      leaving = true;   // the reload is confirmed: no second question from beforeunload
      if (recorder.recording) await engine.stopRecording();
      if (bandInUse()) await hub.disconnect();
    },
  });

  // ── views ─────────────────────────────────────────────────────────
  const onRoute = (r: Route) => {
    balance.setActive(r.view === 'balance');
    if (r.view === 'start') start.shown(); else start.hidden();
    if (r.view === 'focus') focusSetup.shown();
    if (r.view === 'trening') activities.shown();
    if (r.view === 'gry') { gameCards.shown(); holyCards.shown(); }
    if (r.view === 'arcade' && r.arcade) {
      void lobby.show(r.arcade).catch(e => toast(t('main.gameFailed', { error: e instanceof Error ? e.message : String(e) }), true));
    } else lobby.hide();
    if (r.view === 'sesje') {
      void sessions.refresh();
      sessions.renderTrainings(trainings);
    }
    if (r.view === 'ustawienia') void settingsView.renderStorage();
    if (r.game) games.open(r.game); else games.close();
    needsSig = '';
    renderStatus(hub.status);
  };
  const router = new Router(onRoute);

  /** The notices in views that need a band or a live source ("To ćwiczenie czyta tylko opaskę Mendi."). */
  let needsSig = '';
  const renderNeeds = (s: HubStatus) => {
    const sig = `${router.current.view}|${s.tool}|${s.source}`;
    if (sig === needsSig) return;
    needsSig = sig;
    for (const el of document.querySelectorAll<HTMLElement>('.needs-tool')) {
      const need = el.dataset.needs;
      const btn = (label: string, fn: () => void) => h('button', { class: 'btn', type: 'button', on: { click: fn } }, label);
      let kids: (HTMLElement | string)[] = [];
      if (need === 'fnirs' && s.tool !== 'fnirs') {
        kids = [t('needs.mendiOnly'), btn(t('common.switchToMendi'), () => pickTool('fnirs'))];
      } else if (!s.tool) {
        kids = [t('needs.choose'), btn(TOOL_INFO.fnirs.band, () => pickTool('fnirs')), btn(TOOL_INFO.eeg.band, () => pickTool('eeg'))];
      } else if (s.source === 'off') {
        kids = [t('needs.off'), btn(t('common.connectBand'), sheet.connect), btn(t('common.useSim'), useSimulator)];
      }
      el.replaceChildren(...kids);
    }
  };

  /** What the device sheet shows about the chosen band's simulator. */
  const simInfo = () => {
    if (hub.tool === 'eeg') {
      const a = eeg.simulator.autoProgress;
      return { state: eeg.simulator.state, auto: a ? { scenario: a.scenario, text: t('sheet.simStep', {
        scenario: simScenarioLabel(a.scenario), state: simStateLabel(a.current_state), step: a.step_idx + 1, total: a.total_steps,
      }) } : null };
    }
    const a = engine.simulator.autoProgress;
    return { state: engine.simulator.state, auto: a ? {
      scenario: a.scenario, text: `${simScenarioLabel(a.scenario)}: ${simStateLabel(a.state)} (${Math.round(a.elapsed_sec)}/${a.total_sec} s)`,
    } : null };
  };

  /** Gry: one line on which signal the games will read, with the action that changes it. */
  let gamesSig = '';
  const renderGamesStatus = (s: HubStatus) => {
    const live = s.source === 'simulator' || (s.source === 'device' && s.device.streaming);
    const sig = `${s.tool}|${s.source}|${live}|${s.device.name}`;
    if (sig === gamesSig) return;
    gamesSig = sig;
    const btn = (label: string, fn: () => void, primary = false) => h('button', { class: `btn${primary ? ' primary' : ''}`, type: 'button', on: { click: fn } }, label);
    let dot = 'live', text: string, actions: HTMLElement[] = [];
    if (live && s.tool === 'fnirs') {
      text = s.source === 'simulator' ? t('gry.liveSim') : t('gry.liveBand', { name: s.device.name ?? TOOL_INFO.fnirs.device });
    } else if (live && s.tool === 'eeg') {
      text = s.source === 'simulator' ? t('gry.haloSim') : t('gry.haloBand', { name: s.device.name ?? TOOL_INFO.eeg.device });
      actions = [btn(t('common.switchToMendi'), () => pickTool('fnirs'))];
    } else if (!s.tool) {
      dot = 'wait';
      text = t('gry.noTool');
      actions = [btn(t('gry.pickMendi'), () => pickTool('fnirs'), true), btn(t('gry.pickHalo'), () => pickTool('eeg'))];
    } else {
      dot = 'wait';
      text = t('gry.notConnected', { band: TOOL_INFO[s.tool].device });
      actions = [btn(t('gry.connect', { band: TOOL_INFO[s.tool].band }), sheet.connect, true), btn(t('common.useSim'), useSimulator)];
    }
    $('gamesStatus').replaceChildren(h('i', { class: `dot ${dot}` }), h('span', null, text), h('div', { class: 'row' }, actions));
  };

  let lastTool: Tool | null | undefined;
  const renderStatus = (s: HubStatus) => {
    appbar.render(s);
    sheet.render(s, s.source === 'simulator' ? simInfo() : null);
    games.render(s);
    buy.render(s);
    renderNeeds(s);
    const v = router.current.view;
    if (v === 'start') start.render(s);
    if (v === 'focus') focusSetup.render(s);
    if (v === 'arcade') lobby.render(s);
    if (v === 'trening') activities.render(s, settings.training.scene);
    if (v === 'gry') {
      gameCards.render(s, settings.training.scene);
      holyCards.render(s, settings.training.scene);
      renderGamesStatus(s);
    }
    if (s.tool !== lastTool) {
      lastTool = s.tool;
      $('monitorFnirs').hidden = s.tool !== 'fnirs';
      $('monitorEeg').hidden = s.tool !== 'eeg';
      $('sygnalLede').textContent = s.tool === 'eeg' ? t('sig.ledeEeg') : s.tool === 'fnirs' ? t('sig.ledeFnirs') : tPage('sig.lede');
    }
    awake.set(!!s.recording?.recording || (s.source === 'device' && s.device.streaming) || runner.active || arcade.active || games.current !== null);
  };

  // ── per tick ──────────────────────────────────────────────────────
  hub.addEventListener('status', e => renderStatus((e as CustomEvent<HubStatus>).detail));
  engine.addEventListener('frame', e => {
    const f = (e as CustomEvent<EngineFrame>).detail;
    balance.update(f);
    recording.render(f);
    if (hub.tool !== 'fnirs') return;
    if (router.current.view === 'sygnal') renderMonitor(f);
    $('rateText').textContent = f.measured_rate ? `${f.measured_rate} Hz` : '';
    sheet.renderDetails(f.device);
  });
  eeg.addEventListener('frame', e => {
    const f = (e as CustomEvent<EegFrame>).detail;
    if (hub.tool !== 'eeg') return;
    if (router.current.view === 'sygnal') eegMonitor.render(f);
    $('rateText').textContent = f.source === 'off' ? '' : '250 Hz';
    sheet.renderDetails(f.device);
  });
  for (const src of [engine, eeg]) src.addEventListener('error', e => toast((e as CustomEvent<string>).detail, true));
  engine.addEventListener('saved', e => {
    const r = (e as CustomEvent<SavedEvent>).detail;
    if (r.error) toast(t('rec.savedErr', { error: r.error }), true);
    else toast(r.movedToFolder ? t('rec.savedFolder') : t('rec.savedBrowser'));
    void sessions.refresh();
    void settingsView.renderStorage();
  });

  start.setTrainings(trainings);
  router.start();
  revealPage();   // the current view has rendered in this language
  hub.start();
  // ?debug: the live objects in the console (and for scripts/app-smoke.mjs)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    Object.assign(globalThis, { brainlink: { hub, engine, eeg, settings, db, router, arcade, lobby } });
  }

  // ── safety nets for recordings ────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void recorder.checkpoint();   // mobile may kill hidden tabs
  });
  window.addEventListener('beforeunload', e => {
    if (!leaving && (recorder.recording || runner.active || arcade.active)) e.preventDefault();
  });

  await Promise.all([sheet.bt.init(), settingsView.renderStorage()]);
  setupPwa(() => recorder.recording);
}

main().catch(e => {
  console.error(e);
  revealPage();
  const msg = e instanceof Error ? e.message : String(e);
  document.body.prepend(Object.assign(document.createElement('p'), { className: 'banner', textContent: t('main.failed', { error: msg }) }));
});
