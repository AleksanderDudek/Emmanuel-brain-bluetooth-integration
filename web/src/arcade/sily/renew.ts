/**
 * Nowe siły (DESIGN.md §28): how far the figure has recovered — parameter by parameter — from the session's arc and the
 * meditations walked (pure; the figure's painter reads it, the tests check it).
 *
 * At the start of every session the figure is tired: every parameter 0.  Two things renew it, and neither ever falls:
 *
 *   the arc     the session's focused growth over what the session can hold at the player's pace (the engine's
 *               WorldState.arc): the parameters recover in a fixed order, each over a stretch of the arc, the next
 *               beginning before the last ends — colour, skin, eyes, posture, hair, and last the quiet smile — so a
 *               session finished by focus ends with the figure fully renewed, at any length
 *   the lead    the meditation that serves a parameter, walked this session, lets it lead: each scene of it grown adds
 *               LEAD_K to its parameters (at most LEAD_MAX) — the figure answers the meditation the player is in
 *
 * Outside play (the lobby's hero and tiles) there is no arc: a figure scene's own growth stands for it.
 */

export const PARAMS = ['kolor', 'skora', 'oczy', 'postawa', 'wlosy', 'usmiech'] as const;
export type Param = (typeof PARAMS)[number];
export type Renewal = Record<Param, number>;

/** Which meditation serves which parameters (the gut's scene sits in „Cała postać”: it feeds the marrow). */
export const SERVES: Readonly<Record<string, readonly Param[]>> = {
  zrodlo: ['kolor'],
  skora: ['skora', 'wlosy'],
  sila: ['postawa'],
  noc: ['oczy'],
  cala: ['usmiech'],
};

/** each parameter recovers over this share of the arc; the next one starts STEP later */
export const SPAN = 0.3;
const STEP = (1 - SPAN) / (PARAMS.length - 1);
/** a scene of the serving meditation grown whole lends its parameters this much, up to LEAD_MAX */
export const LEAD_K = 0.35;
export const LEAD_MAX = 0.5;

const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number): number => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};

export const TIRED: Readonly<Renewal> = { kolor: 0, skora: 0, oczy: 0, postawa: 0, wlosy: 0, usmiech: 0 };
export const RENEWED: Readonly<Renewal> = { kolor: 1, skora: 1, oczy: 1, postawa: 1, wlosy: 1, usmiech: 1 };

/** A parameter's share of the arc (its place in the order). */
export const staged = (arc: number, i: number): number => smooth((arc - i * STEP) / SPAN);

/**
 * The figure's recovery: the arc staged in order, each parameter at least what its meditation lent it this session.
 * `medOf` names the meditation a scene belongs to.
 */
export function renewal(arc: number, session: Readonly<Record<string, number>> | undefined, medOf: (scene: string) => string | undefined): Renewal {
  const out = { ...TIRED };
  const lead: Partial<Record<Param, number>> = {};
  if (session) {
    for (const [scene, g] of Object.entries(session)) {
      const med = medOf(scene);
      for (const p of (med && SERVES[med]) || []) lead[p] = (lead[p] ?? 0) + g;
    }
  }
  PARAMS.forEach((p, i) => {
    out[p] = Math.max(staged(clamp(arc), i), Math.min(LEAD_MAX, LEAD_K * (lead[p] ?? 0)));
  });
  return out;
}

/** The whole recovery in one number (0..1): the grey cast lifts with it. */
export const overall = (r: Renewal): number => PARAMS.reduce((s, p) => s + r[p], 0) / PARAMS.length;
