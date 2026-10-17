/** HolyHolyHoly — game controller: screen flow, the fixed-step loop, audio and the band. */
import './styles.css';
import { toast } from '../../src/ui/dom';
import { createAudio } from './audio';
import { CHAPTERS, PRAYERS, RANKS, REVELATIONS, SKINS, STORY, TRAUMAS } from './content';
import { Input } from './input/input';
import { NeuroBridge } from './neuro/bridge';
import { NeuroEffects, type Effects, type Phase } from './neuro/effects';
import { Renderer } from './render/renderer';
import type { AngelLook } from './render/sprites';
import {
  availablePowers, loadSave, prayed, rankIndex, skinOwned, ultimateUnlocked, writeSave, type SaveData,
} from './save';
import type { GameEvent } from './sim/events';
import { randomSeed } from './sim/rng';
import { generateRoom } from './sim/room';
import { modsFrom, Run } from './sim/run';
import { SEED_GOAL, World } from './sim/world';
import type { ChapterDef, PrayerDef, SfxName, SkinSlot, TraumaKind } from './types';
import { $, btn, h, hideScreen, screen, showScreen, verseBanner } from './ui/common';
import { prayerScreen } from './ui/prayer';
import * as S from './ui/screens';
import { setupPwa } from './pwa';

const STEP = 1 / 60;

class Game {
  save: SaveData = loadSave();
  readonly audio = createAudio();
  readonly neuro = new NeuroBridge();
  private readonly effects = new NeuroEffects();
  private readonly canvas = $<HTMLCanvasElement>('stage');
  private readonly renderer = new Renderer(this.canvas);
  private readonly input = new Input(this.canvas);
  private run: Run | null = null;
  private world: World | null = null;
  private playing = false;
  private paused = false;
  private acc = 0;
  private last = performance.now();
  private fx: Effects = this.effects.update(0, this.neuro.state, { still: 0, phase: 'menu' });
  private lastHeartSent = -1;
  private disposePrayer: (() => void) | null = null;
  private starting = false;
  private saveWarned = false;
  private seenWeak = false;
  private readonly traumaColors = new Map<TraumaKind, string>(Object.values(TRAUMAS).map(t => [t.kind, t.color]));

  readonly api: S.ScreenApi = {
    save: this.save,
    persist: () => this.persist(),
    audio: this.audio,
    neuro: this.neuro,
    map: () => this.map(),
    startChapter: ch => this.startChapter(ch),
    openPrayer: (p, back) => this.openPrayer(p, back),
    show: (el, modal) => showScreen(el, modal),
    applySettings: () => this.applySettings(),
    restartGame: () => location.reload(),
  };

  constructor() {
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        if (this.playing && !this.paused) this.pause();
      } else {
        this.audio.resume();
      }
    });
    // the world emits 'ultimate', which plays its sound
    $('btnUltimate').addEventListener('click', () => { if (this.playing && !this.paused) this.world?.triggerUltimate(); });
    $('btnPause').addEventListener('click', () => this.pause());
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.playing && !this.paused) this.pause(); });
    this.applySettings();
    requestAnimationFrame(t => this.frame(t));
    this.title();
    setupPwa(() => {
      toast('Jest nowa wersja gry — odśwież ją na Drzewie');
      if (!this.playing && document.querySelector('#overlay .map')) this.map();
    });
  }

  persist(): void {
    if (writeSave(this.save) || this.saveWarned) return;
    this.saveWarned = true;
    toast('Nie udało się zapisać postępu (pamięć przeglądarki pełna lub zablokowana). Zrób kopię w Ustawieniach.', true);
  }

  applySettings(): void {
    const s = this.save.settings;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    this.audio.setMuted(s.muted);
    this.renderer.reducedMotion = s.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ─── screen flow ──────────────────────────────────────────────
  private setPlaying(on: boolean): void {
    this.playing = on;
    document.body.classList.toggle('playing', on);
    if (!on) this.input.reset();
  }

  private title(): void {
    this.setPlaying(false);
    showScreen(S.titleScreen(() => void this.begin(), () => showScreen(S.helpScreen(() => this.title()))));
  }

  private async begin(): Promise<void> {
    if (this.starting) return;   // a double tap on "Rozpocznij"
    this.starting = true;
    // recorded before unlock, so the first notes already use the saved soundscape and the calm mood
    this.audio.setSoundscape(this.save.soundscape);
    this.calmMusic();
    try {
      await this.audio.unlock();
    } finally {
      this.starting = false;
    }
    this.applySettings();
    if (!this.save.seenDisclaimer) {
      showScreen(S.disclaimerScreen(() => {
        this.save.seenDisclaimer = true;
        this.persist();
        this.afterDisclaimer();
      }));
      return;
    }
    this.afterDisclaimer();
  }

  private afterDisclaimer(): void {
    if (!prayed(this.save, 'inwokacja')) return this.bandOffer();
    if (!this.save.seenIntro) return this.intro();
    this.map();
  }

  /** Before the invocation: connect the band (optional) so the prayer doubles as its calibration. */
  private bandOffer(): void {
    if (!NeuroBridge.supported()) return this.invocation();
    const status = h('p', { class: 'status', role: 'status' });
    const connect = btn('Połącz opaskę', () => {
      status.textContent = 'Łączenie…';
      connect.disabled = true;
      this.neuro.connect()
        // the player may have chosen "Graj bez opaski" meanwhile: then the band just joins the prayer already under way
        .then(() => { if (el.isConnected) this.invocation(); })
        .catch(e => { status.textContent = e instanceof Error ? e.message : String(e); })
        .finally(() => { connect.disabled = false; });
    }, 'btn gold big');
    const el = screen('notice',
      h('h2', null, 'Opaska Mendi'),
      h('p', null, 'Masz opaskę fNIRS Mendi? Połącz ją teraz — modlitwa do Ducha Świętego będzie jednocześnie jej kalibracją. Gra działa też bez opaski.'),
      connect, btn('Graj bez opaski', () => this.invocation(), 'btn'), status);
    showScreen(el);
  }

  private invocation(): void {
    const p = PRAYERS.find(x => x.id === 'inwokacja')!;
    if (this.neuro.state.source === 'band') this.neuro.restartBaseline();
    this.audio.playInvocation();
    this.openPrayer(p, null, () => this.intro(), true);
  }

  private intro(): void {
    showScreen(S.storyScreen(STORY.intro, 'Powierzony', () => {
      this.save.seenIntro = true;
      this.persist();
      this.map();
    }));
  }

  private openPrayer(p: PrayerDef, back: (() => void) | null, after?: () => void, calibrating = false): void {
    this.disposePrayer?.();
    const s = this.save.settings;
    const { el, dispose } = prayerScreen({
      prayer: p, mode: s.prayerMode, voiceConsent: s.voiceConsent, audio: this.audio, neuro: () => this.neuro.state, calibrating,
      onConsent: () => { s.voiceConsent = true; this.persist(); },
      onModeChange: m => { s.prayerMode = m; this.persist(); },
      onDone: () => {
        this.disposePrayer = null;
        const first = !prayed(this.save, p.id);
        this.save.prayers[p.id] = Date.now();
        this.persist();
        if (first) toast(`Otwarte: ${p.unlockText}`);
        if (p.unlocks.soundscapes?.length && first && p.id !== 'inwokacja') this.audio.sfx('bell');
        (after ?? back ?? (() => this.map()))();
      },
      onCancel: back ? () => { this.disposePrayer = null; back(); } : undefined,
    });
    this.disposePrayer = dispose;
    showScreen(el);
  }

  private map(): void {
    this.setPlaying(false);
    this.run = null;
    this.world = null;
    this.calmMusic();
    const nav: Record<string, () => void> = {
      prayers: () => showScreen(S.prayersScreen(this.api)),
      fruits: () => showScreen(S.fruitsScreen(this.api)),
      store: () => showScreen(S.storeScreen(this.api)),
      codex: () => showScreen(S.codexScreen(this.api)),
      band: () => showScreen(S.bandScreen(this.api)),
      settings: () => showScreen(S.settingsScreen(this.api, () => this.map())),
      help: () => showScreen(S.helpScreen(() => this.map())),
      support: () => showScreen(screen('menu', h('header', { class: 'topbar' }, btn('← Drzewo', () => this.map(), 'btn ghost'), h('h2', null, 'Wesprzyj')), S.supportBox())),
    };
    showScreen(S.mapScreen(this.api, nav));
  }

  private calmMusic(): void {
    this.audio.setMood({ mode: 8, intensity: 0.12, realm: 'heaven' });
  }

  // ─── runs and rooms ───────────────────────────────────────────
  private look(): AngelLook {
    const col = (slot: SkinSlot): [string, string] => {
      let skin = SKINS.find(k => k.id === this.save.equipped[slot]);
      if (!skin || !skinOwned(this.save, skin, RANKS)) skin = SKINS.find(k => k.slot === slot && k.unlock === 'default');
      return skin ? skin.colors : ['#ffffff', '#dfe8ff'];
    };
    return { robe: col('robe'), halo: col('halo'), wings: col('wings'), wingCount: RANKS[rankIndex(this.save, RANKS)].wings };
  }

  startChapter(ch: ChapterDef): void {
    const mods = modsFrom(this.save.fruits, rankIndex(this.save, RANKS), prayed(this.save, 'jezusowa'));
    this.run = new Run(ch, availablePowers(this.save, PRAYERS), mods, ultimateUnlocked(this.save, PRAYERS), randomSeed());
    this.seenWeak = false;
    this.enterRoom();
  }

  private enterRoom(): void {
    const run = this.run!;
    const seed = (run.seed + run.roomIndex * 7919) >>> 0;
    const layout = generateRoom(run.roomKind, seed);
    this.world = new World({ run, layout, defs: TRAUMAS, seed: seed ^ 0xabcdef });
    this.renderer.setTheme(run.chapter, this.look(), this.traumaColors);
    this.renderer.resize();
    this.effects.reset();
    const k = run.roomKind;
    const intensity = k === 'boss' ? 0.9 : k === 'sabbath' ? 0.05 : k === 'chapel' ? 0.12 : 0.45 + 0.03 * run.difficulty;
    this.audio.setMood({ mode: run.chapter.mode, intensity, realm: run.chapter.realm });
    if (k === 'boss') this.audio.sfx('boss');
    $('btnUltimate').hidden = !run.ultimateUnlocked;
    hideScreen();
    this.paused = false;
    this.acc = 0;
    this.setPlaying(true);
    if (document.hidden) this.pause();   // the whisper's timer can end in a background tab
  }

  /** Pause from play (button, Escape, hidden tab); ignored while another modal is up. */
  private pause(): void {
    if (!this.playing || this.paused) return;
    this.showPause();
  }

  private showPause(): void {
    this.paused = true;
    showScreen(S.pauseScreen(() => this.resume(), () => this.map(), () => showScreen(S.settingsScreen(this.api, () => this.showPause()), true)), true);
  }

  private resume(): void {
    if (document.hidden) return this.showPause();   // never come back to a live room
    hideScreen();
    this.paused = false;
    this.last = performance.now();
  }

  private phase(): Phase {
    const k = this.world?.kind;
    return k === 'boss' ? 'boss' : k === 'sabbath' ? 'sabbath' : k === 'chapel' ? 'chapel' : k ? 'battle' : 'menu';
  }

  // ─── the loop ─────────────────────────────────────────────────
  private frame(now: number): void {
    requestAnimationFrame(t => this.frame(t));   // first, so an exception cannot stop the loop
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const w = this.world;
    if (this.playing && w) {
      this.fx = this.effects.update(dt, this.neuro.state, { still: w.player.still, phase: this.phase() });
      if (!this.paused && w.state === 'playing') {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= STEP && steps < 5) {
          const { mx, my } = this.input.read();
          w.step(STEP, mx, my, this.fx);
          this.acc -= STEP;
          steps++;
          if (w.state !== 'playing') break;
        }
        this.save.stats.seconds += dt;
      }
      const events = w.drainEvents();
      this.renderer.handle(events, w);
      this.sounds(events);
      this.renderer.render(w, {
        fx: this.fx, joystick: this.input.joystick, hint: this.hint(w), showSpirit: w.run.ultimateUnlocked,
        bandConnected: this.neuro.state.source === 'band',
      }, this.paused ? 0 : dt);
      const ult = $<HTMLButtonElement>('btnUltimate');
      const ready = w.run.spirit >= 100;
      if (ult.disabled === ready) ult.disabled = !ready;
      ult.classList.toggle('ready', ready);
      if (!this.paused) this.transitions(w);
      const bpm = this.fx.heartBpm ? Math.round(this.fx.heartBpm) : null;
      if ((bpm ?? -1) !== this.lastHeartSent) { this.audio.setHeartRate(bpm); this.lastHeartSent = bpm ?? -1; }
    }
  }

  private hint(w: World): string {
    if (w.kind === 'sabbath') return w.sabbathBlessed ? 'Idź dalej, gdy zechcesz' : 'Stań w ciszy i odpocznij';
    if (w.kind === 'chapel' && !w.chapelDone) return 'Podejdź do ołtarza';
    if (w.stomach.length && w.player.moving) return 'Zatrzymaj się, by szybciej strawić';
    if (w.traumas.some(t => t.state === 'weak' || t.state === 'fright')) return 'Zjedz osłabiony cień';
    if (w.doorOpen && w.kind !== 'boss') return 'Effatha! Drzwi są otwarte';
    if (w.kind === 'rescue' && w.fragments.some(f => f.alive)) return 'Stań przy skutym fragmencie, by go uwolnić';
    if (w.time < 7 && w.run.roomIndex === 0) return 'Puść ekran — w bezruchu anioł się modli';
    if (!w.doorOpen && w.wavesDone && !w.traumas.length && w.stomach.length) return 'Dokończ trawienie — wtedy otworzą się drzwi';
    if (!w.doorOpen && w.wavesDone && !w.traumas.length && w.seedsRatio < SEED_GOAL) {
      return `Zbierz ziarna światła (${Math.round(w.seedsRatio * 100)}% z ${Math.round(SEED_GOAL * 100)}%)`;
    }
    return '';
  }

  private sounds(events: GameEvent[]): void {
    const map: Partial<Record<GameEvent['type'], SfxName>> = {
      shoot: 'shoot', hit: 'hit', weaken: 'weaken', eat: 'eat', digest: 'digest', seed: 'seed', grace: 'grace', fragment: 'fragment',
      door: 'door', hurt: 'hurt', block: 'click', revive: 'rank', levelup: 'levelup', crack: 'revelation', reveal: 'bell',
      bossEaten: 'revelation', ultimate: 'ultimate', fall: 'fall', sabbath: 'bell', altar: 'bell', trumpet: 'bell', heal: 'digest',
      punch: 'hit', lightning: 'hit', stone: 'shoot', bossPhase: 'boss',
    };
    for (const e of events) {
      const name = map[e.type];
      if (name) this.audio.sfx(name, 'x' in e ? { pan: (e.x / 4.5 - 1) * 0.6 } : undefined);
      if (e.type === 'verse') {
        const t = TRAUMAS[e.kind];
        verseBanner(`${t.name} → ${t.truth.word}`, t.truth.verse);
      }
      if (e.type === 'weaken' && !this.seenWeak) this.seenWeak = true;
    }
  }

  private transitions(w: World): void {
    const run = w.run;
    switch (w.state) {
      case 'levelup': {
        this.paused = true;
        this.audio.sfx('levelup');
        const offer = () => showScreen(S.levelUpScreen(run, run.offers(), o => {
          run.choose(o);
          w.resume();
          if (w.state === 'levelup') offer(); else this.resume();
        }), true);
        offer();
        break;
      }
      case 'chapel': {
        this.paused = true;
        const rec = this.neuro.state.source === 'band' && this.neuro.state.reliable ? this.neuro.state.recommendation : null;
        let settled = false;
        showScreen(S.chapelScreen(rec, rec !== null, ok => {
          if (settled || this.world !== w) return;
          settled = true;
          w.blessChapel(ok);
          if (ok) toast('Błogosławieństwo: pokój i siła na resztę rozdziału');
          this.resume();
        }), true);
        break;
      }
      case 'fallen': {
        this.paused = true;
        const text = STORY.fall[Math.floor(Math.random() * STORY.fall.length)];
        showScreen(S.fallScreen(text, () => {
          this.world = World.retry(w, randomSeed());
          this.save.stats.falls++;
          this.resume();
        }), true);
        break;
      }
      case 'exit': {
        this.paused = true;
        run.roomIndex++;
        const v = STORY.whispers[Math.floor(Math.random() * STORY.whispers.length)];
        let done = false;
        const go = () => { if (!done) { done = true; this.enterRoom(); } };
        showScreen(S.whisperScreen(v, go), true);
        setTimeout(go, 2600);
        break;
      }
      case 'bossDone':
        this.paused = true;
        this.finishChapter(run);
        break;
      default:
        break;
    }
  }

  private finishChapter(run: Run): void {
    const s = this.save, ch = run.chapter;
    const before = rankIndex(s, RANKS);
    const manna = run.manna;
    s.light += run.light;
    s.manna += manna;
    const prev = s.cleared[ch.id];
    s.cleared[ch.id] = { at: Date.now(), falls: run.stats.falls, fragments: Math.max(prev?.fragments ?? 0, run.stats.fragments), times: (prev?.times ?? 0) + 1 };
    if (!s.codex.includes(ch.revelationId)) s.codex.push(ch.revelationId);
    s.stats.traumas += Object.values(run.stats.digested).reduce((a, b) => a + (b ?? 0), 0);
    s.stats.fragments += run.stats.fragments;
    s.stats.chapters++;
    const after = rankIndex(s, RANKS);
    this.persist();
    const promoted = after > before ? RANKS[after].name : null;
    if (promoted) this.audio.sfx('rank');
    this.setPlaying(false);
    this.calmMusic();
    const rev = REVELATIONS.find(r => r.id === ch.revelationId);
    const report = () => showScreen(S.reportScreen({ run, chapter: ch, manna, promoted }, () => {
      if (promoted) toast(`${RANKS[after].name}: ${RANKS[after].blessing}`);
      if (ch.id === 'keter') return this.finale();
      this.map();
    }));
    this.audio.sfx('revelation');
    if (rev) showScreen(S.revelationScreen(rev, report)); else report();
  }

  private finale(): void {
    const trisagion = PRAYERS.find(p => p.id === 'trisagion');
    showScreen(S.storyScreen(STORY.finale, 'Święty, Święty, Święty', () => {
      if (trisagion && !prayed(this.save, 'trisagion')) this.openPrayer(trisagion, () => this.map());
      else this.map();
    }));
  }

  // ─── test hook (only with ?autotest) ─────────────────────────────
  testApi() {
    return {
      save: this.save,
      world: () => this.world,
      run: () => this.run,
      move: (mx: number, my: number) => { this.input.override = mx || my ? { mx, my } : { mx: 0, my: 0 }; },
      release: () => { this.input.override = null; },
      start: (id: string) => { const ch = CHAPTERS.find(c => c.id === id); if (ch) this.startChapter(ch); },
      skipToMap: () => { this.save.seenDisclaimer = true; this.save.seenIntro = true; this.save.prayers.inwokacja = Date.now(); this.persist(); void this.audio.unlock().then(() => this.map()); },
      playing: () => this.playing && !this.paused,
    };
  }
}

const game = new Game();
if (new URLSearchParams(location.search).has('autotest')) {
  (window as unknown as { __holy: ReturnType<Game['testApi']> }).__holy = game.testApi();
}
