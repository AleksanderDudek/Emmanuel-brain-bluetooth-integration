/** The recording card in Sygnał (fNIRS): start/stop, duration, event markers. */
import type { Engine, EngineFrame } from '../engine';
import type { AppSettings } from '../settings';
import type { FolderStore } from '../storage/folder';
import { t } from '../i18n/shell';
import { $, run, toast } from './dom';

export class RecordingCard {
  private lastRecording: boolean | null = null;

  constructor(engine: Engine, folder: FolderStore, settings: AppSettings, save: () => Promise<void>) {
    const dur = $<HTMLInputElement>('recDur');
    dur.value = String(settings.recordingDurationSec);
    $('btnRec').addEventListener('click', run(async () => {
      if (engine.source === 'off') throw new Error(t('rec.needSource'));
      if (settings.storageTarget === 'folder' && (await folder.permission(true)) !== 'granted') {
        toast(t('rec.noFolder'), true);
      }
      settings.recordingDurationSec = Number(dur.value) || 600;
      await save();
      await engine.startRecording($<HTMLInputElement>('recName').value, settings.recordingDurationSec);
      toast(t('rec.started'));
    }));
    $('btnRecStop').addEventListener('click', run(async () => {
      if (!engine.recorder.recording) throw new Error(t('rec.nothing'));
      await engine.stopRecording();
    }));
    const mark = (label: string) => {
      if (!label) return;
      toast(engine.mark(label) ? t('rec.marked', { label }) : t('rec.marksOnlyRec'), !engine.recorder.recording);
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
      badge.textContent = t('rec.badge', { s: Math.floor(f.recording.elapsed_sec), m: f.recording.markers });
      badge.className = 'badge bad';
    } else {
      badge.textContent = t('rec.ready');
      badge.className = 'badge';
    }
    if (rec !== this.lastRecording) {
      document.querySelectorAll<HTMLButtonElement>('[data-mark], #btnMark').forEach(x => {
        x.disabled = !rec;
        x.title = rec ? '' : t('rec.marksOnlyRec');
      });
      $<HTMLButtonElement>('btnRec').disabled = rec;
      $<HTMLButtonElement>('btnRecStop').disabled = !rec;
      this.lastRecording = rec;
    }
  }
}
