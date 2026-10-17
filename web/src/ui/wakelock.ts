/**
 * Keep the screen on while streaming from the band or recording.
 * A hidden page gets its timers throttled (and phones may freeze it), which
 * would stall the 10 Hz loop; a screen wake lock keeps the page visible.
 * The browser releases the lock whenever the page is hidden, so it is
 * re-acquired when the page becomes visible again.
 */
export class ScreenAwake {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private pending = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wanted) void this.acquire();
    });
  }

  /** Call often (e.g. every frame); it only acts when the wish changes. */
  set(want: boolean): void {
    if (want === this.wanted) return;
    this.wanted = want;
    if (want) void this.acquire();
    else void this.release();
  }

  private async acquire(): Promise<void> {
    if (this.sentinel || this.pending || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    this.pending = true;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => { this.sentinel = null; });
      if (!this.wanted) await this.release();
    } catch {
      // battery saver, unsupported or not allowed: the app still works, timers just may slow down
    } finally {
      this.pending = false;
    }
  }

  private async release(): Promise<void> {
    const s = this.sentinel;
    this.sentinel = null;
    await s?.release().catch(() => undefined);
  }
}
