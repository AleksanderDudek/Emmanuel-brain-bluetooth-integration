/**
 * Każdy włos's side of "Ciało słucha" (DESIGN.md §27, kit/inner.ts): its words looked up as the engine's games do —
 * Każdy włos's own catalog first (its meditations' `word.<med>.1–3`, written with its pictures), then the inner layer's
 * generic words (kit/inner-i18n.ts), then the engine's (`tip.feel`, the felt push strategy shared by all nine) — in the
 * page's language, then in Polish.
 */
import { format, lang as pageLang, pick, type Lang, type Msg, type Params } from '../../i18n';
import type { InnerLookup } from '../kit/inner';
import { INNER } from '../kit/inner-i18n';
import { ENGINE } from '../kit/healthlib/i18n';
import { CATALOGS } from './i18n';

type Rec = Readonly<Record<string, Msg | undefined>>;

/** A key's text: Każdy włos's catalog, the inner layer's, the engine's — in a language, then in Polish. */
export function innerMsg(key: string, l: Lang = pageLang): Msg | undefined {
  const at = (x: Lang): Msg | undefined => (CATALOGS[x] as Rec)[key] ?? (INNER[x] as Rec)[key] ?? (ENGINE[x] as Rec)[key];
  return at(l) ?? at('pl');
}

/** `t` over Każdy włos's catalog and the generic words (a key of either). */
export function wt(key: string, params?: Params, l: Lang = pageLang): string {
  return format(pick(innerMsg(key, l) ?? key, typeof params?.n === 'number' ? params.n : undefined), params);
}

export const whas = (key: string, l: Lang = pageLang): boolean => innerMsg(key, l) !== undefined;

/** The inner layer's lookup for Każdy włos (kit/inner innerSource). */
export const WLOSY_LOOKUP: InnerLookup = { has: key => whas(key), t: key => wt(key) };
