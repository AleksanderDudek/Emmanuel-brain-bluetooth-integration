/** Small DOM helpers. Everything is built with createElement/textContent — no innerHTML. */

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

type Kid = Node | string | number | null | undefined | false | Kid[];

/** h('p', {class: 'x', on: {click}}, 'text', child) — strings become text nodes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props?: Record<string, unknown> | null, ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = String(v);
    else if (k === 'on') Object.entries(v as Record<string, EventListener>).forEach(([ev, fn]) => n.addEventListener(ev, fn));
    else n.setAttribute(k, String(v));
  }
  const add = (c: Kid): void => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else n.append(c instanceof Node ? c : String(c));
  };
  kids.forEach(add);
  return n;
}

export const fmt = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d);

export const fmtDur = (s: number | null | undefined): string => {
  const t = Math.max(0, Math.round(s ?? 0));
  const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
};

export const fmtBytes = (b: number | null): string => {
  if (b === null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, err = false): void {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

/** Wrap an async handler: errors become a red toast instead of an unhandled rejection. */
export const run = <A extends unknown[]>(fn: (...a: A) => unknown) => async (...a: A): Promise<void> => {
  try {
    await fn(...a);
  } catch (e) {
    console.error(e);
    toast(e instanceof Error ? e.message : String(e), true);
  }
};

/** Replace the children of `el` with `kids`. */
export const fill = (el: Element, ...kids: Kid[]): void => {
  const tmp = h('div', null, ...kids);
  el.replaceChildren(...tmp.childNodes);
};
