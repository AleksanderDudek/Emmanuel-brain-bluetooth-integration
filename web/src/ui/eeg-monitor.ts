/** Sygnał for EEG: metrics, electrode contact, combos, traces and band powers (like the server's dashboard). */
import { BAND_NAMES, EEG_CHANNELS, EEG_METRICS, type EegChannel, type EegMetric } from '../core/eeg/types';
import type { EegContact, EegFrame } from '../eeg-engine';
import { t } from '../i18n/signal';
import { cssVar, drawLines } from './charts';
import { $, fmt, h } from './dom';

const METRIC_LABELS = Object.fromEntries(EEG_METRICS.map(m => [m, t(`eeg.${m}`)])) as Record<EegMetric, string>;
const CONTACT_LABELS: Record<EegContact, string> = {
  good: t('contact.good'), flat: t('contact.flat'), noisy: t('contact.noisy'), warming_up: t('contact.warming_up'),
};
const COMBO_LABELS: Record<string, string> = {
  super_flow: t('combo.super_flow'), panic: t('combo.panic'), zen_heal: t('combo.zen_heal'), berserker: t('combo.berserker'),
};

export class EegMonitor {
  private readonly bars = new Map<EegMetric, { fill: HTMLElement; val: HTMLElement }>();
  private readonly waves = new Map<EegChannel, HTMLCanvasElement>();
  private readonly bandBars = new Map<EegChannel, HTMLElement[]>();
  private readonly stats: Record<'focus' | 'calm' | 'blinks' | 'contact', HTMLElement>;
  private comboSig: string | null = null;

  constructor() {
    const stat = (k: string, unit = '') => {
      const v = h('span', null, '—');
      return { el: h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null)), v };
    };
    const s = { focus: stat(METRIC_LABELS.focus, '%'), calm: stat(METRIC_LABELS.calm, '%'), blinks: stat(t('eeg.blinks'), '/s'), contact: stat(t('eeg.contact'), '/ 4') };
    $('eegStats').replaceChildren(...Object.values(s).map(x => x.el));
    this.stats = { focus: s.focus.v, calm: s.calm.v, blinks: s.blinks.v, contact: s.contact.v };
    $('eegMetrics').replaceChildren(...EEG_METRICS.map(m => {
      const fill = h('div', { class: 'metric-bar-fill tool' }), val = h('span', { class: 'metric-val' }, '—');
      this.bars.set(m, { fill, val });
      return h('div', { class: 'metric-row' }, h('span', { class: 'metric-label' }, METRIC_LABELS[m]), h('div', { class: 'metric-bar-bg' }, fill), val);
    }));
    $('eegWaves').replaceChildren(...EEG_CHANNELS.map(ch => {
      const c = h('canvas', { class: 'short' });
      this.waves.set(ch, c);
      return h('div', { class: 'chart' }, h('span', { class: 'lbl' }, ch), c);
    }));
    $('eegBands').replaceChildren(...EEG_CHANNELS.map(ch => {
      const bars = BAND_NAMES.map(b => h('i', { class: `b-${b}`, title: b }));
      this.bandBars.set(ch, bars);
      return h('div', { class: 'band-cell' }, h('div', { class: 'ch' }, ch), h('div', { class: 'band-bars' }, bars),
        h('div', { class: 'band-names' }, BAND_NAMES.map(b => h('span', null, b[0].toUpperCase()))));
    }));
  }

  render(f: EegFrame): void {
    const m = f.metrics;
    for (const k of EEG_METRICS) {
      const b = this.bars.get(k)!;
      b.fill.style.width = `${(m?.[k] ?? 0) * 100}%`;
      b.val.textContent = fmt(m?.[k]);
    }
    this.stats.focus.textContent = m ? String(Math.round(m.focus * 100)) : '—';
    this.stats.calm.textContent = m ? String(Math.round(m.calm * 100)) : '—';
    this.stats.blinks.textContent = f.blink_count === null ? '—' : String(f.blink_count);
    this.stats.contact.textContent = String(EEG_CHANNELS.filter(ch => f.contact[ch].label === 'good').length);

    $('eegContact').replaceChildren(...EEG_CHANNELS.map(ch => {
      const c = f.contact[ch];
      return h('div', { class: `qc ${c.label}` }, h('div', { class: 'n' }, ch), h('div', { class: 'l' }, CONTACT_LABELS[c.label]),
        h('div', { class: 'd' }, c.sd === null ? '—' : `SD ${c.sd} µV`));
    }));
    const sig = f.active_combos.join(',');
    if (sig !== this.comboSig) {
      this.comboSig = sig;
      $('eegCombos').replaceChildren(...(f.active_combos.length
        ? f.active_combos.map(c => h('span', { class: 'combo' }, COMBO_LABELS[c] ?? c))
        : [h('span', { class: 'muted' }, t('eeg.noCombos'))]));
    }
    if (f.preview) {
      const color = cssVar('--tool');
      for (const ch of EEG_CHANNELS) drawLines(this.waves.get(ch)!, [f.preview[ch]], [color], true);
    }
    if (f.band_powers) {
      // log scale: band powers span three decades
      const lg = (v: number) => Math.log10(Math.max(v, 1e-3));
      const all = EEG_CHANNELS.flatMap(ch => BAND_NAMES.map(b => lg(f.band_powers![ch][b])));
      const lo = Math.min(...all), hi = Math.max(...all, lo + 1e-6);
      for (const ch of EEG_CHANNELS) {
        this.bandBars.get(ch)!.forEach((el, i) => {
          const v = f.band_powers![ch][BAND_NAMES[i]];
          el.style.height = `${8 + (92 * (lg(v) - lo)) / (hi - lo)}%`;
          el.title = `${BAND_NAMES[i]}: ${v.toFixed(2)} µV²/Hz`;
        });
      }
    }
  }
}
