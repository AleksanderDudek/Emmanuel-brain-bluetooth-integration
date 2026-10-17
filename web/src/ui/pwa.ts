/** Install button and the "new version" prompt (never reloads by itself during a recording). */
import { registerSW } from 'virtual:pwa-register';
import { $, toast } from './dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupPwa(isRecording: () => boolean): void {
  const btnUpdate = $<HTMLButtonElement>('btnUpdate');
  const updateSW = registerSW({
    onNeedRefresh() { btnUpdate.hidden = false; },
    onOfflineReady() { toast('Aplikacja jest gotowa do pracy offline'); },
  });
  btnUpdate.addEventListener('click', () => {
    if (isRecording() && !confirm('Trwa nagrywanie. Odświeżenie je przerwie (zapisane fragmenty zostaną). Kontynuować?')) return;
    void updateSW(true);
  });

  const btnInstall = $<HTMLButtonElement>('btnInstall');
  let deferred: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();   // show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btnInstall.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btnInstall.hidden = true; toast('Zainstalowano BrainLink'); });
}
