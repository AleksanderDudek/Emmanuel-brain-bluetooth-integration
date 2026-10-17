/** Monitor tab: haemodynamics, heart rate, metrics, signal quality, raw frame. */
import { OPTICAL_CHANNELS, type ChannelQuality, type OpticalChannel } from '../core/types';
import type { EngineFrame } from '../engine';
import { cssVar, drawLines } from './charts';
import { $, fill, fmt, h } from './dom';

const QL: Record<ChannelQuality['label'], string> = {
  good: 'dobra', fair: 'średnia', poor: 'słaba', light_leak: 'przeciek światła', no_signal: 'brak sygnału', warming_up: 'rozgrzewanie',
};
export const CHN: Record<OpticalChannel, string> = { left: 'lewy', right: 'prawy', pulse: 'puls' };

const pair = (hbo: number | null | undefined, hbr: number | null | undefined) =>
  [h('span', { class: 'hbo' }, fmt(hbo, 3)), ' / ', h('span', { class: 'hbr' }, fmt(hbr, 3))];

export function renderMonitor(f: EngineFrame): void {
  if (f.source === 'off' || !f.config) return;
  const progress = f.baseline_progress ?? 0;
  $('baselineBox').hidden = !!f.baseline_ready;
  $('baselinePct').textContent = `${Math.round(progress * 100)}%`;
  $('baselineBar').style.width = `${progress * 100}%`;

  $('hr').textContent = f.heart_rate_bpm ? String(Math.round(f.heart_rate_bpm)) : '—';
  const avg = (o?: Record<'left' | 'right', number | null>) => (o && o.left !== null && o.right !== null ? (o.left + o.right) / 2 : null);
  $('hboAvg').textContent = fmt(avg(f.hbo), 3);
  $('hbrAvg').textContent = fmt(avg(f.hbr), 3);
  const motion = $('motion');
  motion.textContent = f.motion ? 'TAK' : 'nie';
  motion.style.color = f.motion ? cssVar('--amber') : '';

  const p = f.preview;
  if (p) {
    const colors = [cssVar('--hbo'), cssVar('--hbr')];
    drawLines($<HTMLCanvasElement>('chartL'), [p.hbo.left, p.hbr.left], colors);
    drawLines($<HTMLCanvasElement>('chartR'), [p.hbo.right, p.hbr.right], colors);
    drawLines($<HTMLCanvasElement>('chartPulse'), [p.pulse_ir], [cssVar('--pink')], false);
    fill($('valL'), pair(f.hbo?.left, f.hbr?.left));
    fill($('valR'), pair(f.hbo?.right, f.hbr?.right));
  }

  const m = f.metrics;
  $('barAct').style.width = `${(m?.activation ?? 0) * 100}%`;
  $('valAct').textContent = fmt(m?.activation);
  $('barAsym').style.width = `${(m?.asymmetry ?? 0) * 100}%`;
  $('valAsym').textContent = fmt(m?.asymmetry);

  if (f.quality) {
    fill($('quality'), OPTICAL_CHANNELS.map(ch => {
      const q = f.quality![ch];
      return h('div', { class: `qc ${q.label}` },
        h('div', { class: 'n' }, CHN[ch]),
        h('div', { class: 'l' }, QL[q.label] ?? q.label),
        h('div', { class: 'd' }, `SCI ${fmt(q.sci)} · amb ${q.ambient_ratio === null ? '—' : Math.round(q.ambient_ratio * 100) + '%'}`));
    }));
  }

  if (f.raw) {
    const imu = f.imu;
    fill($('rawKv'),
      OPTICAL_CHANNELS.map(ch => [h('span', null, CHN[ch]), h('span', null, `IR ${f.raw![ch].ir} · RED ${f.raw![ch].red} · AMB ${f.raw![ch].amb}`)]),
      h('span', null, 'akcel.'), h('span', null, `${(imu?.accel_g ?? []).map(v => fmt(v, 2)).join(' / ')} g`),
      h('span', null, 'żyroskop'), h('span', null, `${(imu?.gyro_dps ?? []).map(v => fmt(v, 1)).join(' / ')} °/s`),
      h('span', null, 'temp.'), h('span', null, `${fmt(imu?.temp_c, 1)} °C`),
      h('span', null, 'ramki'), h('span', null, String(f.total_frames ?? 0)),
      h('span', null, 'częstotliwość'), h('span', null, `${fmt(f.sample_rate, 1)} Hz (zmierzona ${fmt(f.measured_rate, 1)})`));
  }
}
