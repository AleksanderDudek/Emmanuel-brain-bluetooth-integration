/** BrainLink fNIRS — Progressive Web App entry point. */
import './styles.css';
import { Engine, type EngineFrame, type SavedEvent } from './engine';
import { loadSettings, saveSettings } from './settings';
import { SessionDB } from './storage/db';
import { FolderStore } from './storage/folder';
import { SessionLibrary } from './storage/library';
import { Recorder } from './storage/recorder';
import { BalanceView } from './ui/balance';
import { BluetoothUi } from './ui/bluetooth';
import { Controls } from './ui/controls';
import { $, toast } from './ui/dom';
import { renderMonitor } from './ui/monitor';
import { setupPwa } from './ui/pwa';
import { SessionsView } from './ui/sessions';
import { ScreenAwake } from './ui/wakelock';

type View = 'monitor' | 'balance' | 'sessions';

async function main(): Promise<void> {
  const db = await SessionDB.open();
  const settings = await loadSettings(db);
  const save = () => saveSettings(db, settings);
  const folder = new FolderStore(db);
  const library = new SessionLibrary(db, folder);
  const recorder = new Recorder(db);
  const recovered = await library.recoverInterrupted();
  if (recovered) toast(`Odzyskano ${recovered} przerwane nagranie(a) — zobacz „Sesje”`);

  const engine = new Engine(recorder, library, settings);
  let controls: Controls | null = null;
  const bt = new BluetoothUi(() => controls?.connect());
  controls = new Controls(engine, folder, settings, save, bt);
  controls.init();
  const balance = new BalanceView(engine, () => void save());
  const sessions = new SessionsView(library, folder, () => (recorder.recording ? recorder.meta?.session_id ?? null : null));
  const awake = new ScreenAwake();

  // ── tabs (deep links: #balance, #sessions) ─────────────────────────
  const views: View[] = ['monitor', 'balance', 'sessions'];
  const tabId = (v: View) => `tab${v[0].toUpperCase()}${v.slice(1)}`;
  const viewId = (v: View) => `view${v[0].toUpperCase()}${v.slice(1)}`;
  const show = (name: View) => {
    for (const v of views) {
      $(viewId(v)).hidden = v !== name;
      $(tabId(v)).setAttribute('aria-selected', String(v === name));
      $(tabId(v)).tabIndex = v === name ? 0 : -1;   // roving tabindex (ARIA tabs pattern)
    }
    balance.setActive(name === 'balance');
    if (name === 'sessions') void sessions.refresh();
    const want = name === 'monitor' ? '' : `#${name}`;
    if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search);
  };
  const fromHash = (): View => (views.includes(location.hash.slice(1) as View) ? (location.hash.slice(1) as View) : 'monitor');
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view as View)));
  document.querySelector('[role=tablist]')!.addEventListener('keydown', e => {
    const k = (e as KeyboardEvent).key;
    const i = views.indexOf(fromHash());
    const next = k === 'ArrowRight' ? (i + 1) % views.length : k === 'ArrowLeft' ? (i + views.length - 1) % views.length
      : k === 'Home' ? 0 : k === 'End' ? views.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    show(views[next]);
    $(tabId(views[next])).focus();
  });
  window.addEventListener('hashchange', () => show(fromHash()));
  show(fromHash());

  // ── frame loop ────────────────────────────────────────────────────
  engine.addEventListener('frame', e => {
    const f = (e as CustomEvent<EngineFrame>).detail;
    controls!.renderFrame(f);
    balance.update(f);
    renderMonitor(f);
    awake.set(f.recording.recording || (f.source === 'device' && f.device.streaming));
  });
  engine.addEventListener('error', e => toast((e as CustomEvent<string>).detail, true));
  engine.addEventListener('saved', e => {
    const r = (e as CustomEvent<SavedEvent>).detail;
    if (r.error) toast(`Zapisano w przeglądarce. ${r.error}`, true);
    else toast(r.movedToFolder ? 'Sesja zapisana w folderze' : 'Sesja zapisana w przeglądarce');
    void sessions.refresh();
    void controls!.renderStorage();
  });
  engine.start();

  // ── safety nets for recordings ────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void recorder.checkpoint();   // mobile may kill hidden tabs
  });
  window.addEventListener('beforeunload', e => {
    if (recorder.recording) e.preventDefault();
  });

  await Promise.all([bt.init(), controls.renderStorage()]);
  setupPwa(() => recorder.recording);
}

main().catch(e => {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  document.body.prepend(Object.assign(document.createElement('p'), {
    className: 'banner', textContent: `Nie udało się uruchomić aplikacji: ${msg}. Sprawdź, czy przeglądarka nie blokuje IndexedDB (tryb prywatny).`,
  }));
});
