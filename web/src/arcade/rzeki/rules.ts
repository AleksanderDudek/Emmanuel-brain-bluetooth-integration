/**
 * Every number of Rzeki żywej wody's rules in one place (DESIGN.md §13.14): the light at a station (what focus
 * drives), the fill that opens its glass, the flow to the next station, the abiding of rest (the breath guide, the
 * drops of living water), the blocks, the voice and the cards.  Tuning moves a number here and nowhere else; the
 * tests read the same object.
 *
 * A station's `fill` runs 0 → 1: its glass opens piece by piece, and at 1 the light flows on.  Since the
 * founder's word of 2026-11-17 the glass loads **only from real concentration** — in a sighted push past its
 * lead-in, with a reliable signal, while the focus is above the threshold (`frame.focused`) — and more slowly than
 * before: about 30 s of focused time a station at the threshold, about 20 s at a high level.  Nothing fills in
 * rest, the warm-up, the finale, without a signal, below the threshold, or from taps; what is gained stays.
 */
export const RULES = {
  // ── the light (what focus drives) ────────────────────────────
  /** the light drawn while the brain drives nothing (the warm-up, the lead-in, a blind block, no signal) */
  baseLight: 0.45,
  /** the light follows its target with this time constant (s) */
  lightTau: 0.8,
  /** the light drawn in rest (the window glows steadily; calm shows in the breath and the aura instead) */
  restLight: 0.3,

  // ── the fill (the glass opening) ─────────────────────────────
  /**
   * While focused in a sighted push: fillFocus × (focusLo + focusK × clamp((level − 0.5) / 0.5)) ×
   * (1 + holdK × min(1, hold / holdFull)) per second — sustained concentration loads faster (the founder's rule).
   */
  fillFocus: 0.036,
  focusLo: 0.6,
  focusK: 0.8,
  holdK: 0.5,
  holdFull: 12,
  /** focus while the light rests in a full station or flows on loads the next station, up to this much */
  preMax: 0.25,
  /** the share of a rose window that is its inner ring (it opens first; then the outer petals) */
  innerShare: 0.3,
  /** a blind block's unseen light is shown at its end over this long (s) */
  revealSec: 1.6,

  // ── the way ──────────────────────────────────────────────────
  /** a full station holds a moment in its light, then the stream flows to the next station (s) */
  holdSec: 0.7,
  flowSec: 3,
  /** after the last station of a way: the whole figure in light before the closing card (s) */
  wholeSec: 2.4,
  /** the light comes down from the open heaven (or up from the pool) at the start of a way (s) */
  heavenSec: 2.2,
  /** the camera eases between its framings with this time constant (s) */
  cameraTau: 0.9,

  // ── the hands ────────────────────────────────────────────────
  /** the prayer re-shown by a tap glows for this long (s) */
  reshowSec: 2.4,

  // ── rest (abiding) ───────────────────────────────────────────
  /**
   * The rest is whole breaths of the player's pattern (kit/breath.ts, the lobby's card): by design the number nearest
   * `restTarget` seconds and enough for `restMin` (4 · 6: 2 breaths, 20 s; the box 4·4·4·4: 1 breath, 16 s); the
   * lobby's Rytm sets 1…`restBreathsMax` breaths instead (kit/rhythm.ts).  Round 15 (the founder: "dlaczego jest tak
   * często?"): 20 s, not 26 — after a station of some 30–40 s a rest is about a third of the session, not a half.
   */
  restTarget: 20,
  restMin: 12,
  restBreathsMax: 12,
  /**
   * A rest comes after this many stations lit (the founder's word of 2026-11-17: after every one); the lobby's Rytm
   * sets 1…`restAfterMax` — the light then flows on from a full station to the next within the same push.
   */
  restAfter: 1,
  restAfterMax: 4,
  /** about how long a station takes, lead-in and flow included (s), for the lobby's count of rests a session */
  stationSec: 40,
  /** abiding counts while calm is at least this (reliable signal, in a rest block) */
  abideCalm: 0.5,

  // ── drops of living water (the headline) ─────────────────────
  /** in the warm-up, the finale and between blocks (per second) */
  dropFree: 1.2,
  /** in a sighted push while the light loads: dropPush × (0.5 + level) per second (nothing while unfocused) */
  dropPush: 1.6,
  /** in rest with a signal: dropRest × (restDropLo + calm) × (1 + litK × lit share) per second */
  dropRest: 1.6,
  restDropLo: 0.4,
  litK: 0.6,
  /** a station lit (the light flows on), a whole way (down or up), a block judged well, a blind block (× its share) */
  dropPlace: 15,
  dropWay: 60,
  dropBlock: 20,
  dropBlind: 60,
  /** the rest's drops are counted aloud (a floating "+n") every this many seconds */
  restTick: 3,
  /**
   * The two rivers from the pool reach the edges of the picture at this many drops in a session of up to
   * `riverSec` s (about halfway through 10 minutes); a longer session × its length / riverSec, so the rivers grow
   * through 15–30 minutes too and reach the edges about halfway, never in the first five minutes
   */
  riverFull: 700,
  riverSec: 600,

  // ── the session ──────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /**
   * A push block is the loading of one station: it has no fixed length and ends when the station is full (the
   * founder's word of 2026-11-17: "rest after every completed sphere, not on a timer").  The rest that follows is
   * announced when the station is `telegraphFill` full (or its last piece is opening); the next push 4 s before
   * the rest's last breath ends.
   */
  telegraph: 4,
  telegraphFill: 0.85,
  /** a push shorter than this (a station resumed nearly full, pre-filled by the flow) is not judged (s) */
  minPush: 10,
  /**
   * The safety valve: a push that cannot finish — `valveStall` s without any light gained (no signal, or no focus),
   * or `valveSec` s in all while its station is under `telegraphFill` — gives way to a rest of whole breaths; the
   * station keeps its light and the next push loads it on.
   */
  valveSec: 150,
  valveStall: 60,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a short test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the light loading this long (s) before the narrator says so */
  goodSec: 5,
  /** a sighted push this long past its lead-in without the light loading: the narrator says how it loads (once a session) */
  waitSec: 9,
  /** the push tasks: every repeatEvery-th push block asks to repeat the prayer word by word */
  repeatEvery: 3,

  // ── cards and the voice ──────────────────────────────────────
  /** a story card's page closes itself after its reading time (at least pageSec); a tap turns it after tapAfter */
  pageSec: 9,
  tapAfter: 0.6,
  /**
   * Reading time (the round-11 clarity rule): a line on screen stays readSec + readPerChar × its characters, never
   * under readMin — long enough to read it twice.  The narrator, the coach marks and the story cards follow it.
   */
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  /** a pause between two narrator lines (s) */
  talkGap: 2.6,
  /** the first-time explanations (coach marks): one at a time, this far apart (s) */
  hintGap: 1.2,
  /** own words: at most this many characters */
  ownMax: 120,
} as const;

/** How long a line of `text` stays on screen to be read twice (s): readSec + readPerChar × characters, at least readMin. */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

/**
 * The founder's fill rule: how fast a station's light loads per second for a focus frame — only while focused,
 * faster above the threshold and faster again as a focused stretch is held.  (The sim calls it only in a sighted
 * push past its lead-in with a reliable signal.)
 */
export function focusRate(level: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = Math.max(0, Math.min(1, (level - 0.5) / 0.5));
  return R.fillFocus * (R.focusLo + R.focusK * above) * (1 + R.holdK * Math.min(1, Math.max(0, hold) / R.holdFull));
}
