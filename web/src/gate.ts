/**
 * The first import of every entry (src/main.ts, src/cards/pad/main.ts, game/src/main.ts): an automated client gets
 * the guard's notice (guard.ts) and the entry stops here — this module throws, so nothing after it in the module graph
 * runs (no app, no service worker, no Bluetooth).  A person's browser passes through untouched.
 */
import { guard } from './guard';

if (guard()) throw new Error('Emmanuel: an automated client — the app does not start (src/guard.ts)');
