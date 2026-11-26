/**
 * The unsent letter (station "list", DESIGN.md §23): written in the lobby, read once by the session that starts next,
 * then gone.  It lives only in this module's memory — never in the progress, the settings, `result()` or any request —
 * so a reload, closing the app or the session's start lets it go, as the station does with the paper boat.
 */

/** The longest letter (characters): a page, enough to say what needs saying. */
export const LETTER_MAX = 1200;

let text = '';

/** The lobby's editor writes here as the player types. */
export function setLetter(s: string): void {
  text = String(s ?? '').slice(0, LETTER_MAX);
}

/** What the lobby shows in its editor (the letter written so far in this visit). */
export const peekLetter = (): string => text;

/** The session takes the letter at its start: it is then gone from here (only the session holds it, until it ends). */
export function takeLetter(): string {
  const s = text;
  text = '';
  return s;
}
