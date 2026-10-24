/**
 * Session recorder: raw frames + derived ΔHbO/ΔHbR + event markers.
 * Same semantics as brainlink/fnirs_recorder.py (markers attach to the next
 * frame, labels on the same frame are joined with "|", auto-stop at the
 * configured duration).  Frames are written to IndexedDB in chunks of about
 * 5 s, so a crash or a closed tab loses at most the last chunk.
 *
 * Each recording is its own `Session` object, so a session that is still being
 * finalised can never be mixed up with the next one.
 */
import type { Frame } from '../core/proto';
import type { Derived, FNIRSConfig } from '../core/types';
import type { SessionDB } from './db';
import { CSV_HEADER, newSessionId, packChunk, type Marker, type SessionMeta, type StorageTarget } from './format';
import { t } from '../i18n/signal';

export interface RecorderInfo {
  session_id: string | null;
  name: string;
  recording: boolean;
  duration_sec: number;
  elapsed_sec: number;
  remaining_sec: number;
  sample_count: number;
  markers: number;
  /** set when IndexedDB rejected a chunk (e.g. quota exceeded): data is being lost */
  error: string | null;
}

export interface StartOptions {
  name: string;
  durationSec: number;
  source: string;
  device: string;
  config: FNIRSConfig;
  sampleRate: number;
  storage: StorageTarget;
}

export const APP_ID = 'brainlink-web/0.1';

class Session {
  frames: Frame[] = [];
  derived: number[][] = [];
  marks: { i: number; label: string }[] = [];
  nextMarker: string | null = null;
  seq = 0;
  count = 0;          // frames handed to the recorder
  saved = 0;          // frames confirmed in IndexedDB
  chunkStart = 0;
  chain: Promise<unknown>;
  error: Error | null = null;

  constructor(public meta: SessionMeta, private readonly db: SessionDB) {
    this.chain = db.putMeta(meta);
  }

  flush(): void {
    if (!this.frames.length) return;
    const chunk = packChunk(this.meta.session_id, this.seq++, this.chunkStart, this.frames, this.derived, this.marks);
    this.chunkStart += this.frames.length;
    this.frames = []; this.derived = []; this.marks = [];
    // keep writes ordered; count frames as saved only once IndexedDB has them
    this.chain = this.chain
      .then(() => this.db.putChunk(chunk))
      .then(() => {
        this.saved += chunk.n;
        return this.db.putMeta({ ...this.meta, sample_count: this.saved });   // for crash recovery
      })
      .catch((e: unknown) => { this.error ??= e instanceof Error ? e : new Error(String(e)); });
  }
}

export class Recorder {
  private current: Session | null = null;

  constructor(private readonly db: SessionDB, private readonly chunkFrames = 150,
              private readonly clock: () => number = () => Date.now()) {}

  get recording(): boolean { return this.current !== null; }
  get meta(): SessionMeta | null { return this.current?.meta ?? null; }
  get error(): Error | null { return this.current?.error ?? null; }

  /** Starts synchronously (a double click cannot create two sessions); the metadata write is awaited. */
  async start(o: StartOptions): Promise<RecorderInfo> {
    if (this.current) throw new Error(t('rec.running'));
    const meta: SessionMeta = {
      session_id: newSessionId(), modality: 'fnirs', device: o.device, name: o.name, source: o.source,
      duration_sec: o.durationSec, start_time: this.clock() / 1000, end_time: null, sample_count: 0, columns: CSV_HEADER,
      pipeline_config: o.config, markers: [], notes: '', sample_rate: o.sampleRate, storage: o.storage,
      in_browser: true, app: APP_ID,
    };
    const s = new Session(meta, this.db);
    this.current = s;
    try {
      await s.chain;
    } catch (e) {
      if (this.current === s) this.current = null;
      throw e;
    }
    return this.info();
  }

  /** Attach a label to the next recorded frame. Returns null when not recording. */
  mark(label: string): Marker | null {
    const s = this.current;
    if (!s) return null;
    const now = this.clock() / 1000;
    const m = { label, time: now, t_sec: Math.round((now - s.meta.start_time) * 1000) / 1000 };
    s.nextMarker = s.nextMarker ? `${s.nextMarker}|${label}` : label;
    s.meta.markers.push(m);
    return m;
  }

  get expired(): boolean {
    const s = this.current;
    return !!s && this.clock() / 1000 - s.meta.start_time >= s.meta.duration_sec;
  }

  /** Append one processed batch (frames + the pipeline's derived arrays for them). */
  add(frames: readonly Frame[], derived: Derived): void {
    const s = this.current;
    if (!s || this.expired) return;
    frames.forEach((f, i) => {
      s.frames.push(f);
      s.derived.push([derived.hbo_left[i], derived.hbr_left[i], derived.hbo_right[i], derived.hbr_right[i]]);
      if (s.nextMarker) {
        s.marks.push({ i: s.frames.length - 1, label: s.nextMarker });
        s.nextMarker = null;
      }
      s.count++;
    });
    if (s.frames.length >= this.chunkFrames) s.flush();
  }

  /** Write whatever is buffered now (e.g. when the tab is hidden — mobile browsers may kill it). */
  async checkpoint(): Promise<void> {
    const s = this.current;
    if (!s) return;
    s.flush();
    await s.chain;
  }

  /** Stop and finalise. `recording` turns false immediately, so a new session can start meanwhile. */
  async stop(): Promise<SessionMeta & { error?: string }> {
    const s = this.current;
    if (!s) throw new Error(t('rec.none'));
    this.current = null;
    if (s.nextMarker && s.frames.length) {
      // a marker set after the last frame: put it on that frame rather than lose it from the CSV
      const i = s.frames.length - 1;
      const prev = s.marks.find(m => m.i === i);
      if (prev) prev.label = `${prev.label}|${s.nextMarker}`; else s.marks.push({ i, label: s.nextMarker });
      s.nextMarker = null;
    }
    s.flush();
    await s.chain;
    const final: SessionMeta = { ...s.meta, end_time: this.clock() / 1000, sample_count: s.saved };
    if (s.error) final.notes = `${final.notes ? final.notes + ' ' : ''}${t('rec.incomplete', { error: s.error.message })}`;
    await this.db.putMeta(final);
    return s.error ? { ...final, error: s.error.message } : final;
  }

  info(): RecorderInfo {
    const s = this.current;
    const elapsed = s ? this.clock() / 1000 - s.meta.start_time : 0;
    const dur = s?.meta.duration_sec ?? 0;
    return {
      session_id: s?.meta.session_id ?? null, name: s?.meta.name ?? '', recording: !!s, duration_sec: dur,
      elapsed_sec: Math.round(elapsed * 10) / 10, remaining_sec: Math.round(Math.max(0, dur - elapsed) * 10) / 10,
      sample_count: s?.count ?? 0, markers: s?.meta.markers.length ?? 0, error: s?.error?.message ?? null,
    };
  }
}
