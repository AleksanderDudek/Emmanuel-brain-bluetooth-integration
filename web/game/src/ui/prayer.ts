/**
 * The prayer of the heart — how realms, gifts and looks are opened ("Modlitwa otwiera"). Nothing to
 * read: one short invocation, repeated in the heart (or aloud), while focus fills the lamp. Focus
 * comes from the Mendi band (multiplier up to ×3), from the invocation heard aloud (×2), or from
 * stillness — not touching anything (×1.5). The live meter shows level, source and multiplier.
 */
import type { NeuroState } from '../neuro/effects';
import { bandFocus, THRESHOLD, type FocusSource } from '../neuro/focus';
import { PrayerSession } from '../prayer/session';
import { SpeechListener, speechSupported } from '../prayer/speech';
import type { AudioApi, PrayerDef } from '../types';
import { btn, h, screen, verseEl } from './common';

export interface PrayerScreenOptions {
  prayer: PrayerDef;
  /** the player prefers to pray aloud (speech recognition) */
  voice: boolean;
  voiceConsent: boolean;
  audio: AudioApi;
  neuro: () => NeuroState;
  onConsent(): void;
  onVoiceChange(on: boolean): void;
  onDone(): void;
  onCancel?(): void;
  /** the invocation also calibrates the band */
  calibrating?: boolean;
}

const SOURCE_LABEL: Readonly<Record<FocusSource, string>> = {
  band: 'Skupienie z opaski · mnożnik do ×3',
  voice: 'Modlitwa na głos · mnożnik do ×2',
  still: 'Bezruch — nie dotykaj ekranu · mnożnik do ×1,5',
  none: 'Wycisz się… odłóż palce, oddychaj spokojnie',
};
const RESTLESS_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

export function prayerScreen(o: PrayerScreenOptions): { el: HTMLElement; dispose(): void } {
  const p = o.prayer;
  const session = new PrayerSession(p.invocation, p.seconds);
  const lamp = h('div', { class: 'lamp', 'aria-hidden': 'true' }, h('div', { class: 'flame' }));
  const progress = h('div', { class: 'bar progress', role: 'progressbar', 'aria-label': 'Modlitwa', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div'));
  const meterFill = h('div', { class: 'fill' });
  const meter = h('div', { class: 'focus-meter', 'aria-hidden': 'true' }, meterFill, h('div', { class: 'tick' }));
  meter.style.setProperty('--threshold', `${THRESHOLD * 100}%`);
  const mult = h('b', { class: 'mult' }, '×1');
  const source = h('small', { class: 'source' });
  const status = h('p', { class: 'status', role: 'status' });
  const voiceBox = h('div', { class: 'voice-box' });
  const amen = btn('Amen', () => { cleanup(); o.onDone(); }, 'btn gold big', { hidden: true });
  let voiceOn = o.voice && o.voiceConsent && speechSupported();
  let consent = o.voiceConsent;
  let listener: SpeechListener | null = null;
  let raf = 0;
  let done = false;
  let last = performance.now();
  let lastInput = performance.now();
  let shownPct = -1;
  let wake: WakeLockSentinel | null = null;

  // stillness = no touch, click or key; the screen stays awake for the minute of prayer (the browser drops the
  // lock whenever the page is hidden, so it is taken again on return, and given back as soon as the prayer is full)
  const restless = () => { lastInput = performance.now(); };
  for (const t of RESTLESS_EVENTS) window.addEventListener(t, restless, { capture: true, passive: true });
  const releaseWake = () => {
    void wake?.release().catch(() => undefined);
    wake = null;
  };
  const keepAwake = () => {
    if (done || document.hidden || wake) return;
    navigator.wakeLock?.request('screen').then(s => { if (done) void s.release(); else wake = s; }).catch(() => undefined);
  };
  const onVisibility = () => { if (!document.hidden) { wake = null; keepAwake(); } };
  document.addEventListener('visibilitychange', onVisibility);
  keepAwake();

  const finish = () => {
    if (done) return;
    done = true;
    stopVoice();
    releaseWake();
    progress.classList.add('full');
    lamp.classList.add('full');
    status.textContent = session.repetitions ? `Modlitwa przyjęta · ${session.repetitions}× na głos.` : 'Modlitwa przyjęta.';
    o.audio.sfx('revelation');
    voiceBox.replaceChildren();
    amen.hidden = false;
    amen.focus();
  };

  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!done) {
      const ns = o.neuro();
      const band = ns.source === 'band' && ns.reliable ? bandFocus(ns.activation) : null;
      const st = session.update(dt, { band, idle: (now - lastInput) / 1000 });
      const pct = Math.round(st.progress * 100);
      if (pct !== shownPct) {
        shownPct = pct;
        (progress.firstElementChild as HTMLElement).style.width = `${pct}%`;
        progress.setAttribute('aria-valuenow', String(pct));
        lamp.style.setProperty('--p', String(st.progress));
      }
      meterFill.style.width = `${Math.round(st.focus.level * 100)}%`;
      meter.classList.toggle('on', st.focus.level >= THRESHOLD);
      mult.textContent = `×${String(st.focus.mult).replace('.', ',')}`;
      mult.classList.toggle('hot', st.focus.mult > 1);
      source.textContent = o.calibrating && ns.source === 'band' && !ns.baselineReady
        ? `Opaska się stroi — trwaj w ciszy… ${Math.round(ns.baselineProgress * 100)}%`
        : SOURCE_LABEL[st.focus.source];
      if (st.focus.tierUp) {
        o.audio.sfx('tier', { step: st.focus.tier });
        mult.classList.remove('pop');
        void mult.offsetWidth;   // restart the pop animation
        mult.classList.add('pop');
      }
      if (st.done) finish();
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // ── voice (optional) ──────────────────────────────────────────────
  const stopVoice = () => {
    listener?.stop();
    listener = null;
  };
  const startVoice = () => {
    stopVoice();
    listener = new SpeechListener({
      onText: (text, final) => {
        if (done || !final) return;
        const n = session.heard(text);
        if (n > 0) {
          o.audio.sfx('prayer_word', { volume: 0.5 });
          status.textContent = `Słyszę: ${session.repetitions}×`;
        }
      },
      onError: code => {
        status.textContent = code === 'not-allowed' || code === 'service-not-allowed'
          ? 'Brak dostępu do mikrofonu — módl się w sercu, w bezruchu.'
          : code === 'network' ? 'Rozpoznawanie mowy wymaga internetu — módl się w sercu, w bezruchu.'
            : 'Rozpoznawanie mowy nie działa — módl się w sercu, w bezruchu.';
        setVoice(false);
      },
      onListening: on => {
        if (!done && on && !session.repetitions) status.textContent = 'Słucham… powtarzaj spokojnie, swoim tempem.';
      },
    });
    listener.start();
  };
  const setVoice = (on: boolean) => {
    voiceOn = on;
    o.onVoiceChange(on);
    if (on) startVoice(); else stopVoice();
    renderVoice();
  };
  const renderVoice = () => {
    if (done || !speechSupported()) return voiceBox.replaceChildren();
    const hadFocus = voiceBox.contains(document.activeElement);
    if (voiceOn) {
      voiceBox.replaceChildren(btn('🎙 Na głos: włączone (wyłącz)', () => setVoice(false), 'btn small'));
    } else if (!consent && voiceBox.dataset.asking) {
      // the disclosure is the accessible description of the choice, so a screen reader reads it with the button
      voiceBox.replaceChildren(h('div', { class: 'consent', role: 'group', 'aria-labelledby': 'voice-consent-text' },
        h('p', { id: 'voice-consent-text' }, 'Gra użyje rozpoznawania mowy przeglądarki. W Chrome dźwięk jest zwykle przetwarzany na serwerach Google; sama gra niczego nie nagrywa ani nie wysyła.'),
        h('div', { class: 'row center' },
          btn('Zgadzam się', () => { consent = true; o.onConsent(); setVoice(true); }, 'btn gold small', { 'aria-describedby': 'voice-consent-text' }),
          btn('Nie teraz', () => { delete voiceBox.dataset.asking; renderVoice(); }, 'btn small'))));
    } else {
      voiceBox.replaceChildren(btn('🎙 Módl się na głos', () => {
        if (consent) return setVoice(true);
        voiceBox.dataset.asking = '1';
        renderVoice();
      }, 'btn small'));
    }
    if (hadFocus) voiceBox.querySelector<HTMLElement>('button')?.focus();
  };
  renderVoice();
  if (voiceOn) startVoice();

  const cleanup = () => {
    done = true;
    cancelAnimationFrame(raf);
    stopVoice();
    for (const t of RESTLESS_EVENTS) window.removeEventListener(t, restless, { capture: true });
    document.removeEventListener('visibilitychange', onVisibility);
    releaseWake();
  };

  const el = screen('prayer',
    o.onCancel ? btn('← Wróć', () => { cleanup(); o.onCancel!(); }, 'btn ghost back') : null,
    h('h1', null, p.title),
    h('p', { class: 'intro' }, p.intro),
    lamp,
    h('p', { class: 'invocation' }, p.invocation),
    progress,
    h('div', { class: 'focus-row' }, h('span', { class: 'label' }, 'Skupienie'), meter, mult),
    source,
    status,
    voiceBox,
    amen,
    verseEl(p.verse, 'verse small'),
    h('p', { class: 'muted small' }, p.unlockText));
  return { el, dispose: cleanup };
}
