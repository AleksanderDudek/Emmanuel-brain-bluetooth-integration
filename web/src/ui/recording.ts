/** The recording card in Sygnał (fNIRS): start/stop, duration, event markers. */
import type { Engine, EngineFrame } from '../engine';
import type { AppSettings } from '../settings';
import type { FolderStore } from '../storage/folder';
import { $, run, toast } from './dom';

export class RecordingCard {
  private lastRecording: boolean | null = null;

  constructor(engine: Engine, folder: FolderStore, settings: AppSettings, save: () => Promise<void>) {
    const dur = $<HTMLInputElement>('recDur');
    dur.value = String(settings.recordingDurationSec);
    $('btnRec').addEventListener('click', run(async () => {
      if (engine.source === 'off') throw new Error('Najpierw włącz źródło sygnału (przycisk opaski u góry)');
      if (settings.storageTarget === 'folder' && (await folder.permission(true)) !== 'granted') {
        toast('Brak dostępu do folderu — sesja zostanie w przeglądarce', true);
      }
      settings.recordingDurationSec = Number(dur.value) || 600;
      await save();
      await engine.startRecording($<HTMLInputElement>('recName').value, settings.recordingDurationSec);
      toast('Nagrywanie rozpoczęte');
    }));
    $('btnRecStop').addEventListener('click', run(async () => {
      if (!engine.recorder.recording) throw new Error('Nic nie jest nagrywane');
      await engine.stopRecording();
    }));
    const mark = (label: string) => {
      if (!label) return;
      toast(engine.mark(label) ? `Znacznik: ${label}` : 'Znaczniki zapisują się tylko podczas nagrywania', !engine.recorder.recording);
    };
    document.querySelectorAll<HTMLButtonElement>('[data-mark]').forEach(b => b.addEventListener('click', () => mark(b.dataset.mark!)));
    $('btnMark').addEventListener('click', () => {
      const input = $<HTMLInputElement>('markCustom');
      mark(input.value.trim());
      input.value = '';
    });
  }

  render(f: EngineFrame): void {
    const rec = f.recording.recording;
    const badge = $('recBadge');
    if (rec) {
      badge.textContent = `REC ${Math.floor(f.recording.elapsed_sec)} s · ${f.recording.markers} zn.`;
      badge.className = 'badge bad';
    } else {
      badge.textContent = 'gotowe';
      badge.className = 'badge';
    }
    if (rec !== this.lastRecording) {
      document.querySelectorAll<HTMLButtonElement>('[data-mark], #btnMark').forEach(x => {
        x.disabled = !rec;
        x.title = rec ? '' : 'Znaczniki zapisują się tylko podczas nagrywania';
      });
      $<HTMLButtonElement>('btnRec').disabled = rec;
      $<HTMLButtonElement>('btnRecStop').disabled = !rec;
      this.lastRecording = rec;
    }
  }
}
