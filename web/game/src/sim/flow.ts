/**
 * Flow fields: Dijkstra distances to a target on a 0.5-unit grid, so shadows
 * chase (or flee) around pillars the way Pac-Man's ghosts move through the
 * maze.  540 cells — recomputed a few times per second, it costs nothing.
 */
import { pointInRect, type Rect } from './geom';
import { ROOM_H, ROOM_W } from './room';

export const CELL = 0.5;
export const GW = ROOM_W / CELL;   // 18
export const GH = ROOM_H / CELL;   // 30
const INF = 1e9;
const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14],
];

/** Cells whose centre lies inside a wall (padded a little so paths keep their distance). */
export function blockedCells(walls: readonly Rect[], pad = 0.2): Uint8Array {
  const out = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
      if (walls.some(w => pointInRect(x, y, w, pad - 1e-9))) out[gy * GW + gx] = 1;
    }
  }
  return out;
}

export const cellOf = (x: number, y: number): [number, number] => [
  Math.min(GW - 1, Math.max(0, Math.floor(x / CELL))),
  Math.min(GH - 1, Math.max(0, Math.floor(y / CELL))),
];

/** Nearest free cell to a point (targets can be inside a pillar's padding). */
export function nearestFree(blocked: Uint8Array, x: number, y: number): [number, number] {
  const [cx, cy] = cellOf(x, y);
  if (!blocked[cy * GW + cx]) return [cx, cy];
  for (let r = 1; r < Math.max(GW, GH); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && !blocked[ny * GW + nx]) return [nx, ny];
      }
    }
  }
  return [cx, cy];
}

/** Dijkstra from the target cell. Distances in tenths of a cell (10 straight, 14 diagonal). */
export function computeField(blocked: Uint8Array, tx: number, ty: number, out = new Float32Array(GW * GH)): Float32Array {
  out.fill(INF);
  const [sx, sy] = nearestFree(blocked, tx, ty);
  const heap: number[] = [];   // packed (dist * 1024 + index)
  const push = (d: number, i: number) => {
    heap.push(d * 1024 + i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p] <= heap[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l] < heap[m]) m = l;
        if (r < heap.length && heap[r] < heap[m]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const s = sy * GW + sx;
  out[s] = 0;
  push(0, s);
  while (heap.length) {
    const v = pop(), i = v % 1024, d = (v - i) / 1024;
    if (d > out[i]) continue;
    const x = i % GW, y = (i - x) / GW;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      if (blocked[ni]) continue;
      // no corner cutting past a pillar
      if (dx && dy && (blocked[y * GW + nx] || blocked[ny * GW + x])) continue;
      const nd = d + cost;
      if (nd < out[ni]) {
        out[ni] = nd;
        push(nd, ni);
      }
    }
  }
  return out;
}

/**
 * Direction to move from (x, y) following the field: downhill to approach,
 * uphill to flee.  Returns [dx, dy] normalised, or [0, 0] when stuck.
 */
export function fieldDirection(field: Float32Array, blocked: Uint8Array, x: number, y: number, flee = false): [number, number] {
  const [cx, cy] = cellOf(x, y);
  const here = field[cy * GW + cx];
  let best = here, bx = -1, by = -1;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const ni = ny * GW + nx;
    if (blocked[ni] || field[ni] >= INF) continue;
    if (dx && dy && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
    const v = field[ni];
    if (flee ? v > best : v < best) { best = v; bx = nx; by = ny; }
  }
  if (bx < 0) {
    // inside padding or at the target: head for the cell centre
    const tx = (cx + 0.5) * CELL - x, ty = (cy + 0.5) * CELL - y;
    const l = Math.hypot(tx, ty);
    return l > 0.05 && here < INF ? [tx / l, ty / l] : [0, 0];
  }
  const tx = (bx + 0.5) * CELL - x, ty = (by + 0.5) * CELL - y;
  const l = Math.hypot(tx, ty) || 1;
  return [tx / l, ty / l];
}
