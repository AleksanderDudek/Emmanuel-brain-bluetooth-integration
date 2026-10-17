/** Minimal canvas line charts (port of drawLines() from dashboard/fnirs.html). */

function setupCanvas(c: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  c.width = Math.max(1, r.width * dpr);
  c.height = Math.max(1, r.height * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

export const cssVar = (n: string): string => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function drawLines(canvas: HTMLCanvasElement, series: number[][], colors: string[], symmetric = true): void {
  if (!canvas.getBoundingClientRect().width) return;   // hidden tab
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const all = series.flat().filter(Number.isFinite);
  if (!all.length) return;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (symmetric) {
    const m = Math.max(Math.abs(lo), Math.abs(hi), 0.2);
    lo = -m; hi = m;
  } else {
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;
  }
  const top = 18, bot = 6;
  const y = (v: number) => top + (h - top - bot) * (1 - (v - lo) / (hi - lo));
  if (symmetric) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(w, y(0)); ctx.stroke();
    ctx.fillStyle = cssVar('--tx3');
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('+' + hi.toFixed(2), 4, top + 8);
    ctx.fillText(lo.toFixed(2), 4, h - bot - 2);
  }
  series.forEach((s, i) => {
    if (s.length < 2) return;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    s.forEach((v, k) => {
      const x = (w * k) / (s.length - 1);
      if (k) ctx.lineTo(x, y(v)); else ctx.moveTo(x, y(v));
    });
    ctx.stroke();
  });
}
