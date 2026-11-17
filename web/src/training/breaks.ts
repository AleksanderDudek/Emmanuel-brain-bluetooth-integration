/**
 * The session's breaks in the signal, by their cause — so a player who often "loses the band" can see why and
 * what helps (DESIGN.md §13).  A break is a stretch of unusable signal that lasts at least BREAK_MIN_SEC, counted
 * once, by the cause that started it: movement (the band's motion sensor), contact (the optodes or electrodes off
 * the skin) or Bluetooth (the link reconnecting, or no data coming).  What follows inside the same stretch — the
 * quick baseline after a reconnect, the meter settling — belongs to it.  Pure: no DOM.
 */
import type { SignalReason } from '../hub';
import { t } from '../i18n/signal';

export type BreakKind = 'motion' | 'contact' | 'bluetooth';
export const BREAK_KINDS: readonly BreakKind[] = ['bluetooth', 'contact', 'motion'];
export type BreakCounts = Record<BreakKind, number>;

/** A stretch shorter than this is a flicker, not a break (s). */
export const BREAK_MIN_SEC = 1.5;

/** The cause a hub reason names (null: not a cause of its own — the baseline, the meter settling, no reason). */
export function breakKind(reason: SignalReason | null): BreakKind | null {
  switch (reason) {
    case 'motion': return 'motion';
    case 'poor_signal': return 'contact';
    case 'connecting': case 'no_data': case 'no_device': return 'bluetooth';
    default: return null;
  }
}

export class BreakLog {
  readonly counts: BreakCounts = { motion: 0, contact: 0, bluetooth: 0 };
  /** seconds of unusable signal inside breaks */
  lostSec = 0;
  private run: { kind: BreakKind; t: number; counted: boolean } | null = null;

  /** One tick of a session's play: whether the signal could be used, the hub's reason, the tick's length. */
  push(usable: boolean, reason: SignalReason | null, dt: number): void {
    if (usable) {
      this.run = null;
      return;
    }
    const kind = breakKind(reason);
    if (!this.run) {
      if (!kind) return;
      this.run = { kind, t: 0, counted: false };
    }
    this.run.t += dt;
    if (!this.run.counted && this.run.t >= BREAK_MIN_SEC) {
      this.run.counted = true;
      this.counts[this.run.kind]++;
      this.lostSec += this.run.t;
    } else if (this.run.counted) this.lostSec += dt;
  }

  get total(): number { return this.counts.motion + this.counts.contact + this.counts.bluetooth; }
}

/** The most frequent cause (ties: Bluetooth, then contact, then movement); null without breaks. */
export function topBreak(c: Partial<BreakCounts> | undefined): BreakKind | null {
  let best: BreakKind | null = null, n = 0;
  for (const k of BREAK_KINDS) if ((c?.[k] ?? 0) > n) { n = c![k]!; best = k; }
  return best;
}

/** The summary's line: the breaks by cause and what helps with the most frequent one ('' without breaks). */
export function breakLine(c: Partial<BreakCounts> | undefined): string {
  const top = topBreak(c);
  if (!top) return '';
  const list = BREAK_KINDS.filter(k => (c?.[k] ?? 0) > 0).map(k => t(`brk.${k}`, { n: c![k]! })).join(', ');
  return `${t('brk.line', { list })} ${t(`brk.tip.${top}`)}`;
}
