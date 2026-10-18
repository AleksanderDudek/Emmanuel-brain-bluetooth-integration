import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => Promise.resolve() }));

const { chapelScreen, levelUpScreen, musicControls } = await import('../src/ui/screens');
const { prayerScreen } = await import('../src/ui/prayer');
const { Run, modsFrom, BASE_POOL } = await import('../src/sim/run');
const { CHAPTERS, PRAYERS } = await import('../src/content');
const { NO_BAND } = await import('../src/neuro/effects');
const { defaultSave } = await import('../src/save');
type AudioApi = import('../src/types').AudioApi;
type ScreenApi = import('../src/ui/screens').ScreenApi;

const fakeAudio = (): AudioApi => ({
  unlock: vi.fn(async () => undefined), unlocked: true, setSoundscape: vi.fn(), setMood: vi.fn(), playInvocation: vi.fn(), sfx: vi.fn(),
  setVolumes: vi.fn(), setMuted: vi.fn(), setHeartRate: vi.fn(), suspend: vi.fn(), resume: vi.fn(), nextTrack: vi.fn(), nowPlaying: 'Drzewo Życia · wariacja 1',
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const button = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label)!;

describe('chapel screen', () => {
  it('settles once: "Pomiń" stops the contemplation timer, which must not bless later', () => {
    vi.useFakeTimers();
    const results: boolean[] = [];
    const el = chapelScreen('focus', false, ok => results.push(ok));
    document.body.append(el);
    button(el, 'Pomiń').click();
    button(el, 'Pomiń').click();
    vi.advanceTimersByTime(30_000);
    expect(results).toEqual([false]);
  });

  it('a right answer blesses once, however often Enter is pressed', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);   // first left task: 12 + 11
    const results: boolean[] = [];
    const el = chapelScreen('train_left', false, ok => results.push(ok));
    document.body.append(el);
    const input = el.querySelector('input')!;
    input.value = '23';
    for (let i = 0; i < 3; i++) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    button(el, 'Sprawdź').click();
    vi.advanceTimersByTime(2000);
    expect(results).toEqual([true]);
    expect(input.disabled).toBe(true);
  });
});

describe('level-up screen', () => {
  it('ignores a tap that lands as the cards appear, then takes exactly one pick', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const run = new Run(CHAPTERS[0], BASE_POOL, modsFrom({}, 0), false, 1);
    const picks: string[] = [];
    const el = levelUpScreen(run, run.offers(), o => picks.push(o));
    const cards = [...el.querySelectorAll<HTMLButtonElement>('.card')];
    cards[0].click();                 // the second half of a double tap on the previous screen
    expect(picks).toHaveLength(0);
    now += 400;
    cards[1].click();
    cards[2].click();
    expect(picks).toHaveLength(1);
  });
});

describe('prayer of the heart screen', () => {
  const open = (o: Partial<Parameters<typeof prayerScreen>[0]> = {}) => {
    const opts = {
      prayer: PRAYERS[0], voice: false, voiceConsent: false, audio: fakeAudio(), neuro: () => NO_BAND,
      onConsent: vi.fn(), onVoiceChange: vi.fn(), onDone: vi.fn(), ...o,
    };
    const screen = prayerScreen(opts);
    document.body.append(screen.el);
    return { ...screen, opts };
  };

  it('has nothing to read: one invocation, a lamp, a focus meter — and no reading mode', () => {
    const { el, dispose } = open();
    expect(el.querySelector('.invocation')?.textContent).toBe('Przyjdź, Duchu Święty.');
    expect(el.querySelector('.lamp')).not.toBeNull();
    expect(el.querySelector('.focus-meter')).not.toBeNull();
    expect([...el.querySelectorAll('button')].some(b => /Czytam|Przytrzymaj/.test(b.textContent ?? ''))).toBe(false);
    dispose();
  });

  it('stillness fills the lamp; then Amen', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.push(cb); return frames.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { el, opts, dispose } = open();
    const amen = [...el.querySelectorAll('button')].find(b => b.textContent === 'Amen')!;
    expect(amen.hidden).toBe(true);
    for (let i = 0; i < 400 && amen.hidden; i++) {   // 40 s of frames, 100 ms apart, nothing touched
      now += 100;
      frames.shift()!(now);
    }
    expect(amen.hidden).toBe(false);
    expect(opts.audio.sfx).toHaveBeenCalledWith('revelation');
    amen.click();
    expect(opts.onDone).toHaveBeenCalledOnce();
    dispose();
  });

  it('asks for consent before using the microphone', () => {
    const started: string[] = [];
    class FakeRecognizer {
      lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult = null; onerror = null; onend = null; onstart = null;
      start() { started.push(this.lang); }
      stop() {}
      abort() {}
    }
    (globalThis as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognizer;
    try {
      const { el, opts, dispose } = open();
      [...el.querySelectorAll('button')].find(b => /na głos/.test(b.textContent ?? ''))!.click();
      expect(el.querySelector('.consent')?.textContent).toMatch(/Google/);
      expect(started).toHaveLength(0);
      [...el.querySelectorAll('button')].find(b => b.textContent === 'Zgadzam się')!.click();
      expect(opts.onConsent).toHaveBeenCalledOnce();
      expect(opts.onVoiceChange).toHaveBeenCalledWith(true);
      expect(started).toEqual(['pl-PL']);
      dispose();
    } finally {
      delete (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    }
  });
});

describe('prayer of the heart screen: exits and restlessness', () => {
  const open = (o: Partial<Parameters<typeof prayerScreen>[0]> = {}) => {
    const screen = prayerScreen({
      prayer: PRAYERS[0], voice: false, voiceConsent: false, audio: fakeAudio(), neuro: () => NO_BAND,
      onConsent: vi.fn(), onVoiceChange: vi.fn(), onDone: vi.fn(), ...o,
    });
    document.body.append(screen.el);
    return screen;
  };

  it('closing the screen aborts the microphone and gives the wake lock back', async () => {
    const aborted: number[] = [];
    class FakeRecognizer {
      lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult = null; onerror = null; onend = null; onstart = null;
      start() {}
      stop() {}
      abort() { aborted.push(1); }
    }
    (globalThis as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognizer;
    const sentinel = { release: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn(async () => sentinel) }, configurable: true });
    try {
      const { dispose } = open({ voice: true, voiceConsent: true });
      await new Promise(r => setTimeout(r, 0));   // the wake lock is granted
      dispose();
      expect(aborted).toHaveLength(1);
      expect(sentinel.release).toHaveBeenCalledOnce();
    } finally {
      delete (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    }
  });

  it('touching the screen all the time keeps the lamp from filling: stillness is the fallback focus', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.push(cb); return frames.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { el, dispose } = open();
    const amen = [...el.querySelectorAll('button')].find(b => b.textContent === 'Amen')!;
    for (let i = 0; i < 300; i++) {   // 30 s, a touch every half second
      now += 100;
      if (i % 5 === 0) window.dispatchEvent(new Event('pointerdown'));
      frames.shift()!(now);
    }
    expect(amen.hidden).toBe(true);
    expect(Number(el.querySelector('.progress')?.getAttribute('aria-valuenow'))).toBeLessThan(40);
    dispose();
  });
});

describe('music controls', () => {
  it('show what plays, skip to the next track, mute the music, change the style', () => {
    const save = defaultSave();
    const audio = fakeAudio();
    const api = { save, audio, persist: vi.fn(), applySettings: vi.fn() } as unknown as ScreenApi;
    const el = musicControls(api);
    expect(el.querySelector('.now')?.textContent).toBe('Drzewo Życia · wariacja 1');
    button(el, '⏭ Następny utwór').click();
    expect(audio.nextTrack).toHaveBeenCalledOnce();
    button(el, '♪ Wycisz muzykę').click();
    expect(save.settings.musicMuted).toBe(true);
    expect(api.applySettings).toHaveBeenCalled();
    expect(el.querySelector('.now')?.textContent).toBe('Muzyka wyłączona');
    const styles = [...el.querySelectorAll('.styles button')].map(b => b.textContent);
    expect(styles).toEqual(['Psalm 150', 'Chorał gregoriański', 'Cisza']);   // what this save owns
    button(el, 'Cisza').click();
    expect(audio.setSoundscape).toHaveBeenCalledWith('cisza');
    expect(save.soundscape).toBe('cisza');
  });
});
