/**
 * The prayer screen — how talents, realms and looks are opened ("Modlitwa
 * otwiera"). Spoken aloud (speech recognition lights the words up as you go)
 * or read along (hold the button; the text reveals itself at reading pace).
 * With the band connected, a quiet indicator shows the prayer's focus — it
 * never blocks anything.
 */
import type { NeuroState } from '../neuro/effects';
import { PrayerMatcher, ReadAlong } from '../prayer/matcher';
import { SpeechListener, speechSupported } from '../prayer/speech';
import type { AudioApi, PrayerDef } from '../types';
import { btn, h, screen, verseEl } from './common';

export interface PrayerScreenOptions {
  prayer: PrayerDef;
  mode: 'voice' | 'read';
  voiceConsent: boolean;
  audio: AudioApi;
  neuro: () => NeuroState;
  onConsent(): void;
  onModeChange(mode: 'voice' | 'read'): void;
  onDone(): void;
  onCancel?(): void;
  /** the invocation also calibrates the band */
  calibrating?: boolean;
}

export function prayerScreen(o: PrayerScreenOptions): { el: HTMLElement; dispose(): void } {
  const p = o.prayer;
  const paragraphs = p.text.split(/\n\n+/);
  const spans: HTMLSpanElement[] = [];
  const textEl = h('div', { class: 'prayer-text', 'aria-live': 'off' },
    paragraphs.map(par => h('p', null, par.split(/\s+/).filter(Boolean).flatMap(w => {
      const s = h('span', { class: 'w' }, w);
      spans.push(s);
      return [s, ' '];
    }))));
  const progress = h('div', { class: 'bar' }, h('div'));
  const status = h('p', { class: 'status', role: 'status' });
  const focus = h('p', { class: 'focus' });
  const controls = h('div', { class: 'row center' });
  const amen = btn('Amen', () => { cleanup(); o.onDone(); }, 'btn gold big', { hidden: true });
  let mode: 'voice' | 'read' = speechSupported() ? o.mode : 'read';
  let consent = o.voiceConsent;
  let listener: SpeechListener | null = null;
  let raf = 0;
  let done = false;
  let lastLit = 0;

  const setBar = (k: number) => { (progress.firstElementChild as HTMLElement).style.width = `${Math.min(100, k * 100)}%`; };
  const light = (upTo: number, matched?: boolean[]) => {
    spans.forEach((s, i) => {
      s.classList.toggle('on', matched ? matched[i] || i < upTo && mode === 'read' : i < upTo);
      s.classList.toggle('next', i === upTo);
    });
    if (upTo > lastLit) {
      o.audio.sfx('prayer_word', { volume: 0.4 });
      lastLit = upTo;
      spans[Math.min(upTo, spans.length - 1)]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const finish = () => {
    if (done) return;
    done = true;
    listener?.stop();
    listener = null;
    spans.forEach(s => s.classList.add('on'));
    setBar(1);
    status.textContent = 'Modlitwa przyjęta.';
    o.audio.sfx('revelation');
    controls.replaceChildren();
    amen.hidden = false;
    amen.focus();
  };

  // ── voice ─────────────────────────────────────────────────────────
  const matcher = new PrayerMatcher(p.text);
  const startVoice = () => {
    if (!consent) return renderControls();
    listener?.stop();
    listener = new SpeechListener({
      onText: (text, final) => {
        if (done) return;
        const pr = matcher.feed(text, final);
        light(pr.pointer, pr.matched);
        setBar(pr.pointer / spans.length);
        if (pr.done) finish();
      },
      onError: code => {
        status.textContent = code === 'not-allowed' || code === 'service-not-allowed'
          ? 'Brak dostępu do mikrofonu — możesz przełączyć na czytanie.'
          : code === 'network' ? 'Rozpoznawanie mowy wymaga internetu — przełącz na czytanie.'
            : 'Rozpoznawanie mowy nie działa — przełącz na czytanie.';
        renderControls();
      },
      onListening: on => {
        if (!done) status.textContent = on ? 'Słucham… mów spokojnie, swoim tempem.' : 'Chwila ciszy…';
      },
    });
    listener.start();
    renderControls();
  };

  // ── read along ────────────────────────────────────────────────────
  const reader = new ReadAlong(p.text);
  let holding = false;
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode === 'read' && !done) {
      const n = reader.update(dt, holding);
      light(n);
      setBar(n / reader.words.length);
      if (reader.done) finish();
    }
    const ns = o.neuro();
    if (ns.source === 'band' && ns.streaming) {
      const k = ns.activation === null ? 0 : Math.max(0, Math.min(1, ns.activation));
      focus.textContent = o.calibrating && !ns.baselineReady
        ? `Opaska się stroi — trwaj w ciszy… ${Math.round(ns.baselineProgress * 100)}%`
        : `Skupienie modlitwy ${'●'.repeat(Math.round(k * 5))}${'○'.repeat(5 - Math.round(k * 5))}${ns.heartRate ? ` · serce ${Math.round(ns.heartRate)}` : ''}`;
    } else {
      focus.textContent = '';
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const holdBtn = btn('Przytrzymaj i czytaj na głos', () => undefined, 'btn gold big hold');
  const press = (on: boolean) => (e: Event) => {
    e.preventDefault();
    holding = on;
    holdBtn.classList.toggle('active', on);
    status.textContent = on ? 'Czytaj na głos albo w sercu — tekst idzie za tobą.' : 'Przytrzymaj, aby czytać dalej.';
  };
  holdBtn.addEventListener('pointerdown', press(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) holdBtn.addEventListener(ev, press(false));
  holdBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') press(true)(e); });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') press(false)(e); });

  // swapping the controls must not drop keyboard focus to <body>
  const swap = (...nodes: Node[]) => {
    const hadFocus = controls.contains(document.activeElement);
    controls.replaceChildren(...nodes);
    if (hadFocus) controls.querySelector<HTMLElement>('button')?.focus();
  };
  const renderControls = () => {
    if (done) return;
    if (mode === 'read') {
      swap(holdBtn);
      status.textContent ||= `Około ${Math.ceil(reader.seconds / 10) * 10} sekund.`;
      return;
    }
    if (!consent) {
      swap(h('div', { class: 'consent' },
        h('p', null, 'Do śledzenia modlitwy gra używa rozpoznawania mowy przeglądarki. W Chrome dźwięk jest zwykle przetwarzany na serwerach Google; sama gra niczego nie nagrywa ani nie wysyła.'),
        h('div', { class: 'row center' },
          btn('Zgadzam się', () => { consent = true; o.onConsent(); startVoice(); }, 'btn gold'),
          btn('Wolę czytać', () => setMode('read'), 'btn'))));
      return;
    }
    swap(listener
      ? btn('■ Zatrzymaj', () => { listener?.stop(); listener = null; status.textContent = 'Wstrzymano.'; renderControls(); }, 'btn')
      : btn('🎙 Zacznij modlitwę', startVoice, 'btn gold big'));
  };

  const setMode = (m: 'voice' | 'read') => {
    if (m === 'voice' && !speechSupported()) return;
    mode = m;
    listener?.stop();
    listener = null;
    status.textContent = '';
    o.onModeChange(m);
    modeSwitch.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    renderControls();
  };
  const modeSwitch = h('div', { class: 'seg', role: 'group', 'aria-label': 'Sposób modlitwy' },
    btn('🎙 Na głos', () => setMode('voice'), 'btn', { 'data-mode': 'voice', 'aria-pressed': String(mode === 'voice'), disabled: !speechSupported() }),
    btn('📖 Czytam', () => setMode('read'), 'btn', { 'data-mode': 'read', 'aria-pressed': String(mode === 'read') }));

  const cleanup = () => {
    cancelAnimationFrame(raf);
    listener?.stop();
    listener = null;
  };

  renderControls();
  const el = screen('prayer',
    o.onCancel ? btn('← Wróć', () => { cleanup(); o.onCancel!(); }, 'btn ghost back') : null,
    h('h1', null, p.title),
    h('p', { class: 'intro' }, p.intro),
    verseEl(p.verse),
    modeSwitch,
    speechSupported() ? null : h('p', { class: 'muted' }, 'Ta przeglądarka nie rozpoznaje mowy — módl się w trybie czytania.'),
    textEl, progress, status, focus, controls, amen,
    h('p', { class: 'muted small' }, `Otwiera: ${p.unlockText}`));
  return { el, dispose: cleanup };
}
