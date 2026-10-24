/**
 * Geoda (DESIGN.md §9): a Block Blast-style wall in a geode where the player grows the pieces —
 * steady focus makes mineral water drip faster and the fed crystal grow cell by cell, clearer the
 * steadier the hold; full lines shatter together at the end of each focus block, and calm in the
 * rest block polishes the round's best gem.  Every session cracks one geode for the cabinet.
 *
 * This module is the arcade contract: progress defaults, the session (game.ts), the best score,
 * the lobby's progress card (panel.ts) and the animated picture (preview.ts).
 */
import type { ArcadeModule } from '../kit/types';
import { GeodaGame } from './game';
import { bestCarats, freshProgress, type GeodaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';

const mod: ArcadeModule<GeodaProgress> = {
  freshProgress,
  create: env => new GeodaGame(env),
  best: p => bestCarats(p),
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, hh, t, p) => drawPreview(ctx, w, hh, t, p),
};

export default mod;
