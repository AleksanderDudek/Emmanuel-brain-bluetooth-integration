/** Sesje: focus-training and training-game results, and the recordings saved in the browser and in the chosen folder. */
import { arcadeEntry, resultFill } from '../arcade/registry';
import { fmtDate, fmtSigned } from '../i18n';
import { t } from '../i18n/shell';
import type { SessionDB } from '../storage/db';
import type { SessionMeta } from '../storage/format';
import { TOOL_INFO } from '../tools';
import { SCENES } from '../training/scene';
import { feelingText, type TrainingResult } from '../training/score';
import type { SceneId } from '../settings';
import { drawOverview } from './focus';
import { folderSupported, type FolderStore } from '../storage/folder';
import { download, type SessionLibrary } from '../storage/library';
import { $, fmtDur, h, run, toast } from './dom';

const where = (m: SessionMeta): string => {
  if (!m.in_browser) return t('ses.whereFolder');
  return m.storage === 'folder' ? t('ses.whereBrowserPending') : t('ses.whereBrowser');
};

export class SessionsView {
  constructor(private readonly library: SessionLibrary, private readonly folder: FolderStore,
              private readonly activeId: () => string | null, private readonly db: SessionDB,
              private readonly onTrainingsChanged: (list: TrainingResult[]) => void) {
    $('btnRefreshSessions').addEventListener('click', run(() => this.refresh()));
  }

  /** The training results, newest first, with their curves. */
  renderTrainings(list: TrainingResult[]): void {
    const FACES = ['😞', '🙁', '😐', '🙂', '😄'];
    $('trainingsHint').textContent = list.length ? t('ses.count', { n: list.length }) : '';
    const rows = list.map(r => {
      const spark = h('canvas', { 'aria-hidden': 'true' });
      const pct = r.activity_avg_pct;
      const date = fmtDate(r.start_time * 1000, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const g = r.kind === 'game' ? r.game : undefined;
      // the game's name and unit in this language (the result keeps the ones it was saved with)
      const entry = g ? arcadeEntry(g.id) : undefined;
      const title = entry?.title ?? g?.title ?? '';
      const meta = [date, fmtDur(r.played_sec) + ' min', t('ses.activity', { v: pct === null ? '—' : t('fmt.pct', { pct: fmtSigned(pct, 1) }) }),
                    t('ses.control', { n: r.control_sec }), g ? t('ses.oxygen', { n: r.points }) : '',
                    r.source === 'simulator' ? t('ses.sim', { band: TOOL_INFO[r.tool].band }) : r.device,
                    r.mood ? `${t('ses.mood', { face: FACES[r.mood.face - 1] })}${r.mood.words.length ? ' ' + r.mood.words.map(feelingText).join(', ') : ''}` : '',
                    r.completed ? '' : t('ses.interrupted')].filter(Boolean).join(' · ');
      const row = h('div', { class: 'session training' },
        g ? h('div', { class: 'num' }, String(g.score), h('small', null, entry?.unit ?? g.unit)) : h('div', { class: 'num' }, String(r.points), h('small', null, t('ses.oxygenUnit'))),
        h('div', { class: 'name' }, g ? t('ses.game', { title }) : t('ses.focus', { scene: SCENES[r.scene as SceneId]?.name ?? r.scene })),
        h('div', { class: 'meta' }, meta),
        h('div', { class: 'actions' }, spark, h('button', { class: 'btn danger', type: 'button', on: { click: run(async () => {
          if (!confirm(t('ses.deleteResult'))) return;
          await this.db.deleteTraining(r.id);
          toast(t('ses.resultDeleted'));
          this.onTrainingsChanged(await this.db.listTrainings());
        }) } }, t('common.delete'))));
      requestAnimationFrame(() => drawOverview(spark, r.series, resultFill(r)));
      return row;
    });
    $('trainingList').replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted' }, t('ses.noTrainings'))]));
  }

  async refresh(): Promise<void> {
    const list = await this.library.list();
    const rows = list.map(m => this.row(m));
    $('sessionList').replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted' }, t('ses.noRecordings'))]));
    const perm = await this.folder.permission(false);
    $('sessionsHint').textContent = perm === 'prompt' ? t('ses.folderHint') : t('ses.csvHint');
  }

  private row(m: SessionMeta): HTMLElement {
    const dur = m.end_time ? m.end_time - m.start_time : null;
    const date = fmtDate(m.start_time * 1000, { dateStyle: 'medium', timeStyle: 'short' });
    const btn = (label: string, fn: () => unknown, cls = 'btn') => h('button', { class: cls, type: 'button', on: { click: run(fn) } }, label);
    if (m.session_id === this.activeId()) {
      return h('div', { class: 'session' }, h('div', { class: 'name' }, m.name || m.session_id),
        h('div', { class: 'meta' }, `${date} · ${t('ses.recording')}`), h('div', { class: 'actions' }));
    }
    const actions = [
      btn('CSV', async () => download(await this.library.exportCsv(m), `${safe(m.name) || m.session_id}_fnirs.csv`)),
      btn('JSON', () => download(this.library.metaJson(m), `${m.session_id}_meta.json`)),
    ];
    if (m.in_browser && folderSupported()) {
      actions.push(btn(t('ses.toFolder'), async () => {
        if ((await this.folder.permission(true)) !== 'granted') throw new Error(t('ses.needFolder'));
        await this.library.moveToFolder(m);
        toast(t('ses.moved'));
        await this.refresh();
      }));
    }
    actions.push(btn(t('common.delete'), async () => {
      if (!confirm(t('ses.deleteSession', { name: m.name }))) return;
      await this.library.delete(m);
      toast(t('ses.sessionDeleted'));
      await this.refresh();
    }, 'btn danger'));
    return h('div', { class: 'session' },
      h('div', { class: 'name' }, m.name || m.session_id),
      h('div', { class: 'meta' }, [date, dur === null ? t('ses.inProgress') : fmtDur(dur), t('ses.frames', { n: m.sample_count }),
        t('ses.markers', { n: m.markers?.length ?? 0 }), m.device, where(m), m.notes].filter(Boolean).join(' · ')),
      h('div', { class: 'actions' }, actions));
  }
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
