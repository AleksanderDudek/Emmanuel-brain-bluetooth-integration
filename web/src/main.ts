/** BrainLink — Progressive Web App entry point (layout and flows: DESIGN.md). */
import './styles.css';
import { Engine, type EngineFrame, type SavedEvent } from './engine';
import { EegEngine, type EegFrame } from './eeg-engine';
import { Hub, type HubStatus } from './hub';
import { loadSettings, saveSettings } from './settings';
import { SessionDB } from './storage/db';
import { FolderStore } from './storage/folder';
import { SessionLibrary } from './storage/library';
import { Recorder } from './storage/recorder';
import type { Tool } from './tools';
import type { TrainingResult } from './training/score';
import { ActivitiesView } from './ui/activities';
import { AppBar } from './ui/appbar';
import { BalanceView } from './ui/balance';
import { DeviceSheet } from './ui/device-sheet';
import { $, h, run, toast } from './ui/dom';
import { EegMonitor } from './ui/eeg-monitor';
import { FocusRunner, FocusSetup } from './ui/focus';
import { GameLayer } from './ui/games';
import { renderMonitor } from './ui/monitor';
import { setupPwa } from './ui/pwa';
import { RecordingCard } from './ui/recording';
import { Router, type Route } from './ui/router';
import { SessionsView } from './ui/sessions';
import { SettingsView } from './ui/settings-view';
import { StartView } from './ui/start';
import { ScreenAwake } from './ui/wakelock';

async function main(): Promise<void> {
  const db = await SessionDB.open('brainlink', () => {
    document.body.prepend(Object.assign(document.createElement('p'), {
      className: 'banner', textContent: 'Aktualizacja czeka: zamknij inne otwarte karty BrainLink, a ta strona uruchomi się sama.',
    }));
  });
  const settings = await loadSettings(db);
  const save = () => saveSettings(db, settings);
  const folder = new FolderStore(db);
  const library = new SessionLibrary(db, folder);
  const recorder = new Recorder(db);
  const recovered = await library.recoverInterrupted();
  if (recovered) toast(`Odzyskano ${recovered} przerwane nagranie(a) — zobacz „Sesje”`);

  const engine = new Engine(recorder, library, settings);
  const eeg = new EegEngine();
  const hub = new Hub(engine, eeg, settings, save);
  const sheet = new DeviceSheet(hub);
  const appbar = new AppBar(hub, () => sheet.open());
  const balance = new BalanceView(engine, () => void save());
  const eegMonitor = new EegMonitor();
  const recording = new RecordingCard(engine, folder, settings, save);
  const settingsView = new SettingsView(engine, folder, settings, save, db);
  const activities = new ActivitiesView();
  const awake = new ScreenAwake();

  let trainings: TrainingResult[] = await db.listTrainings().catch(() => []);
  const setTrainings = (list: TrainingResult[]) => {
    trainings = list;
    start.setTrainings(list);
    if (router.current.view === 'sesje') sessions.renderTrainings(list);
  };
  const sessions = new SessionsView(library, folder, () => (recorder.recording ? recorder.meta?.session_id ?? null : null), db, setTrainings);
  const pickTool = (t: Tool) => void appbar.switchTo(t);
  const start = new StartView({
    pickTool, connect: sheet.connect, openSheet: () => sheet.open(),
    simulator: run(async () => { await hub.useSimulator(); toast('Symulator włączony'); }),
  }, () => settings.training.scene);
  const games = new GameLayer(hub, () => router.go('trening'), () => sheet.open());
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

  // ── views ─────────────────────────────────────────────────────────
  const onRoute = (r: Route) => {
    balance.setActive(r.view === 'balance');
    if (r.view === 'start') start.shown(); else start.hidden();
    if (r.view === 'focus') focusSetup.shown();
    if (r.view === 'trening') activities.shown();
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

  /** The notices in views that need a tool or a live source ("Ten trening wymaga…"). */
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
        kids = ['To ćwiczenie czyta opaskę fNIRS (Mendi).', btn('Przełącz na fNIRS', () => pickTool('fnirs'))];
      } else if (!s.tool) {
        kids = ['Wybierz opaskę:', btn('fNIRS · Mendi', () => pickTool('fnirs')), btn('EEG · HALO', () => pickTool('eeg'))];
      } else if (s.source === 'off') {
        kids = ['Źródło sygnału jest wyłączone.', btn('Połącz opaskę', sheet.connect),
                btn('Użyj symulatora', run(async () => { await hub.useSimulator(); }))];
      }
      el.replaceChildren(...kids);
    }
  };

  /** What the device sheet shows about the active tool's simulator. */
  const simInfo = () => {
    if (hub.tool === 'eeg') {
      const a = eeg.simulator.autoProgress;
      return { state: eeg.simulator.state, auto: a ? { scenario: a.scenario, text: `${a.scenario}: ${a.current_state} (krok ${a.step_idx + 1}/${a.total_steps})` } : null };
    }
    const a = engine.simulator.autoProgress;
    return { state: engine.simulator.state, auto: a ? { scenario: a.scenario, text: `${a.scenario}: ${a.state} (${Math.round(a.elapsed_sec)}/${a.total_sec} s)` } : null };
  };

  let lastTool: Tool | null | undefined;
  const renderStatus = (s: HubStatus) => {
    appbar.render(s);
    sheet.render(s, s.source === 'simulator' ? simInfo() : null);
    games.render(s);
    renderNeeds(s);
    const v = router.current.view;
    if (v === 'start') start.render(s);
    if (v === 'focus') focusSetup.render(s);
    if (v === 'trening') activities.render(s, settings.training.scene);
    if (s.tool !== lastTool) {
      lastTool = s.tool;
      $('monitorFnirs').hidden = s.tool !== 'fnirs';
      $('monitorEeg').hidden = s.tool !== 'eeg';
      $('sygnalLede').textContent = s.tool === 'eeg' ? 'EEG z BrainAccess HALO na żywo.' : s.tool === 'fnirs' ? 'Hemodynamika kory przedczołowej z opaski Mendi na żywo.' : 'Dane z opaski na żywo.';
    }
    awake.set(!!s.recording?.recording || (s.source === 'device' && s.device.streaming) || runner.active || games.current !== null);
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
    if (r.error) toast(`Zapisano w przeglądarce. ${r.error}`, true);
    else toast(r.movedToFolder ? 'Sesja zapisana w folderze' : 'Sesja zapisana w przeglądarce');
    void sessions.refresh();
    void settingsView.renderStorage();
  });

  start.setTrainings(trainings);
  router.start();
  hub.start();
  // ?debug: the live objects in the console (and for scripts/app-smoke.mjs)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    Object.assign(globalThis, { brainlink: { hub, engine, eeg, settings, db, router } });
  }

  // ── safety nets for recordings ────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void recorder.checkpoint();   // mobile may kill hidden tabs
  });
  window.addEventListener('beforeunload', e => {
    if (recorder.recording || runner.active) e.preventDefault();
  });

  await Promise.all([sheet.bt.init(), settingsView.renderStorage()]);
  setupPwa(() => recorder.recording);
}

main().catch(e => {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  document.body.prepend(Object.assign(document.createElement('p'), {
    className: 'banner', textContent: `Nie udało się uruchomić aplikacji: ${msg}. Sprawdź, czy przeglądarka nie blokuje IndexedDB (tryb prywatny).`,
  }));
});
