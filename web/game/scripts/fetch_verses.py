#!/usr/bin/env python3
"""
Generate web/game/src/content/bible.ts: the Scripture used by HolyHolyHoly.

    python3 -I web/game/scripts/fetch_verses.py [--data-dir DIR] [--report FILE] [--offline] [--check]

Downloads go to --data-dir (default: $BIBLE_DATA_DIR or <tmp>/holyholyholy-bible), which must lie
outside the repository; later runs reuse them, and --offline uses nothing else.

Text (verbatim, whitespace normalised only)
    Biblia Gdańska (1632), 1881 edition, public domain, from the getbible.net
    API v2, translation "polgdanska"
    (https://api.getbible.net/v2/polgdanska.json, distribution_license
    "Public Domain", distribution_source http://www.biblia.elblag.net/, OSIS).
    The file is pinned by its SHA-1, so a re-run reproduces bible.ts exactly.

Verification (nothing from it is copied into the output)
    Every verse is compared, chapter by chapter, with Polish Wikisource
    (https://pl.wikisource.org/wiki/Biblia_Gdańska). Most books there are the
    proofread transcription of the 1840 printing of the same translation
    ("scan-1840", an independent witness); a few only have an older plain copy
    of the 1881 text ("copy-1881"), which must then match character for character.
    That copy shares getbible's digital lineage (it repeats the same rare slips),
    so it guards numbering and downstream corruption, not the printed wording.
      * the verse must exist in both, with the same number;
      * the wording must agree once the 1840/1881 spelling differences are
        folded away (i/j/y, accents, diacritics, punctuation), and must agree
        with its own verse better than with its neighbours (catches shifted
        numbering);
      * the getbible chapter must not be shorter than the Wikisource one where
        the verse is the last one (the getbible OSIS was fitted to KJV chapter
        lengths, which glues the extra Polish verses onto the last verse).
    Word-level differences are printed for review; verses whose differences
    are real transcription errors (not spelling) are simply not used.

Re-segmentation (SPLITS): where getbible glues two verses together, the
record is split at the verse boundary printed in the Gdańsk Bible (confirmed
by the check above). Characters are not changed.

Downloaded files are untrusted input: they are stored outside the repository,
parsed only with json / html.parser, and every verse is checked against a
character allowlist before it is written into TypeScript.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

GETBIBLE_URL = "https://api.getbible.net/v2/polgdanska.json"
GETBIBLE_SHA1 = "e5dfe3af42ffaa39c5c398928d4835b0fccbfa35"
WIKISOURCE_API = "https://pl.wikisource.org/w/api.php"
USER_AGENT = ("HolyHolyHoly-verse-check/1.0 "
              "(https://github.com/AleksanderDudek/Emmanuel-brain-bluetooth-integration)")

GAME = Path(__file__).resolve().parents[1]           # web/game
REPO = GAME.parents[1]
OUT = GAME / "src" / "content" / "bible.ts"

# abbreviation -> (getbible book number, Wikisource chapter-page prefix)
BOOKS: dict[str, tuple[int, str | None]] = {
    "Rdz": (1, "Pierwsze Księgi Moyżeszowe"),
    "Wj": (2, "Księga Wyjścia"),
    "Kpł": (3, "Księga Kapłańska"),
    "Lb": (4, "Księga Liczb"),
    "Pwt": (5, "Księga Powtórzonego Prawa"),
    "Joz": (6, "Księgi Iozuego"),
    "Sdz": (7, "Księga Sędziów"),
    "Rt": (8, "Księgi Ruthy"),
    "1 Sm": (9, "Pierwsza Księga Samuela"),
    "2 Sm": (10, "Druga Księga Samuela"),
    "1 Krl": (11, "Pierwsza Księga Królewska"),
    "2 Krl": (12, "Druga Księga Królewska"),
    "1 Krn": (13, "Pierwsza Księga Kronik"),
    "2 Krn": (14, "Druga Księga Kronik"),
    "Ezd": (15, "Księgi Ezdraszowe"),
    "Ne": (16, "Księgi Nehemiaszowe"),
    "Est": (17, "Księgi Estery"),
    "Hi": (18, "Księga Hioba"),
    "Ps": (19, "Księgi Psalmów"),
    "Prz": (20, "Księgi Przypowieści Salomonowe"),
    "Koh": (21, "Ecclesiastes"),
    "Pnp": (22, "Pieśń nad pieśniami Salomonowa"),
    "Iz": (23, "Księga Izajasza"),
    "Jr": (24, "Księga Jeremiasza"),
    "Lm": (25, "Treny"),
    "Ez": (26, "Księga Ezechiela"),
    "Dn": (27, "Proroctwo Danielowe"),
    "Oz": (28, "Proroctwo Ozeaszowe"),
    "Jl": (29, "Proroctwo Ioelowe"),
    "Am": (30, "Proroctwo Amosowe"),
    "Ab": (31, None),
    "Jon": (32, "Proroctwo Ionaszowe"),
    "Mi": (33, "Proroctwo Micheaszowe"),
    "Na": (34, "Proroctwo Nahumowe"),
    "Ha": (35, "Proroctwo Abakukowe"),
    "So": (36, "Proroctwo Sofoniaszowe"),
    "Ag": (37, "Proroctwo Aggieuszowe"),
    "Za": (38, "Proroctwo Zacharyaszowe"),
    "Ml": (39, "Proroctwo Malachyaszowe"),
    "Mt": (40, "Ewangelia wg św. Mateusza"),
    "Mk": (41, "Ewangelia wg św. Marka"),
    "Łk": (42, "Ewangelia wg św. Łukasza"),
    "J": (43, "Ewangielia według Świętego Iana"),
    "Dz": (44, "Dzieje Apostolskie"),
    "Rz": (45, "List Świętego Pawła Apostoła do Rzymianów"),
    "1 Kor": (46, "List pierwszy Świętego Pawła Apostoła do Koryntów"),
    "2 Kor": (47, "List wtóry Ś. Pawła Apostoła do Koryntów"),
    "Ga": (48, "List Świętego Pawła Apostoła do Galatów"),
    "Ef": (49, "List Świętego Pawła Apostoła do Efezów"),
    "Flp": (50, "List Świętego Pawła Apostoła do Filippensów"),
    "Kol": (51, "List świętego Pawła Apostoła do Kolossensów"),
    "1 Tes": (52, "List Świętego Pawła Apostoła do Tessalonicensów pierwszy"),
    "2 Tes": (53, "List Świętego Pawła Apostoła do Tessalonicensów wtóry"),
    "1 Tm": (54, "List Ś. Pawła Apostoła do Tymoteusza pierwszy"),
    "2 Tm": (55, "List Ś. Pawła Apostoła do Tymoteusza wtóry"),
    "Tt": (56, "List Świętego Pawła Apostoła do Tytusa"),
    "Flm": (57, None),
    "Hbr": (58, "List Świętego Pawła Apostoła do Żydów"),
    "Jk": (59, "List powszechny Świętego Iakuba Apostoła"),
    "1 P": (60, "List pierwszy powszechny Ś. Piotra Apostoła"),
    "2 P": (61, "List wtóry powszechny Ś. Piotra Apostoła"),
    "1 J": (62, "List pierwszy powszechny Ś. Iana Apostoła"),
    "2 J": (63, None),
    "3 J": (64, None),
    "Jud": (65, None),
    "Ap": (66, "Apokalipsa św. Jana"),
}

# The verses the game uses (any order; bible.ts is written in canonical order).
REFS: list[str] = [
    # title, story, Sabbath, support
    "Iz 6,3", "Ps 91,11", "Mi 7,8", "Prz 24,16", "Ps 37,24", "Ap 21,4-5", "Mt 10,8", "Ps 46,11", "Mt 11,28",
    # whispers between rooms
    "Iz 41,10", "Iz 43,2", "Iz 46,4", "Iz 49,16", "Wj 14,14", "J 1,5", "J 10,28", "J 15,9", "J 16,33", "Ap 3,20",
    # traumas -> truths
    "Ps 56,4", "Ps 3,4", "Prz 15,1", "Rz 15,13", "J 6,37", "J 14,18", "Ps 103,12", "J 8,36", "Mi 6,8",
    "Rz 12,15", "Łk 6,36", "Mk 9,24", "Prz 3,5-6", "J 8,32",
    # chapter epigraphs
    "Iz 49,15", "Ps 27,10", "Ps 34,6", "Ps 147,3", "Ef 4,26", "Iz 42,3", "1 Krl 19,7", "Pwt 32,10",
    "J 14,2-3", "Wj 20,6", "Ps 139,8",
    # revelations
    "Rdz 16,13", "Dz 17,27", "Łk 15,20", "Ps 103,13", "Iz 43,1", "1 J 3,1", "Iz 54,10", "1 J 4,18", "Ef 2,8-9",
    "Rz 5,8", "Rdz 50,20", "Rz 12,19", "Lm 3,22-23", "Mi 7,18", "J 11,35", "Ga 6,2", "Ps 34,19", "Łk 11,13",
    "Dz 2,39", "2 Kor 5,17", "Ap 21,5", "Ez 18,20", "Ga 3,13", "1 P 3,18-19", "Łk 19,10", "Ef 4,9",
    "Mt 6,7-8", "Rz 8,26", "J 9,3", "Lm 3,33", "1 P 5,7", "Mt 10,30", "2 Kor 12,9", "Hbr 4,15-16", "Mt 14,31",
    # prayers
    "Ps 104,30", "J 20,22", "Iz 44,3", "Ef 4,32", "Ef 6,10-11", "Łk 18,13", "Łk 15,4", "2 Kor 10,4", "Ap 4,8",
    # powers
    "Ef 6,17", "Mt 14,20", "Ef 6,16", "Dz 2,3", "Dz 2,2", "Mt 3,16", "1 Krl 18,38", "Joz 6,20", "1 Sm 17,49",
    "Sdz 16,28", "Wj 16,4", "Ef 6,15", "Ef 6,14", "Mk 4,39", "Jon 2,1", "Ez 36,26", "Mt 18,22", "Mt 17,20",
    # fruits of the Spirit
    "Ga 5,22-23", "Flp 4,4", "J 14,27", "Iz 40,31", "Prz 16,24", "Ps 23,6", "2 Tm 2,13", "Mt 5,5", "Prz 16,32",
    # choirs of angels
    "Hbr 1,14", "Łk 1,19", "Ef 3,10", "1 P 3,22", "Ps 103,20", "Ef 1,21", "Kol 1,16", "Ez 10,21", "Iz 6,2",
]

# getbible records that hold two verses: split after `marker` (which ends the first verse).
SPLITS: dict[str, str] = {
    "Ps 46,11": "będę wywyższony na ziemi.",
}

REF_RE = re.compile(r"^(?P<book>(?:[123] )?[A-ZŁ][a-ząćęłńóśźż]{0,3}) (?P<ch>\d{1,3}),(?P<v1>\d{1,3})(?:-(?P<v2>\d{1,3}))?$")
# Verse text may only contain these (the source has a few stray OCR characters such as "×"; such verses are not used).
ALLOWED_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZąćęłńóśźżĄĆĘŁŃÓŚŹŻ ,.;:?!()")
MIN_RATIO = 0.70


# ─── download (cached in the data dir) ─────────────────────────────────

def fetch(url: str, dest: Path, offline: bool) -> bytes:
    if dest.exists():
        return dest.read_bytes()
    if offline:
        sys.exit(f"--offline but {dest} is not cached")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return data
        except Exception as e:  # network hiccup: retry with backoff
            last = e
            time.sleep(2 * (attempt + 1))
    sys.exit(f"download failed: {url}: {last}")


def load_getbible(data_dir: Path, offline: bool) -> dict[tuple[int, int], dict[int, str]]:
    raw = fetch(GETBIBLE_URL, data_dir / "getbible" / "polgdanska.json", offline)
    sha1 = hashlib.sha1(raw, usedforsecurity=False).hexdigest()   # pins the file to getbible's published checksum
    if sha1 != GETBIBLE_SHA1:
        sys.exit(f"getbible polgdanska.json SHA-1 is {sha1}, expected {GETBIBLE_SHA1}: "
                 "the source changed; review it and update GETBIBLE_SHA1")
    doc = json.loads(raw.decode("utf-8"))
    if doc.get("abbreviation") != "polgdanska" or doc.get("distribution_license") != "Public Domain":
        sys.exit("unexpected getbible metadata (translation / licence)")
    index: dict[tuple[int, int], dict[int, str]] = {}
    for book in doc["books"]:
        for ch in book["chapters"]:
            index[(int(book["nr"]), int(ch["chapter"]))] = {int(v["verse"]): str(v["text"]) for v in ch["verses"]}
    return index


class WikisourceChapter(HTMLParser):
    """Collect the text of a rendered Wikisource chapter page, minus navigation, headings, summaries,
    footnote markers and page numbers; verse numbers stay at the start of their lines.

    Two kinds of page exist: most transclude the proofread transcription of the 1840 scan
    (div.prp-pages-output, "N. text"); some books only have an older plain copy of the 1881 text
    ("N text" lines straight in the page)."""

    SKIP_CLASSES = {"reference", "ws-pagenum", "center", "references", "mw-cite-backlink", "noprint",
                    "mw-heading", "mw-editsection", "toc"}
    SKIP_TAGS = {"small", "sup", "center", "style", "script", "table", "h1", "h2", "h3", "h4"}
    VOID = {"br", "img", "hr", "wbr", "meta", "link", "input", "source", "col"}

    def __init__(self, html: str) -> None:
        super().__init__(convert_charrefs=True)
        self.scan = "prp-pages-output" in html
        self.container = "prp-pages-output" if self.scan else "mw-parser-output"
        self.stack: list[tuple[str, bool, bool]] = []   # (tag, opens output, skipped)
        self.in_output = 0
        self.skipping = 0
        self.parts: list[str] = []
        self.feed(html)
        self.close()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.VOID:
            if tag == "br" and self.in_output and not self.skipping:
                self.parts.append("\n")
            return
        a = {k: (v or "") for k, v in attrs}
        classes = set(a.get("class", "").split())
        style = a.get("style", "").replace(" ", "")
        opens = self.container in classes
        skip = bool(classes & self.SKIP_CLASSES) or tag in self.SKIP_TAGS \
            or "font-size:85%" in style or "display:none" in style
        self.stack.append((tag, opens, skip))
        self.in_output += opens
        self.skipping += skip
        if tag in {"p", "div"} and self.in_output and not self.skipping:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        # <br /> arrives here too (handle_startendtag); ignore void and unmatched end tags
        if tag in self.VOID or all(t != tag for t, _, _ in self.stack):
            return
        while self.stack:
            t, opens, skip = self.stack.pop()
            self.in_output -= opens
            self.skipping -= skip
            if t == tag:
                break
        if tag in {"p", "div"} and self.in_output and not self.skipping:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.in_output and not self.skipping:
            self.parts.append(data)

    def verses(self) -> dict[int, str]:
        lines = [" ".join(raw.split()) for raw in "".join(self.parts).split("\n")]
        lines = [line for line in lines if line]
        # candidate verse markers: "N. text" (scan) or "N text" (plain copy), maybe after a section numeral
        marks = []
        for i, line in enumerate(lines):
            m = re.match(r"^(?:[IVXLC]+\. ?)?(\d{1,3})(?:\. ?| )(.*)$", line)
            if m:
                marks.append((i, int(m.group(1)), m.group(2)))
        starts: dict[int, tuple[int, str]] = {}
        cur = 0
        for k, (i, n, rest) in enumerate(marks):
            following = marks[k + 1][1] if k + 1 < len(marks) else None
            if n == cur + 1 or (cur == 0 and n == 2):    # verse 1 is often unnumbered
                cur = n
            elif following == cur + 2:                  # one misnumbered verse in the witness ("31." for "13.")
                cur += 1
            else:
                continue                                # a number inside the text, not a verse
            starts[i] = (cur, rest)
        out: dict[int, str] = {}
        preamble: list[str] = []
        cur = 0
        for i, line in enumerate(lines):
            if i in starts:
                cur, text = starts[i]
                out[cur] = text
            elif cur:
                out[cur] += " " + line
            else:
                preamble.append(line)
        if 1 not in out and preamble:
            out[1] = " ".join(preamble)
        return out


def load_wikisource(book: str, ch: int, data_dir: Path, offline: bool) -> tuple[dict[int, str], str] | None:
    """(verses, witness) where witness is 'scan-1840' or 'copy-1881'; None if there is no page."""
    prefix = BOOKS[book][1]
    if prefix is None:
        return None
    title = f"Biblia Gdańska/{prefix} {ch}"
    query = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "text", "format": "json",
                                    "formatversion": "2", "redirects": "1", "disablelimitreport": "1"})
    safe = re.sub(r"[^\w-]+", "_", f"{prefix}_{ch}")
    cached = data_dir / "wikisource" / f"{safe}.json"
    fresh = not cached.exists()
    raw = fetch(f"{WIKISOURCE_API}?{query}", cached, offline)
    if fresh:
        time.sleep(0.3)  # be gentle with the Wikimedia API
    doc = json.loads(raw.decode("utf-8"))
    if "parse" not in doc:
        return None
    p = WikisourceChapter(doc["parse"]["text"])
    return p.verses(), ("scan-1840" if p.scan else "copy-1881")


# ─── comparison ────────────────────────────────────────────────────────

def fold(text: str) -> list[str]:
    """Spelling-insensitive words: 1840 'Iezus', 'twoiéy' and 1881 'Jezus', 'twojej' fold alike."""
    t = unicodedata.normalize("NFKD", text.lower().replace("ł", "l"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.replace("j", "i").replace("y", "i")
    return re.findall(r"[a-z]+", t)


def ratio(a: str, b: str) -> float:
    """Letter-level similarity, so 'nie masz' / 'niemasz' and 'przede mną' / 'przedemną' agree."""
    return difflib.SequenceMatcher(None, "".join(fold(a)), "".join(fold(b)), autojunk=False).ratio()


def word_diff(a: str, b: str) -> list[str]:
    wa, wb = fold(a), fold(b)
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        if op != "equal":
            out.append(f"{' '.join(wa[i1:i2]) or '∅'} ≠ {' '.join(wb[j1:j2]) or '∅'}")
    return out


# ─── main ──────────────────────────────────────────────────────────────

def parse_ref(ref: str) -> tuple[str, int, int, int]:
    m = REF_RE.match(ref)
    if not m or m.group("book") not in BOOKS:
        sys.exit(f"bad ref {ref!r}")
    v1 = int(m.group("v1"))
    v2 = int(m.group("v2") or v1)
    if m.group("v2") and v2 <= v1:
        sys.exit(f"bad range {ref!r}")
    return m.group("book"), int(m.group("ch")), v1, v2


def canonical(ref: str) -> tuple[int, int, int]:
    book, ch, v1, _ = parse_ref(ref)
    return BOOKS[book][0], ch, v1


def getbible_chapter(gb: dict[tuple[int, int], dict[int, str]], book: str, ch: int) -> dict[int, str]:
    """The chapter's verses with SPLITS applied."""
    vs = dict(gb.get((BOOKS[book][0], ch), {}))
    for ref, marker in SPLITS.items():
        b, c, v, _ = parse_ref(ref)
        if (b, c) != (book, ch):
            continue
        head, sep, tail = vs[v].partition(marker)
        if not sep or not tail.strip() or (v + 1) in vs:
            sys.exit(f"split rule for {ref} no longer matches the source")
        vs[v], vs[v + 1] = head + sep, tail
    return vs


def check_verse(label: str, v: int, text: str, vs: dict[int, str], ws: dict[int, str], witness: str
                ) -> tuple[str, list[str]]:
    """Compare one getbible verse with its Wikisource witness: (status, report lines)."""
    if v not in ws:
        return "MISSING", [f"{label:<12} MISSING  verse not found in Wikisource ({witness})"]
    r = ratio(text, ws[v])
    neighbours = [ratio(text, ws[n]) for n in (v - 1, v + 1) if n in ws]
    status = "ok"
    if r < MIN_RATIO:
        status = "LOW"
    if neighbours and max(neighbours) >= r:
        status = "SHIFTED?"
    exact = "identical" if text == " ".join(ws[v].split()) else "differs"
    if witness == "copy-1881" and exact != "identical":
        status = "DIFFERS"  # same edition: any difference is a transcription error on one side
    if v == max(vs) and max(ws) > max(vs):
        status = "MERGED"   # getbible's chapter is shorter: the extra verses were glued onto this one
    lines = [f"{label:<12} {status:<8} {r:.2f}  getbible:  {text}",
             f"{'':<27}{witness}: {ws[v]}  [{exact}]"]
    lines += [f"{'':<27}diff: {d}" for d in word_diff(text, ws[v])]
    return status, lines


def render_ts(bible: dict[str, str], witnesses: dict[str, int]) -> str:
    seen = ", ".join(f"{n} against the {w}" for w, n in sorted(witnesses.items()))
    lines = [
        "/**",
        " * Scripture for HolyHolyHoly. GENERATED by web/game/scripts/fetch_verses.py; do not edit by hand:",
        " * add the ref to REFS in the script and re-run it.",
        " *",
        " * Text: Biblia Gdańska (1632), 1881 edition. Public domain.",
        f" *   Source: getbible.net API v2, translation \"polgdanska\": {GETBIBLE_URL}",
        " *   (distribution_license \"Public Domain\"; distribution_source http://www.biblia.elblag.net/, OSIS);",
        f" *   file SHA-1 {GETBIBLE_SHA1}.",
        " * Only whitespace is normalised. Refs use Polish abbreviations and the Gdańsk Bible's own numbering",
        " *   (Psalm titles count as verse 1, as in the Hebrew text and most Polish Bibles).",
        " * Verified verse by verse against Polish Wikisource, https://pl.wikisource.org/wiki/Biblia_Gdańska",
        " *   (numbering, verse boundaries, wording; 1840 vs 1881 spelling folded away). Nothing is copied from it.",
        f" *   Verses checked: {seen}",
        " *   (scan-1840: proofread transcription of the 1840 printing, independent of the source;",
        " *   copy-1881: older plain copy of the 1881 text from the same digital lineage, must match exactly).",
    ]
    for ref, marker in SPLITS.items():
        b, c, v, _ = parse_ref(ref)
        lines += [f" * Re-segmented: the source glues {b} {c},{v} and {c},{v + 1} into one record; it is split after",
                  f" *   \"{marker}\", the verse boundary printed in the Gdańsk Bible (characters unchanged)."]
    lines += [
        " */",
        "import type { Verse } from '../types';",
        "",
        "export const BIBLE: Record<string, string> = {",
        *(f"  {ts_string(ref)}: {ts_string(text)}," for ref, text in bible.items()),
        "};",
        "",
        "/** The verse at `ref` (e.g. \"Iz 41,10\", \"Ap 21,4-5\"); throws on a ref that is not in BIBLE. */",
        "export function verse(ref: string): Verse {",
        "  if (!Object.hasOwn(BIBLE, ref)) throw new Error(`Unknown Bible reference: ${ref}`);",
        "  return { ref, text: BIBLE[ref] };",
        "}",
        "",
    ]
    return "\n".join(lines)


def ts_string(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--data-dir", type=Path,
                    default=Path(os.environ.get("BIBLE_DATA_DIR") or Path(tempfile.gettempdir()) / "holyholyholy-bible"))
    ap.add_argument("--report", type=Path, help="write the verification report here too")
    ap.add_argument("--offline", action="store_true", help="use cached downloads only")
    ap.add_argument("--check", action="store_true", help="verify only; do not write bible.ts")
    args = ap.parse_args()

    data_dir = args.data_dir.resolve()
    if data_dir == REPO or REPO in data_dir.parents:
        sys.exit("--data-dir must be outside the repository (downloads are untrusted data)")
    dupes = sorted({r for r in REFS if REFS.count(r) > 1})
    if dupes:
        sys.exit(f"duplicate refs in REFS: {dupes}")

    gb = load_getbible(data_dir, args.offline)
    report: list[str] = []
    failures: list[str] = []
    witnesses: dict[str, int] = {}
    bible: dict[str, str] = {}

    for ref in sorted(REFS, key=canonical):
        book, ch, v1, v2 = parse_ref(ref)
        vs = getbible_chapter(gb, book, ch)
        found = load_wikisource(book, ch, data_dir, args.offline)
        texts = []
        for v in range(v1, v2 + 1):
            label = f"{book} {ch},{v}"
            if v not in vs:
                failures.append(f"{label}: missing in getbible")
                continue
            text = " ".join(vs[v].split())
            texts.append(text)
            if found is None:
                failures.append(f"{label}: no Wikisource chapter to verify against")
                continue
            status, lines = check_verse(label, v, text, vs, *found)
            report += lines
            witnesses[found[1]] = witnesses.get(found[1], 0) + 1
            if status != "ok":
                failures.append(f"{label}: {status}")
        joined = " ".join(texts)
        unexpected = sorted(set(joined) - ALLOWED_CHARS)
        if unexpected or not joined:
            failures.append(f"{ref}: empty or unexpected characters {unexpected}")
        bible[ref] = joined

    report += ["", f"{len(bible)} refs, {sum(witnesses.values())} verses checked: {witnesses}"]
    print("\n".join(report))
    if args.report:
        args.report.write_text("\n".join(report) + "\n", encoding="utf-8")
    if failures:
        print("\nFAILED:\n  " + "\n  ".join(failures), file=sys.stderr)
        sys.exit(1)
    if not args.check:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(render_ts(bible, witnesses), encoding="utf-8")
        print(f"\nwrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
