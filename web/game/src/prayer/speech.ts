/**
 * Thin wrapper around the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Chrome and Safari support it; Firefox does not.  Chrome usually sends the
 * audio to its cloud recogniser, so the UI asks for consent before first use.
 * Recognition stops after a pause in speech — we restart it while active.
 */

interface RecResult { isFinal: boolean; 0: { transcript: string } }
interface RecEvent { resultIndex: number; results: ArrayLike<RecResult> }
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognizerCtor = new () => Recognizer;

function ctor(): RecognizerCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => ctor() !== null;

export interface SpeechCallbacks {
  onText(text: string, final: boolean): void;
  /** 'not-allowed' | 'audio-capture' | 'network' | 'unsupported' | … */
  onError(code: string): void;
  onListening(listening: boolean): void;
}

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);

export class SpeechListener {
  private rec: Recognizer | null = null;
  private active = false;

  constructor(private readonly cb: SpeechCallbacks, private readonly lang = 'pl-PL') {}

  start(): void {
    const C = ctor();
    if (!C) {
      this.cb.onError('unsupported');
      return;
    }
    this.active = true;
    const rec = new C();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => this.cb.onListening(true);
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        this.cb.onText(r[0].transcript, r.isFinal);
      }
    };
    rec.onerror = e => {
      if (FATAL.has(e.error)) {
        this.active = false;
        this.cb.onError(e.error);
      }
    };
    rec.onend = () => {
      this.cb.onListening(false);
      if (this.active) setTimeout(() => { if (this.active) this.safeStart(); }, 250);   // resume after a pause
    };
    this.rec = rec;
    this.safeStart();
  }

  private safeStart(): void {
    try {
      this.rec?.start();
    } catch {
      // already started
    }
  }

  /** Stop listening for good: late results are discarded, no callback fires afterwards. */
  stop(): void {
    this.active = false;
    const rec = this.rec;
    this.rec = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    try {
      rec.abort();
    } catch {
      // not running
    }
  }
}
