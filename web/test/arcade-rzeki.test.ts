import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  HAND_COLOURS, HAND_ORDER, LINE_COUNT, MAP, MAPS, MOMENTS, STATION, STATIONS, TIPS, V1_PLACES, cleanOwn, legs, lineAt, linesOf, pushTip, route,
  stationLabel, tierName, verseOf, windowTier, type MapId, type StationId,
} from '../src/arcade/rzeki/content';
import { CATALOGS, t, unit } from '../src/arcade/rzeki/i18n';
import {
  bestOf, clearStart, countStation, freshProgress, mapGlow, migrate, setMap, setOwn, setStart, setWay, startOf, stationsLit, tierOf, timesLit, type RzekiProgress,
} from '../src/arcade/rzeki/meta';
import { BREATH, RULES, focusRate } from '../src/arcade/rzeki/rules';
import { LIT_DOWN, LIT_UP, RzekiSim, finaleFor, planBlocks, secText, type SimEvent } from '../src/arcade/rzeki/sim';
import { tileTotal, tilesOpen, tilesAt } from '../src/arcade/rzeki/tiles';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TEXT, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/rzeki/index';
import {
  CAM_MAX, FRAMES, cameraFor, easeCam, figPt, framingOf, labelRowH, layout, litR, storyRect, tapTargets, toScreen, windowR, wordsAt, type Layout,
} from '../src/arcade/rzeki/layout';
import { SHELL, isTwin, stationPts, streamPaths } from '../src/arcade/rzeki/figure';
import { font, fontPx } from '../src/arcade/rzeki/paint';
import { RING, openness, partPath, petalAngle, pieces } from '../src/arcade/rzeki/rose';
import { buildHymn } from '../src/arcade/rzeki/hymn';
import { songProblems } from '../src/arcade/kit/song';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
/** focused at a high level, the focus held */
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** focused just over the threshold */
const MID = frame({ level: 0.55, activity: 2.2, focused: true, hold: 4, calm: 0.4 });
/** under the threshold: not focused */
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 's.news', 'c.tap', 'c.light', 'c.petals', 'c.breath', 'c.drops', 'c.blind'];

type SimOpts = { progress?: Partial<RzekiProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): RzekiSim {
  const sim = new RzekiSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

/** Close any story card as a player would (a tap after it has been up a moment). */
const reader = (sim: RzekiSim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

function drive(sim: RzekiSim, sec: number, f: FocusFrame | ((t: number, sim: RzekiSim) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run until the light is at a station of the way (stage `at`), returns the clock. */
function untilAt(sim: RzekiSim, s: StationId, f: FocusFrame | ((t: number, sim: RzekiSim) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (!(sim.stage === 'at' && sim.station === s) && guard++ < 9000) drive(sim, 0.1, f, clock, reader(sim));
  return clock;
}

/** Focus in the push blocks (held from the lead-in on), rest in the rest blocks: a player at a steady level. */
const steady = (level: number) => (_t: number, s: RzekiSim): FocusFrame => (s.pushBlock
  ? frame({ level, activity: 3, focused: level >= 0.5, hold: Math.max(0, s.blockT - s.leadIn), calm: 0.2 })
  : frame({ level: 0.3, activity: 0, focused: false, calm: 0.6 }));

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

describe('the stations of both pictures (content.ts)', () => {
  it('has all seventeen, in the full map’s order from the gate of heaven to the earth star', () => {
    expect(STATIONS).toEqual(['gateway', 'galactic', 'solar', 'soul', 'crown', 'channels', 'brow', 'throat', 'heart', 'hands', 'plexus', 'void', 'sacral', 'sacrum', 'root', 'feet', 'earth']);
    // the bells fall strictly along the full map's way down (and so rise going up)
    for (let i = 1; i < STATIONS.length; i++) expect(STATION[STATIONS[i]].bell).toBeLessThan(STATION[STATIONS[i - 1]].bell);
    // the midline's stations run from the top down (the hands hang beside the body, the shells hold it all)
    const mid = STATIONS.filter(s => !isTwin(s) && STATION[s].kind !== 'shell');
    for (let i = 1; i < mid.length; i++) expect(STATION[mid[i]].y, mid[i]).toBeGreaterThan(STATION[mid[i - 1]].y);
    // the stars above the head as the brief places them: the soul star ~0.14 H, the solar star ~0.30 H above the crown
    expect(STATION.crown.y - STATION.soul.y).toBeCloseTo(0.153, 1);
    expect(STATION.crown.y - STATION.solar.y).toBeCloseTo(0.31, 1);
    expect(STATION.earth.y).toBeGreaterThan(1);
  });

  it('gives the four maps their stations: all 17, picture 2’s twelve, picture 1’s eleven, the seven with hands and feet', () => {
    expect(MAPS).toEqual(['all', 'twelve', 'subtle', 'seven']);
    expect(MAP.all.stations).toHaveLength(17);
    expect(MAP.twelve.stations).toEqual(['gateway', 'galactic', 'solar', 'soul', 'crown', 'brow', 'throat', 'heart', 'plexus', 'sacral', 'root', 'earth']);
    expect(MAP.subtle.stations).toEqual(['crown', 'channels', 'brow', 'throat', 'heart', 'hands', 'plexus', 'void', 'sacral', 'sacrum', 'root']);
    expect(MAP.seven.stations).toEqual(['crown', 'brow', 'throat', 'heart', 'hands', 'plexus', 'sacral', 'root', 'feet']);
    expect([MAP.all.picture, MAP.twelve.picture, MAP.subtle.picture]).toEqual([0, 2, 1]);
    // each map keeps the full map's order; picture 2's map holds exactly its twelve, picture 1's has none of picture 2's own
    for (const m of MAPS) {
      const idx = MAP[m].stations.map(s => STATIONS.indexOf(s));
      expect(idx, m).toEqual([...idx].sort((a, b) => a - b));
    }
    expect(MAP.twelve.stations.every(s => STATION[s].map12)).toBe(true);
    expect(STATIONS.filter(s => STATION[s].map12)).toEqual(MAP.twelve.stations);
  });

  it('names each station as the maps do: picture 2’s name, picture 1’s Sanskrit name and number where it has the centre', () => {
    expect(stationLabel('heart')).toBe('Serce · Anahata (4)');
    expect(stationLabel('crown')).toBe('Korona · Sahastrara (7)');
    expect(stationLabel('root')).toBe('Podstawa · Mooladhara (1)');
    expect(stationLabel('sacrum')).toBe('Kość krzyżowa · Mooladhara');
    expect(stationLabel('soul')).toBe('Gwiazda duszy · mapa 12 centrów');
    expect(stationLabel('galactic')).toBe('Czakra galaktyczna · mapa 12 centrów');
    expect(stationLabel('hands')).toBe('Dłonie · mapa dłoni 1–7');
    expect(stationLabel('channels')).toBe('Trzy kanały · Ida · Sushumna · Pingala');
    expect(stationLabel('void')).toBe('Pustka, ocean · Bhavsagar');
    expect(stationLabel('feet')).toBe('Stopy');
    // picture 1's numbers on the spine, 1 at the root … 7 at the crown
    expect((['root', 'sacral', 'plexus', 'heart', 'throat', 'brow', 'crown'] as const).map(s => STATION[s].num)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('colours each station as the pictures do', () => {
    const [hr, hg, hb] = rgb(STATION.heart.hue);
    expect(hg).toBeGreaterThan(Math.max(hr, hb));                 // the heart green
    const [cr, cg, cb] = rgb(STATION.crown.hue);
    expect(cb).toBeGreaterThan(cg);
    expect(cr).toBeGreaterThan(cg);                               // the crown violet
    expect(STATION.crown.rose.outerEach!.length).toBeGreaterThanOrEqual(7);   // picture 1's many-coloured crown
    const [rr, rg2, rb] = rgb(STATION.root.hue);
    expect(rr).toBeGreaterThan(2 * Math.max(rg2, rb) - 40);       // the root red
    const [tr, , tb] = rgb(STATION.throat.hue);
    expect(tb).toBeGreaterThan(tr);                               // the throat blue
    const [pr, pg, pb] = rgb(STATION.plexus.hue);
    expect(Math.min(pr, pg)).toBeGreaterThan(pb + 80);            // the solar plexus yellow
    const [sr, sg, sb] = rgb(STATION.sacral.hue);
    expect(sr).toBeGreaterThan(sg);
    expect(sg).toBeGreaterThan(sb);                               // the sacral orange
    const [er, eg, eb] = rgb(STATION.earth.hue);
    expect(er).toBeGreaterThan(eg);
    expect(eg).toBeGreaterThan(eb);                               // the earth star brown
    expect(rgb(STATION.soul.hue).every(v => v > 220)).toBe(true); // the soul star white
    // the hand map: 1 the wrist … 7 the palm, each finger the colour of its centre
    expect(HAND_ORDER).toEqual(['wrist', 'thumb', 'middle', 'little', 'index', 'ring', 'palm']);
    expect(HAND_COLOURS.thumb).toBe(STATION.sacral.hue);
    expect(HAND_COLOURS.index).toBe(STATION.throat.hue);
    expect(HAND_COLOURS.middle).toBe(STATION.plexus.hue);
    expect(HAND_COLOURS.little).toBe(STATION.heart.hue);
    expect(HAND_COLOURS.palm).toBe(STATION.crown.hue);
    expect(HAND_COLOURS.wrist).toBe(STATION.root.hue);
  });

  it('gives each station a rose window of church glass with its own tracery', () => {
    const seen = new Set<string>();
    for (const s of STATIONS) {
      const r = STATION[s].rose;
      expect(r.inner).toBeGreaterThanOrEqual(3);
      expect(r.outer).toBeGreaterThanOrEqual(r.inner);
      for (const c of [...r.glass, ...(r.innerEach ?? []), ...(r.outerEach ?? [])]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      seen.add(`${r.inner}${r.innerShape}${r.outer}${r.outerShape}`);
    }
    expect(seen.size).toBe(STATIONS.length);
  });

  it('names the brief’s verse for every station, going down and going up, each one that exists', () => {
    const want: Record<StationId, [string, string]> = {
      gateway: ['gen28.17', 'jhn10.9'], galactic: ['psa8.3-4', 'psa19.1'], solar: ['jas1.17', 'isa60.19'], soul: ['psa23.3', 'psa42.1'],
      crown: ['php4.7', 'php4.7'], channels: ['isa30.21', 'psa121.6'], brow: ['eph1.18', 'eph1.18'], throat: ['psa141.3', 'heb13.15'],
      heart: ['rom5.5', 'rom5.5'], hands: ['psa90.17', 'psa63.4'], plexus: ['jhn20.22', 'eph3.16'], void: ['psa107.29', 'psa46.4'],
      sacral: ['jhn7.38-39', 'jhn7.38-39'], sacrum: ['ezk37.5-6', 'rom8.11'], root: ['col2.7', 'eph3.17'], feet: ['psa40.2', 'psa18.32'],
      earth: ['psa85.11', 'isa6.3'],
    };
    for (const s of STATIONS) {
      expect([verseOf(s, 'down'), verseOf(s, 'up')], s).toEqual(want[s]);
      for (const d of ['down', 'up'] as const) expect(passage(verseOf(s, d)).text.length).toBeGreaterThan(10);
    }
  });

  it('walks a map down from its top and up from its bottom; both is down then up', () => {
    expect(route('all', 'down')[0]).toBe('gateway');
    expect(route('all', 'up')[0]).toBe('earth');
    expect(route('subtle', 'down')[0]).toBe('crown');
    expect(route('subtle', 'up')[0]).toBe('root');
    expect(route('seven', 'up').at(-1)).toBe('crown');
    expect(legs('both')).toEqual(['down', 'up']);
    expect(legs('up')).toEqual(['up']);
  });

  it('prays the founder’s form at each station going down, gives thanks going up, and takes own words instead', () => {
    expect(lineAt('heart', 'down')).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij moje serce i niech popłynie miłość.');
    expect(lineAt('crown', 'down')).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij mój umysł i niech popłynie pokój.');
    expect(lineAt('hands', 'down')).toMatch(/wypełnij moje dłonie i niech popłynie błogosławieństwo\.$/);
    expect(lineAt('sacrum', 'down')).toMatch(/wypełnij moje kości i niech popłynie życie\.$/);
    for (const s of STATIONS) {
      expect(lineAt(s, 'down')).toMatch(/^Przez Jezusa Chrystusa, Duchu Święty, wypełnij .+ i niech popłynie .+\.$/);
      expect(lineAt(s, 'up')).toMatch(/^Dziękuję, Duchu Święty, za /);
    }
    const own = 'przez Jezusa Chrystusa Duchu święty wypełnij to miejsce';
    expect(lineAt('brow', 'down', own)).toBe(own);
    expect(lineAt('brow', 'up', own)).toBe(own);
    // German never says "Geist" twice in one prayer
    for (const s of STATIONS) expect((CATALOGS.de[`pray.${s}` as 'pray.crown'] as string).match(/Geist/g)).toHaveLength(1);
  });

  it('has, for every station in all four languages, its name, where the attention rests, its gift, its prayer, its thanks, its picture and three narrator lines', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Readonly<Record<string, unknown>>;
      for (const s of STATIONS) {
        for (const k of [`name.${s}`, `where.${s}`, `gift.${s}`, `from.${s}`, `pray.${s}`, `thank.${s}`, `tip.place.${s}`, `say.at.${s}.1`, `say.at.${s}.2`, `say.at.${s}.3`]) {
          expect(typeof cat[k] === 'string' && (cat[k] as string).length > 2, `${l}.${k}`).toBe(true);
        }
      }
      for (const m of MAPS) for (const k of [`map.${m}`, `map.${m}.pic`]) expect(typeof cat[k], `${l}.${k}`).toBe('string');
    }
  });

  it('keeps own words plain text: no markup, no control characters, at most 120 characters', () => {
    expect(cleanOwn('  <b>Duchu</b>\n\tŚwięty  ')).toBe('b Duchu /b Święty');
    expect(cleanOwn(42)).toBe('');
    expect([...cleanOwn('ą'.repeat(300))]).toHaveLength(RULES.ownMax);
    expect(cleanOwn('a\u0000b c')).toBe('a b c');
  });

  it('asks for the station’s own picture, the slow repetition every third push, and the rising picture going up', () => {
    expect(pushTip('brow', 'down', 0)).toBe(TIPS.place.brow);
    expect(pushTip('brow', 'down', 2)).toBe(TIPS.repeat);
    expect(pushTip('heart', 'up', 1)).toBe(TIPS.rise);
    expect(t(TIPS.place.brow)).toMatch(/między brwiami od środka/);
    expect(t(TIPS.place.hands)).toMatch(/nadgarstek, kciuk/);
    expect(t(TIPS.repeat)).toMatch(/słowo po słowie/);
  });
});

describe('the glass, piece by piece (tiles.ts)', () => {
  it('opens every station’s glass in whole pieces, never closing, all of it at full', () => {
    for (const s of STATIONS) {
      expect(tilesOpen(s, 0), s).toBe(0);
      expect(tilesOpen(s, 1), s).toBe(tileTotal(s));
      let prev = 0;
      for (let f = 0; f <= 1.0001; f += 0.005) {
        const n = tilesAt(s, f);
        expect(n, s).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = n;
      }
    }
    // the hand map's seven, the feet's instep and five toes, the sacrum's five bands
    expect(tileTotal('hands')).toBe(7);
    expect(tileTotal('feet')).toBe(6);
    expect(tileTotal('sacrum')).toBe(5);
  });
});

describe('the founder’s fill rule: light only from real concentration, and slower', () => {
  it('loads only while focused: faster above the threshold and as the focus is held', () => {
    const R = RULES;
    expect(focusRate(0.9, false, 20)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeCloseTo(R.fillFocus * 0.6, 9);
    expect(focusRate(1, true, 12)).toBeCloseTo(R.fillFocus * 1.4 * 1.5, 9);
    expect(focusRate(0.3, true, 0)).toBeCloseTo(R.fillFocus * 0.6, 9);   // a forgiven dip still loads at the base rate
    for (const h of [0, 3, 6, 12]) expect(focusRate(0.8, true, h + 1)).toBeGreaterThanOrEqual(focusRate(0.8, true, h));
    for (const lv of [0.5, 0.6, 0.8, 0.95]) expect(focusRate(lv + 0.05, true, 5)).toBeGreaterThan(focusRate(lv, true, 5));
    // a focus held steady loads a station in ~30 s at the threshold, ~20 s at a high level
    expect(1 / focusRate(0.5, true, 12)).toBeGreaterThan(28);
    expect(1 / focusRate(0.5, true, 12)).toBeLessThan(34);
    expect(1 / focusRate(0.75, true, 12)).toBeGreaterThan(17);
    expect(1 / focusRate(0.75, true, 12)).toBeLessThan(22);
  });

  it('fills nothing in rest, in the warm-up, in the finale, without a signal, below the threshold, or in the lead-in', () => {
    // the warm-up of a first session (focused all along)
    const first = makeSim();
    first.stay();
    drive(first, 2, HIGH);
    first.stay();
    const c0 = { t: 2 };
    while (first.block.kind === 'warmup') drive(first, 0.5, HIGH, c0, reader(first));
    expect(first.fill).toBe(0);
    // the lead-in, then below the threshold, then no signal: nothing
    const sim = later();
    const clock = { t: 0 };
    untilAt(sim, 'gateway', HIGH, clock);
    while (sim.blockT < sim.leadIn - 0.2) drive(sim, 0.1, HIGH, clock);
    expect(sim.fill).toBe(0);
    const at = sim.blockT;
    drive(sim, 0.3, LOW, clock);
    const f0 = sim.fill;
    drive(sim, 6, LOW, clock);
    expect(sim.fill).toBe(f0);
    drive(sim, 6, NONE, clock);
    expect(sim.fill).toBe(f0);
    expect(at).toBeGreaterThan(0);
    // rest
    while (!sim.restBlock) drive(sim, 0.25, LOW, clock, reader(sim));
    const fr = sim.fill;
    drive(sim, 12, CALM, clock, reader(sim));
    drive(sim, 6, HIGH, clock, reader(sim));
    expect(sim.fill).toBe(fr);
    // the finale
    const end = later({ planned: 60 });
    const ce = { t: 0 };
    while (end.phase === 'play') drive(end, 0.25, LOW, ce, reader(end));
    const fe = end.fill;
    drive(end, 4, HIGH, ce, reader(end));
    expect(end.fill).toBe(fe);
  });

  it('fills while focused in a sighted push past its lead-in, faster as the focus is held', () => {
    const rateAt = (hold: number) => {
      const sim = later();
      const clock = { t: 0 };
      untilAt(sim, 'gateway', HIGH, clock);
      while (sim.blockT < sim.leadIn + 1) drive(sim, 0.1, frame({ level: 0.6, activity: 2.5, focused: true, hold }), clock);
      return sim.rate();
    };
    expect(rateAt(0)).toBeGreaterThan(0);
    expect(rateAt(12)).toBeCloseTo(rateAt(0) * 1.5, 6);
    const sim = later();
    const clock = { t: 0 };
    untilAt(sim, 'gateway', HIGH, clock);
    const f0 = sim.fill;
    drive(sim, 8, HIGH, clock);
    expect(sim.fill).toBeGreaterThan(f0);
    expect(sim.goldOn).toBe(true);
  });

  it('never fills from taps: a tap stays with the station — its prayer returns, a ring, a tone', () => {
    const sim = later();
    const clock = { t: 0 };
    untilAt(sim, 'gateway', LOW, clock);
    const f0 = sim.fill;
    const evs: SimEvent[] = [];
    for (let i = 0; i < 30; i++) {
      sim.stay();
      evs.push(...sim.take());
      drive(sim, 0.1, LOW, clock);
    }
    expect(sim.fill).toBe(f0);
    expect(sim.reshow).toBeGreaterThan(0);
    expect(ofType(evs, 'tap').length).toBe(30);
    expect(sim.key(' ', true)).toBe(true);
    expect(sim.fill).toBe(f0);
  });

  it('never loses what was gained: the light only grows, through rest, dips and lost signals', () => {
    const sim = later({ planned: 600 });
    let prev = 0, prevLit = 0;
    const clock = { t: 0 };
    const rnd = mulberry32(9);
    drive(sim, 400, () => (rnd() < 0.3 ? NONE : rnd() < 0.5 ? HIGH : LOW), clock, () => {
      if (sim.placesNow === prevLit && sim.stage === 'at') expect(sim.fill).toBeGreaterThanOrEqual(prev - 1e-12);
      if (sim.placesNow !== prevLit) prevLit = sim.placesNow;
      prev = sim.stage === 'at' ? sim.fill : 0;
      reader(sim)();
    });
    expect(sim.placesNow).toBeGreaterThan(0);
  });

  it('shows the band’s real level on the gauge in a sighted push (no neutral 0.45), calm in rest, nothing without a signal', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 2, MID, clock);
    expect(sim.meter()).toBeNull();                       // the lead-in
    drive(sim, 6, frame({ level: 0.37, activity: 1.5, focused: false }), clock);
    expect(sim.meter()).toBeCloseTo(0.37, 6);
    drive(sim, 1, HIGH, clock);
    expect(sim.meter()).toBeCloseTo(0.9, 6);
    drive(sim, 1, NONE, clock);
    expect(sim.meter()).toBeNull();
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    drive(sim, 6, CALM, clock, reader(sim));
    expect(sim.meter()).toBeCloseTo(sim.calmShown, 9);
  });

  it('lets the drops tell the truth: in a push they flow only while the light loads; the warm-up and the finale flow', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, sim.leadIn + 1, LOW, clock);
    const d0 = sim.drops;
    drive(sim, 5, LOW, clock);
    expect(sim.drops).toBe(d0);
    drive(sim, 5, HIGH, clock);
    expect(sim.drops).toBeGreaterThan(d0 + 5);
    const first = makeSim({ tuning: BEGINNER, planned: 40 });
    drive(first, 1, NONE);
    expect(first.score).toBeGreaterThan(0);                // the warm-up's drops: the smoke scores at once
  });

  it('paces a 10-minute session at about 5–7 stations at the threshold, ~37 s of focus a station (three seeds)', () => {
    const pace = (level: number, seed: number) => {
      const sim = later({ planned: 600, seed });
      let load = 0;
      drive(sim, 600, steady(level), { t: 0 }, () => { if (sim.rate() > 0) load += STEP; reader(sim)(); });
      return { lit: sim.placesNow, per: load / Math.max(1, sim.placesNow) };
    };
    const at = [1, 2, 3].map(s => pace(0.5, s)), high = [1, 2, 3].map(s => pace(0.75, s));
    for (const r of at) {
      expect(r.lit).toBeGreaterThanOrEqual(5);
      expect(r.lit).toBeLessThanOrEqual(7);
      expect(r.per).toBeGreaterThan(32);
      expect(r.per).toBeLessThan(43);
    }
    for (const r of high) {
      expect(r.per).toBeGreaterThan(18);
      expect(r.per).toBeLessThan(26);
      expect(r.lit).toBeGreaterThan(Math.max(...at.map(x => x.lit)));
    }
  });

  it('with the kit’s own focus input: no rise in push, no light; a moderate rise lights 6–8 stations in 10 minutes', () => {
    /** a player whose activity rises by `amp` % in the push blocks (with the haemodynamic lag), with noise and Mayer waves */
    const player = (amp: number, seed: number) => {
      const sim = later({ planned: 600, seed });
      const fi = new FocusInput(TUNING);
      const rnd = mulberry32(seed * 7 + 1);
      let act = 0, noise = 0;
      drive(sim, 600, (tt, s) => {
        act += ((s.pushBlock ? amp : 0) - act) * (1 - Math.exp(-STEP / 4));
        noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
        return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
      }, { t: 0 }, reader(sim));
      return sim.placesNow;
    };
    for (const seed of [1, 2, 3]) {
      expect(player(0, seed)).toBe(0);
      const mid = player(2, seed);
      expect(mid).toBeGreaterThanOrEqual(6);
      expect(mid).toBeLessThanOrEqual(8);
      expect(player(4, seed)).toBeGreaterThan(mid);
    }
  });
});

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates light and abiding, ending on a rest', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) {
        expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(b.dur).toBeLessThanOrEqual(31);
      }
    }
  });

  it('fits a short test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeLessThanOrEqual(Math.max(planned, 8) + 1e-6);
      }
    }
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock, reader(sim));
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });

  it('judges each block once at its end, from its last 15 s', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].verdict).toBe(true);
  });

  it('gives the strategy of the station the light is at, and the breath in rest', () => {
    const sim = later({ progress: { map: 'seven' } });
    untilAt(sim, 'crown', MID);
    expect(sim.tip).toBe(t(TIPS.place.crown));
    const clock = { t: sim.t };
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, reader(sim));
    expect(TIPS.rest.map(k => t(k))).toContain(sim.tip);
  });
});

describe('the way through a map', () => {
  it('comes down from the open heaven to the map’s first station, lights each in turn and flows on', () => {
    const sim = later({ progress: { map: 'seven' } });
    expect(sim.stage).toBe('enter');
    expect(sim.dir).toBe('down');
    const clock = { t: 0 };
    const evs = drive(sim, RULES.heavenSec + 0.1, HIGH, clock);
    expect(ofType(evs, 'arrive')[0]).toMatchObject({ station: 'crown', dir: 'down', idx: 0 });
    const more = drive(sim, 150, steady(0.9), clock, reader(sim));
    const fulls = ofType(more, 'full').map(e => e.station);
    expect(fulls.slice(0, 2)).toEqual(['crown', 'brow']);
    expect(ofType(more, 'flow')[0]).toMatchObject({ from: 'crown', to: 'brow', dir: 'down' });
    expect(sim.lit.crown & LIT_DOWN).toBeTruthy();
    // its glass opened piece by piece, one tick each
    const petals = ofType(more, 'petal').filter(e => e.station === 'crown').map(e => e.n);
    expect(petals).toEqual(Array.from({ length: tileTotal('crown') }, (_, i) => i + 1));
  });

  it('walks a whole map down, shows the closing card, then up with thanksgiving', () => {
    const sim = later({ planned: 1800, progress: { map: 'seven' } });
    const evs = drive(sim, 1500, steady(0.95), { t: 0 }, reader(sim));
    const wholes = ofType(evs, 'whole').map(e => e.dir);
    expect(wholes.slice(0, 2)).toEqual(['down', 'up']);
    const stories = ofType(evs, 'story').map(e => e.kind);
    expect(stories).toContain('down');
    expect(stories).toContain('up');
    const firstUp = ofType(evs, 'arrive').find(a => a.dir === 'up')!;
    expect(firstUp.station).toBe('feet');
  });

  it('takes the stream out along the arms to the hands and down the legs to the feet', () => {
    const [l, r] = streamPaths('heart', 'hands');
    expect(l.at(-1)![0]).toBeLessThan(-0.1);
    expect(r.at(-1)![0]).toBeGreaterThan(0.1);
    expect(streamPaths('root', 'feet')).toHaveLength(2);
    expect(streamPaths('crown', 'brow')).toHaveLength(1);
    expect(stationPts('hands')).toHaveLength(2);
  });

  it('shows own words at every station instead of the prayer', () => {
    const sim = later({ progress: { own: '  Przez Jezusa Chrystusa, Duchu Święty, wypełnij to miejsce  ' } });
    drive(sim, RULES.heavenSec + 0.2, MID);
    expect(sim.line).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij to miejsce');
  });
});

describe('the way goes on next session', () => {
  it('saves where the way stopped and the light gathered there, and the next session starts there', () => {
    const sim = later({ planned: 300, progress: { map: 'seven' } });
    const clock = { t: 0 };
    untilAt(sim, 'throat', steady(0.9), clock);
    drive(sim, 3, steady(0.9), clock, reader(sim));
    sim.finish();
    expect(sim.p.pos).toMatchObject({ map: 'seven', dir: 'down' });
    const stopped = route('seven', 'down')[sim.p.pos!.idx];
    expect(['throat', 'heart']).toContain(stopped);
    expect(sim.result().highlights.join(' ')).toMatch(/Następnym razem: od (Gardła|Serca)\./);
    // the next session: the light comes down to that station, with what it had gathered
    const gathered = sim.p.pos!.fill;
    const next = new RzekiSim({ progress: sim.p, rng: mulberry32(2), plannedSec: 300, eeg: false, tuning: TUNING });
    next.start();
    expect(next.resumed).toBe(true);
    expect(next.station).toBe(stopped);
    drive(next, RULES.heavenSec + 0.1, LOW);
    expect(next.stage).toBe('at');
    expect(next.fill).toBeCloseTo(gathered, 6);
    // the stations above it shine as already lit
    expect(next.lit.crown & LIT_DOWN).toBeTruthy();
  });

  it('starts from a chosen station ("Zacznij tutaj") or from the top ("Od początku")', () => {
    const p = freshProgress();
    expect(startOf(p)).toMatchObject({ station: 'gateway', idx: 0, resumed: false });
    expect(setStart(p, 'heart')).toBe(true);
    expect(startOf(p)).toMatchObject({ station: 'heart', dir: 'down', fill: 0, resumed: true });
    const sim = new RzekiSim({ progress: p, rng: mulberry32(1), plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.station).toBe('heart');
    clearStart(p);
    expect(startOf(p).station).toBe('gateway');
    // a station of another map: false, nothing changes
    setMap(p, 'twelve');
    expect(setStart(p, 'hands')).toBe(false);
    expect(p.pos).toBeNull();
  });

  it('keeps the station when the map or the way changes, if the new map has it; else the top', () => {
    const p = freshProgress();
    setStart(p, 'heart');
    p.pos!.fill = 0.4;
    setMap(p, 'seven');
    expect(startOf(p)).toMatchObject({ station: 'heart', fill: 0.4 });
    setMap(p, 'all');
    setStart(p, 'void');
    setMap(p, 'twelve');
    expect(startOf(p)).toMatchObject({ station: 'gateway', idx: 0, resumed: false });
    setMap(p, 'all');
    setWay(p, 'up');
    expect(startOf(p)).toMatchObject({ station: 'void', dir: 'up', idx: route('all', 'up').indexOf('void') });
  });

  it('after a whole way, the next session goes on with the next way (up after down), or from the top', () => {
    const sim = later({ planned: 1800, progress: { map: 'seven', way: 'both' } });
    let guard = 0;
    while (sim.descentsNow === 0 && guard++ < 20000) drive(sim, 0.5, steady(0.95), { t: sim.t }, () => undefined);
    // the closing card is up: the way down is whole
    sim.finish();
    expect(sim.p.pos).toMatchObject({ dir: 'up', idx: 0 });
  });
});

describe('the light and the signal', () => {
  it('a blind push loads unseen by the same rule and shows it at the block’s end; nothing leaks', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : LOW), clock, reader(sim));
    while (sim.blind && (sim.stage !== 'at' || sim.blockT < sim.leadIn + 0.5)) drive(sim, 0.1, HIGH, clock, reader(sim));
    const shown = sim.fill, scoreAt = sim.score;
    drive(sim, 4, HIGH, clock, reader(sim));
    if (sim.blind) {
      expect(sim.meter()).toBeNull();
      expect(sim.songLevel(HIGH)).toBeNull();
      expect(sim.padLevel(HIGH)).toBeNull();
      expect(sim.fill).toBe(shown);
      expect(sim.hidden).toBeGreaterThan(0);
      expect(sim.score).toBe(scoreAt);                      // no drops flow in the dark
    }
    let guard = 0;
    const evs: SimEvent[] = [];
    while (sim.blind && guard++ < 2000) evs.push(...drive(sim, 0.1, HIGH, clock, reader(sim)));
    const end = ofType(evs, 'blindEnd')[0];
    expect(end).toBeTruthy();
    expect(end.share).toBeGreaterThan(0.5);
    drive(sim, RULES.revealSec + 0.2, CALM, clock, reader(sim));
    expect(sim.fill).toBeGreaterThan(shown);
  });

  it('rest: the breath turns in 4 / out 6, calm gathers drops and abiding; without a signal nothing flows', () => {
    const sim = later();
    const clock = { t: 0 };
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    const s0 = sim.score;
    const evs = drive(sim, 12, CALM, clock, reader(sim));
    expect(ofType(evs, 'breathTurn').length).toBeGreaterThanOrEqual(2);
    expect(BREATH).toBe(10);
    expect(sim.light).toBeCloseTo(RULES.restLight, 1);
    expect(sim.score - s0).toBeGreaterThan(12);
    expect(sim.abideNow).toBeGreaterThan(5);
    const s1 = sim.score;
    drive(sim, 3, NONE, clock, reader(sim));
    expect(sim.score).toBe(s1);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on) within 22 s', () => {
    for (const fresh of [true, false]) {
      const sim = fresh ? makeSim({ tuning: BEGINNER, planned: 40 }) : later({ planned: 40 });
      let next = 0.65, space = 2;
      const clock = { t: 0 };
      const seen: number[] = [];
      drive(sim, 22, HIGH, clock, tt => {
        if (tt >= next) { next += 0.65; sim.stay(); }
        if (tt >= space) { space += 2; sim.key(' ', true); sim.key(' ', false); }
        if (Math.abs(tt - Math.round(tt)) < STEP / 2) seen.push(sim.score);
      });
      expect(sim.result().score).toBeGreaterThan(0);
      expect(seen.at(-1)!).toBeGreaterThan(seen[3]);
    }
  });

  it('opens the first session with the two-page story card and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story).toMatchObject({ kind: 'open', page: 0, pages: 2 });
    expect(sim.block.kind).toBe('warmup');
    const clock = { t: 0 };
    const evs = drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story!.page).toBe(1);
    evs.push(...drive(sim, 1, MID, clock));
    sim.stay();
    expect(sim.story).toBeNull();
    evs.push(...drive(sim, 120, steady(0.8), clock, reader(sim)));
    const coach = ofType(evs, 'coach').map(e => e.what);
    for (const c of ['tap', 'light', 'petals', 'breath'] as const) expect(coach).toContain(c);
    // a returning player hears nothing twice, and a player of the first version sees what is new, once
    const again = makeSim({ progress: { ...sim.p } });
    expect(again.story).toBeNull();
    const old = makeSim({ progress: { sessions: 3, seen: ['s.open', 'c.tap'] } });
    expect(old.story).toMatchObject({ kind: 'news', pages: 1 });
    const old2 = makeSim({ progress: { ...old.p } });
    expect(old2.story).toBeNull();
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH);
    const a = sim.result();
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best[String(300)]).toBe(a.score);
    expect(a.unit).toBe(unit(a.score));
  });

  it('settles once at the end (or early), counting the session, its stations and ways', () => {
    const sim = later({ planned: 60 });
    drive(sim, 66, HIGH, { t: 0 }, reader(sim));
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.drops).toBe(sim.score);
    const early = later({ planned: 300 });
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('closes with a passage that exists, fitting what happened', () => {
    const sim = later();
    drive(sim, 20, HIGH);
    const r = sim.result();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    expect(makeSim().closingVerse()).toBe('jhn7.38-39');
  });

  it('says what happened in the summary: readable stats and highlights, and where the way goes on', () => {
    const sim = later({ planned: 600 });
    drive(sim, 300, steady(0.9), { t: 0 }, reader(sim));
    const r = sim.result();
    expect(r.stats.length).toBeGreaterThanOrEqual(6);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
    expect(r.highlights.some(h => h.startsWith('Następnym razem: od '))).toBe(true);
  });

  it('lets the rivers from the pool grow with the drops', () => {
    const sim = later();
    expect(sim.river).toBe(0);
    drive(sim, 60, steady(0.8), { t: 0 }, reader(sim));
    expect(sim.river).toBeGreaterThan(0);
    expect(sim.river).toBeLessThanOrEqual(1);
  });
});

describe('the meta', () => {
  it('counts the stations lit each way and glows them on the lobby’s figure', () => {
    const p = freshProgress();
    expect(stationsLit(p)).toBe(0);
    expect(mapGlow(p, 'heart')).toBe(0);
    countStation(p, 'heart', 'down');
    countStation(p, 'hands', 'up', 2);
    expect(timesLit(p, 'hands')).toBe(2);
    expect(stationsLit(p)).toBe(2);
    expect(stationsLit(p, MAP.twelve.stations)).toBe(1);
    expect(mapGlow(p, 'heart')).toBeGreaterThan(0.35);
  });

  it('makes a window richer the more often its station is lit: gilded at 3, a crown of glass at 10, golden tracery at 25', () => {
    expect([0, 2, 3, 9, 10, 24, 25, 400].map(windowTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const p = freshProgress();
    countStation(p, 'heart', 'down', 2);
    expect(tierOf(p, 'heart')).toBe(0);
    countStation(p, 'heart', 'up', 1);
    expect(tierOf(p, 'heart')).toBe(1);
    for (const k of [1, 2, 3] as const) expect(tierName(k).length).toBeGreaterThan(3);
  });

  it('chooses the map and the way, and keeps own words as plain text', () => {
    const p = freshProgress();
    expect(p.map).toBe('all');
    expect(p.way).toBe('both');
    expect(setMap(p, 'subtle')).toBe(true);
    expect(setMap(p, 'nine')).toBe(false);
    expect(p.map).toBe('subtle');
    expect(setWay(p, 'up')).toBe(true);
    expect(setWay(p, 'sideways')).toBe(false);
    expect(setOwn(p, '<i>Moje</i> słowa')).toBe('i Moje /i słowa');
  });
});

describe('old saves (progress v1 → v2)', () => {
  it('moves a version-1 save’s seven places onto the stations they became, keeping everything else', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, way: 'down', own: 'Moje <słowa>\n', descents: 2, ascents: 1, best: { '300': 840 }, drops: 2400, abideBest: 24.5,
      abideAll: 300, song: false, seen: ['s.open', 'c.tap'], lastLen: 300,
      down: { mind: 3, eyes: 2, mouth: 1, heart: 4, breath: 5, inner: 6, feet: 7 }, up: { mind: 1, feet: 2, heart: 'x' },
    };
    const p = mergeSaved(freshProgress(), saved) as RzekiProgress;
    migrate(p);
    expect(p.ver).toBe(2);
    expect(p.map).toBe('all');
    expect(p.pos).toBeNull();
    expect(p.way).toBe('down');
    expect(p.own).toBe('Moje słowa');
    expect(p.down).toMatchObject({ crown: 3, brow: 2, throat: 1, heart: 4, plexus: 5, sacral: 6, feet: 7, gateway: 0, hands: 0 });
    expect(p.up).toMatchObject({ crown: 1, feet: 2, heart: 0 });
    expect(Object.keys(p.down)).toEqual([...STATIONS]);
    expect(Object.keys(V1_PLACES)).toHaveLength(7);
    expect([p.sessions, p.pushes, p.descents, p.ascents, p.drops, p.abideBest, p.abideAll, p.song, p.lastLen]).toEqual([9, 14, 2, 1, 2400, 24.5, 300, false, 300]);
    expect(p.seen).toEqual(['s.open', 'c.tap']);
    expect(bestOf(p)).toBe(840);
    expect(tierOf(p, 'feet')).toBe(1);                      // 9 times lit: its glass stays gilded
    expect(migrate(p)).toBe(p);
    expect(p.down.crown).toBe(3);                           // idempotent
    // it plays, and the player of the first version is told what is new
    const sim = new RzekiSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.story?.kind).toBe('news');
    drive(sim, 10, HIGH, { t: 0 }, reader(sim));
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('reads the placeholder’s save and keeps a version-2 save, repairing fields of a wrong type', () => {
    const p0 = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as RzekiProgress;
    migrate(p0);
    expect([p0.ver, p0.sessions, p0.way, p0.map]).toEqual([2, 4, 'both', 'all']);
    const p = mergeSaved(freshProgress(), {
      ver: 2, sessions: 3, map: 'seven', way: 'up', pos: { map: 'seven', dir: 'up', idx: 3, fill: 0.5 }, down: { heart: 2, ghost: 9 }, best: { 300: 'x' },
    }) as RzekiProgress;
    migrate(p);
    expect(p.map).toBe('seven');
    expect(p.pos).toEqual({ map: 'seven', dir: 'up', idx: 3, fill: 0.5 });
    expect(p.down.heart).toBe(2);
    expect(p.best).toEqual({});
    for (const bad of [{ map: 'seven', dir: 'up', idx: 40 }, { map: 'x', dir: 'up', idx: 1 }, { map: 'all', dir: 'left', idx: 1 }, 'x']) {
      const q = mergeSaved(freshProgress(), { ver: 2, pos: bad }) as RzekiProgress;
      expect(migrate(q).pos).toBeNull();
    }
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 3 }, { ver: 2, down: 'x', up: 5, best: [], seen: null, way: 7, own: { a: 1 }, map: 9 }]) {
      const p = mergeSaved(freshProgress(), junk) as RzekiProgress;
      migrate(p);
      expect(p.ver).toBe(2);
      expect(typeof p.down).toBe('object');
      expect(p.way).toBe('both');
      expect(p.map).toBe('all');
      expect(Array.isArray(p.seen)).toBe(true);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator at least three lines a moment, each fitting a caption (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(LINE_COUNT[m], m).toBeGreaterThanOrEqual(3);
      expect(linesOf(m).every(s => s.length > 5), m).toBe(true);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
    // German never "Gott mit uns"
    for (const v of Object.values(CATALOGS.de)) if (typeof v === 'string') expect(v).not.toMatch(/Gott mit uns/);
  });

  it('suggests strategies, never to concentrate harder; names the maps’ centres but claims no energy, no awakening power, no healing', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          if (/^(tip|howto)\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
          expect(s, `${l}.${k}`).not.toMatch(/kundalini|energi|energy|Energie|uzdrawia|heals you|cures|heilt dich|botar dig|\bwąż|serpent|Schlange|\borm\b/i);
          // the word chakra only inside the names that carry it (picture 2's names)
          if (/czakr|chakra/i.test(s)) expect(k, `${l}.${k}`).toMatch(/^(name|from)\.(galactic|sacral)$/);
        }
      }
    }
    // the how-to's last tip says the band measures attention
    expect(howto(true).tips!.at(-1)).toMatch(/mierzy uwagę/);
  });

  it('bends the headline’s unit (1 kropla, 3 krople, 5 kropli) and writes seconds with a no-break space', () => {
    expect(unit(1)).toBe('kropla');
    expect(unit(3)).toBe('krople');
    expect(unit(5)).toBe('kropli');
    expect(secText(42)).toBe('42 s');
    expect(secText(102)).toBe('1:42');
  });
});

describe('mobile first (DESIGN §12, §13.14) and the camera', () => {
  const camOf = (L: Layout, s: StationId) => cameraFor(L, framingOf(s));

  it('gives the current station a finger-sized target inside the insets at every checked size, for every station, fill and framing', () => {
    for (const sz of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(sz.w, sz.h, sz.insets, touch);
        for (const s of STATIONS) {
          for (const fill of [0, 0.4, 1]) {
            const tg = tapTargets(L, { story: null, place: s, fill, cam: camOf(L, s) });
            expect(tg).toHaveLength(1);
            expect(auditTargets(tg, sz.w, sz.h, L.ins), `${sz.name} ${s} ${fill}`).toEqual([]);
          }
          // the camera on its way between framings too
          const mid = easeCam(L, cameraFor(L, 'body'), camOf(L, s), 0.5);
          expect(auditTargets(tapTargets(L, { story: null, place: s, fill: 0.5, cam: mid }), sz.w, sz.h, L.ins), `${sz.name} ${s} easing`).toEqual([]);
        }
        const card = storyRect(L, 300);
        expect(auditTargets(tapTargets(L, { story: card, place: 'heart', fill: 0.5 }), sz.w, sz.h, L.ins), sz.name).toEqual([]);
        expect(tapTargets(L, { story: null, place: null, fill: 0 })).toEqual([]);
      }
    }
  });

  it('frames each framing whole inside the stage, the figure’s midline kept', () => {
    for (const sz of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(sz.w, sz.h, sz.insets, touch), S = L.stage, H = L.fig.H;
        for (const [name, r] of Object.entries(FRAMES)) {
          const c = cameraFor(L, name as keyof typeof FRAMES);
          expect(c.s, `${sz.name} ${name}`).toBeLessThanOrEqual(CAM_MAX);
          const a = toScreen(c, L.fig.cx + r.x0 * H, L.fig.top + r.y0 * H), b = toScreen(c, L.fig.cx + r.x1 * H, L.fig.top + r.y1 * H);
          expect(a.y, `${sz.name} ${name}`).toBeGreaterThanOrEqual(S.y - 1);
          expect(b.y, `${sz.name} ${name}`).toBeLessThanOrEqual(S.y + S.h + 1);
          expect(toScreen(c, L.fig.cx, 0).x, `${sz.name} ${name}`).toBeCloseTo(L.fig.cx, 6);
          if (name !== 'hands' && name !== 'ground') {
            expect(a.x).toBeGreaterThanOrEqual(S.x - 1);
            expect(b.x).toBeLessThanOrEqual(S.x + S.w + 1);
          }
        }
        // the heavens hold both shells whole; the body framing is the layout itself
        const hv = cameraFor(L, 'heavens'), out = SHELL.gateway;
        expect(toScreen(hv, 0, L.fig.top + (out.cy - out.ry) * H).y).toBeGreaterThanOrEqual(S.y - 1);
        expect(cameraFor(L, 'body')).toEqual({ s: 1, ox: 0, oy: 0 });
      }
    }
  });

  it('nears the hands enough to read the hand map on a phone, and not at all on a big screen', () => {
    for (const sz of CHECK_SIZES) {
      const L = layout(sz.w, sz.h, sz.insets, true);
      const s = cameraFor(L, 'hands').s;
      // a hand (0.1 H) at least ~55 px tall on the screen upright; a phone on its side keeps the words beside the
      // figure, so its hands come as near as the figure's column lets them (36 px with the chart on, 40 without)
      expect(0.1 * L.fig.H * s, sz.name).toBeGreaterThanOrEqual(L.shape === 'side' ? 35 : 55);
    }
    const qhd = layout(1587, 1300, { top: 118, right: 0, bottom: 0, left: 0 }, false);
    expect(cameraFor(qhd, 'hands').s).toBe(1);
  });

  it('lays a phone upright out tall: the figure in the middle, the prayer below it, nothing under the HUD or off the band', () => {
    for (const sz of CHECK_SIZES.filter(c => c.h > c.w)) {
      const L = layout(sz.w, sz.h, sz.insets, true);
      expect(L.shape, sz.name).toBe('tall');
      expect(L.fig.cx).toBeCloseTo((L.left + L.right) / 2, 5);
      expect(L.fig.top + 1.06 * L.fig.H, sz.name).toBeLessThanOrEqual(L.prayer.y + 0.5);
      expect(L.fig.top + STATION.crown.y * L.fig.H - windowR(L, 0.5), sz.name).toBeGreaterThanOrEqual(L.top - 0.5);
      expect(L.prayer.y + L.prayer.h, sz.name).toBeLessThanOrEqual(L.bottom);
      expect(L.prayer.h).toBeGreaterThanOrEqual(100);
      expect(L.fig.H, sz.name).toBeGreaterThan(200);
      // the lit windows on the midline never touch, in any map
      for (const m of MAPS) {
        const mid = MAP[m].stations.filter(s => STATION[s].kind === 'point');
        for (let i = 1; i < mid.length; i++) {
          const gap = (STATION[mid[i]].y - STATION[mid[i - 1]].y) * L.fig.H;
          expect(gap, `${sz.name} ${m} ${mid[i - 1]}–${mid[i]}`).toBeGreaterThan(2 * litR(L) + 2);
        }
      }
    }
  });

  it('never draws text under 11 px; the prayer is at least 15 px and what is read at least 13', () => {
    for (const px of [4, 9, 10.9, 11, 13, 17]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(6)).toMatch(/ 11px /);
    for (const sz of CHECK_SIZES) {
      const L = layout(sz.w, sz.h, sz.insets, true);
      expect(L.font.prayerMin).toBeGreaterThanOrEqual(15);
      expect(L.font.label).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.caption).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.small).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('grows on a tablet and a desktop: 1.3 at most below a big screen, up to DESK_MAX on one', () => {
    for (const sz of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(sz.w, sz.h, sz.insets, touch);
        expect(L.u).toBeGreaterThanOrEqual(1);
        expect(L.u, sz.name).toBeLessThanOrEqual(Math.min(sz.w, sz.h) >= DESK_BIG && sz.w >= 1024 ? DESK_MAX : 1.3);
      }
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const touch = howto(true), keys = howto(false);
    expect(touch.hands.every(hd => hd.gesture !== 'keys')).toBe(true);
    expect(keys.hands.some(hd => hd.gesture === 'keys')).toBe(true);
    expect(touch.tips!.length).toBeLessThanOrEqual(2);
    expect(coachText('tap', true)).not.toMatch(/spacj|klik/i);
    expect(coachText('tap', false)).toMatch(/spacj/i);
    expect(keys.hands[0].text).toMatch(/^Kliknij/);
    expect(touch.hands[0].text).toMatch(/^Stuknij/);
    // a tap is never said to add light
    expect(touch.hands[0].text).not.toMatch(/przybywa|rośnie/);
  });
});

describe('a big screen and a mouse (DESIGN §14)', () => {
  const desks = CHECK_SIZES.filter(s => s.w > s.h && ['desktop', 'big'].includes(screenKind(s.w, s.h, false)));

  it('fills the band with the figure and stands the words beside it at a reading measure', () => {
    for (const sz of desks) {
      const L = layout(sz.w, sz.h, sz.insets, false);
      expect(L.desk, sz.name).toBe(true);
      expect(L.fig.H, sz.name).toBeGreaterThanOrEqual(0.8 * (L.bottom - L.top));
      expect(L.prayer.x, sz.name).toBeGreaterThanOrEqual(L.fig.cx + 0.34 * L.fig.H);
      expect(L.prayer.x + L.prayer.w, sz.name).toBeLessThanOrEqual(L.right - 16);
      expect(L.prayer.w, sz.name).toBeLessThanOrEqual(18 * L.font.prayer);
    }
  });

  it('stands the words level with each station through the camera, whole inside the band', () => {
    for (const sz of desks) {
      const L = layout(sz.w, sz.h, sz.insets, false);
      for (const s of STATIONS) {
        const c = cameraFor(L, framingOf(s)), p = figPt(L, STATION[s].x, STATION[s].y);
        const y = toScreen(c, p.x, p.y).y;
        const W = wordsAt(L, y);
        expect(W.caption.y, `${sz.name} ${s}`).toBeGreaterThanOrEqual(L.top);
        expect(W.prayer.y + W.prayer.h, `${sz.name} ${s}`).toBeLessThanOrEqual(L.bottom);
        const row = W.prayer.y + labelRowH(L) / 2;
        if (y > L.top + W.caption.h + 14 + labelRowH(L) / 2 && y < L.bottom - 8 - L.prayer.h + labelRowH(L) / 2) expect(Math.abs(row - y), `${sz.name} ${s}`).toBeLessThan(1);
      }
    }
  });
});

describe('the rose windows (rose.ts)', () => {
  // happy-dom has no Path2D: a stand-in that takes the calls (the geometry, not the pixels, is under test)
  const g = globalThis as { Path2D?: unknown };
  const had = !!g.Path2D;
  beforeAll(() => {
    if (!had) g.Path2D = class { moveTo() {} lineTo() {} arc() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} ellipse() {} };
  });
  afterAll(() => {
    if (!had) delete g.Path2D;
  });

  it('builds the oculus, the inner and outer petals and a foil between the outer ones', () => {
    for (const s of STATIONS) {
      const r = STATION[s].rose;
      const all = pieces(r, 40);
      expect(all.filter(x => x.ring === 'c')).toHaveLength(1);
      expect(all.filter(x => x.ring === 'i')).toHaveLength(r.inner);
      expect(all.filter(x => x.ring === 'o')).toHaveLength(r.outer);
      for (const pc of all) expect(pc.r1).toBeLessThanOrEqual(40 * RING.o + 1e-9);
    }
  });

  it('opens the oculus first, then petal by petal, each filling from its base; nothing is opening when full', () => {
    const r = STATION.heart.rose;
    expect(openness(r, 0)).toEqual({ oculus: 0, inner: 0, outer: 0 });
    expect(openness(r, 0.05).oculus).toBeGreaterThan(0.5);
    expect(partPath(r, 40, 1)).toBeNull();
    expect(partPath(r, 40, RULES.innerShare * 0.5)).not.toBeNull();
    expect(petalAngle(0, 4)).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('the chorale (kit/song.ts)', () => {
  it('is a well-formed slow hymn without words or drums, in the key of the station bells', () => {
    const song = buildHymn();
    expect(songProblems(song)).toEqual([]);
    expect(song.bpm).toBeLessThanOrEqual(60);
    expect(song.lines).toEqual([]);
    expect(song.parts.some(p => p.voice === 'kick' || p.voice === 'snare' || p.voice === 'hat')).toBe(false);
    expect(song.root).toBeCloseTo(146.83, 2);
  });

  it('follows the light in a sighted push, rests at a gentle level, and holds still in a blind block', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    drive(sim, 8, HIGH, clock);
    expect(sim.songLevel(HIGH)).toBeCloseTo(HIGH.level, 9);
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    expect(sim.songLevel(CALM)).toBeCloseTo(0.34, 9);
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    expect(sim.songLevel(HIGH)).toBeNull();
  });
});

describe('every map plays through', () => {
  it('walks each map down and up with its own count and closing cards', () => {
    for (const m of MAPS as readonly MapId[]) {
      const sim = later({ planned: 3600, progress: { map: m, way: 'both' } });
      const evs = drive(sim, 3000, steady(0.95), { t: 0 }, reader(sim));
      const downs = ofType(evs, 'full').filter(e => e.dir === 'down').map(e => e.station);
      expect(downs.slice(0, MAP[m].stations.length), m).toEqual([...MAP[m].stations]);
      expect(ofType(evs, 'whole').map(e => e.dir).slice(0, 2), m).toEqual(['down', 'up']);
      expect(sim.lit[route(m, 'up')[0]] & LIT_UP || sim.round > 1, m).toBeTruthy();
    }
  });
});
