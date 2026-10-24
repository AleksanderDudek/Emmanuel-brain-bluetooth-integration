#!/usr/bin/env python3
"""
Generate web/src/content/scripture.ts: the Scripture the arcade games quote, in the app's four languages.

    python3 -I web/scripts/fetch_scripture.py [--data-dir DIR] [--report FILE] [--offline] [--check]

Downloads go to --data-dir (default: $SCRIPTURE_DATA_DIR or <tmp>/emmanuel-scripture), which must lie
outside the repository; later runs reuse them, and --offline uses nothing else.

Text (public domain, verbatim; whitespace normalised, quotation marks that open or close outside the quoted
verses dropped, and a psalm's title dropped where an edition prints it inside the quoted verse):
  en  Berean Standard Bible (BSB, dedicated to the public domain), https://bereanbible.com/bsb.txt
      witness: eBible.org "engbsb" (https://ebible.org/Scriptures/engbsb_vpl.zip), sometimes an earlier
      revision of the same edition, so near agreement is required and the publisher's file wins.
  pl  Biblia Gdańska (1632), 1881 edition, getbible.net "polgdanska" (SHA-1 pinned)
      witness: Polish Wikisource. Download, segmentation and comparison come from the HolyHolyHoly
      pipeline (web/game/scripts/fetch_verses.py), which this script imports.
  de  Lutherbibel 1912, eBible.org "deu1912" (https://ebible.org/Scriptures/deu1912_vpl.zip; the file
      uses English verse numbering)
      witness: bibel-online.net, Luther 1912, in the edition's own numbering.
  sv  Bibel 1917, Swedish Wikisource "Bibeln 1917" (https://sv.wikisource.org/wiki/Bibeln_1917)
      witness: getbible.net "swedish" (Swedish 1917), which has slips of its own, so only near agreement
      is required and every difference is printed for review.

References follow each edition's own numbering. In the Polish, German and Swedish editions a long psalm
title is verse 1 (as in the Hebrew text), so the BSB's "Psalm 46:10" is Ps 46,11 / Psalm 46,11 / Ps 46:11
there. The offset of a psalm is taken from its chapter length in each edition's witness.

Downloaded files are untrusted input: they are stored outside the repository, parsed only with json /
html.parser / zipfile, and every passage is checked against a character allowlist before it is written
into TypeScript.
"""

from __future__ import annotations

import argparse
import difflib
import io
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import zipfile
from html.parser import HTMLParser
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parent
OUT = WEB / "src" / "content" / "scripture.ts"

sys.path.insert(0, str(WEB / "game" / "scripts"))
import fetch_verses as fv  # noqa: E402 -- the Polish half (getbible + Wikisource), already verified

USER_AGENT = ("Emmanuel-scripture-check/1.0 "
              "(https://github.com/AleksanderDudek/Emmanuel-brain-bluetooth-integration)")
fv.USER_AGENT = USER_AGENT

BSB_URL = "https://bereanbible.com/bsb.txt"
ENGBSB_URL = "https://ebible.org/Scriptures/engbsb_vpl.zip"
DEU1912_URL = "https://ebible.org/Scriptures/deu1912_vpl.zip"
BIBEL_ONLINE = "https://www.bibel-online.net/buch/luther_1912/{slug}/{ch}/"
SV_WIKISOURCE_API = "https://sv.wikisource.org/w/api.php"
GETBIBLE_SV_URL = "https://api.getbible.net/v2/swedish.json"

BIBLES = {"en": "BSB", "pl": "Biblia Gdańska", "de": "Luther 1912", "sv": "Bibel 1917"}

# USFM code -> (BSB name, Polish abbreviation as in fetch_verses.BOOKS, German name, bibel-online slug,
#               Swedish Wikisource page, Swedish abbreviation)
BOOKS: dict[str, tuple[str, str, str, str, str, str]] = {
    "GEN": ("Genesis", "Rdz", "1. Mose", "1_mose", "Första Moseboken", "1 Mos"),
    "EXO": ("Exodus", "Wj", "2. Mose", "2_mose", "Andra Moseboken", "2 Mos"),
    "LEV": ("Leviticus", "Kpł", "3. Mose", "3_mose", "Tredje Moseboken", "3 Mos"),
    "NUM": ("Numbers", "Lb", "4. Mose", "4_mose", "Fjärde Moseboken", "4 Mos"),
    "DEU": ("Deuteronomy", "Pwt", "5. Mose", "5_mose", "Femte Moseboken", "5 Mos"),
    "RUT": ("Ruth", "Rt", "Ruth", "rut", "Rut", "Rut"),
    "1SA": ("1 Samuel", "1 Sm", "1. Samuel", "1_samuel", "Första Samuelsboken", "1 Sam"),
    "1KI": ("1 Kings", "1 Krl", "1. Könige", "1_koenige", "Första Konungaboken", "1 Kung"),
    "NEH": ("Nehemiah", "Ne", "Nehemia", "nehemia", "Nehemja", "Neh"),
    "JOB": ("Job", "Hi", "Hiob", "hiob", "Job", "Job"),
    "PSA": ("Psalm", "Ps", "Psalm", "psalm", "Psaltaren", "Ps"),
    "PRO": ("Proverbs", "Prz", "Sprüche", "sprueche", "Ordspråksboken", "Ords"),
    "ECC": ("Ecclesiastes", "Koh", "Prediger", "prediger", "Predikaren", "Pred"),
    "ISA": ("Isaiah", "Iz", "Jesaja", "jesaja", "Jesaja", "Jes"),
    "JER": ("Jeremiah", "Jr", "Jeremia", "jeremia", "Jeremia", "Jer"),
    "LAM": ("Lamentations", "Lm", "Klagelieder", "klagelieder", "Klagovisorna", "Klag"),
    "EZK": ("Ezekiel", "Ez", "Hesekiel", "hesekiel", "Hesekiel", "Hes"),
    "DAN": ("Daniel", "Dn", "Daniel", "daniel", "Daniel", "Dan"),
    "MAL": ("Malachi", "Ml", "Maleachi", "maleachi", "Malaki", "Mal"),
    "MAT": ("Matthew", "Mt", "Matthäus", "matthaeus", "Matteusevangeliet", "Matt"),
    "MRK": ("Mark", "Mk", "Markus", "markus", "Markusevangeliet", "Mark"),
    "LUK": ("Luke", "Łk", "Lukas", "lukas", "Lukasevangeliet", "Luk"),
    "JHN": ("John", "J", "Johannes", "johannes", "Johannesevangeliet", "Joh"),
    "ACT": ("Acts", "Dz", "Apostelgeschichte", "apostelgeschichte", "Apostlagärningarna", "Apg"),
    "ROM": ("Romans", "Rz", "Römer", "roemer", "Romarbrevet", "Rom"),
    "1CO": ("1 Corinthians", "1 Kor", "1. Korinther", "1_korinther", "Första Korintherbrevet", "1 Kor"),
    "2CO": ("2 Corinthians", "2 Kor", "2. Korinther", "2_korinther", "Andra Korintherbrevet", "2 Kor"),
    "GAL": ("Galatians", "Ga", "Galater", "galater", "Galaterbrevet", "Gal"),
    "EPH": ("Ephesians", "Ef", "Epheser", "epheser", "Efesierbrevet", "Ef"),
    "PHP": ("Philippians", "Flp", "Philipper", "philipper", "Filipperbrevet", "Fil"),
    "COL": ("Colossians", "Kol", "Kolosser", "kolosser", "Kolosserbrevet", "Kol"),
    "HEB": ("Hebrews", "Hbr", "Hebräer", "hebraeer", "Hebreerbrevet", "Hebr"),
    "JAS": ("James", "Jk", "Jakobus", "jakobus", "Jakobsbrevet", "Jak"),
    "1PE": ("1 Peter", "1 P", "1. Petrus", "1_petrus", "Första Petrusbrevet", "1 Petr"),
    "1JN": ("1 John", "1 J", "1. Johannes", "1_johannes", "Första Johannesbrevet", "1 Joh"),
    "REV": ("Revelation", "Ap", "Offenbarung", "offenbarung", "Uppenbarelseboken", "Upp"),
}
BSB_NAME_TO_CODE = {v[0]: k for k, v in BOOKS.items()}
GETBIBLE_NR = {code: fv.BOOKS[v[1]][0] for code, v in BOOKS.items()}

# The passages the games may quote: (id, BSB reference). Ids are stable keys in the BSB's numbering.
# Drop rules remove a psalm title that an edition prints inside the quoted verse (exact prefix, per language).
PASSAGES: list[tuple[str, str]] = [
    # stillness and rest
    ("psa46.10", "Psalm 46:10"), ("psa62.1", "Psalm 62:1"), ("psa62.5", "Psalm 62:5"), ("psa131.2", "Psalm 131:2"),
    ("psa37.7", "Psalm 37:7"), ("psa23.1-3", "Psalm 23:1-3"), ("psa4.8", "Psalm 4:8"), ("psa127.2", "Psalm 127:2"),
    ("isa26.3", "Isaiah 26:3"), ("isa40.31", "Isaiah 40:31"), ("mat11.28", "Matthew 11:28"), ("mrk6.31", "Mark 6:31"),
    ("mrk4.39", "Mark 4:39"), ("1ki19.12", "1 Kings 19:12"), ("lam3.22-23", "Lamentations 3:22-23"),
    ("exo20.8", "Exodus 20:8"), ("gen2.2", "Genesis 2:2"),
    # attention and the Word
    ("psa1.2-3", "Psalm 1:2-3"), ("php4.8", "Philippians 4:8"), ("psa119.105", "Psalm 119:105"),
    ("psa119.18", "Psalm 119:18"), ("luk10.42", "Luke 10:42"), ("col3.23", "Colossians 3:23"), ("pro4.23", "Proverbs 4:23"),
    # creation and the sky
    ("gen1.3", "Genesis 1:3"), ("psa19.1", "Psalm 19:1"), ("psa147.4", "Psalm 147:4"), ("isa40.26", "Isaiah 40:26"),
    ("gen15.5", "Genesis 15:5"), ("psa104.24", "Psalm 104:24"), ("mat6.26", "Matthew 6:26"), ("mat6.28-29", "Matthew 6:28-29"),
    ("psa139.14", "Psalm 139:14"),
    # provision, daily bread, generosity
    ("exo16.4", "Exodus 16:4"), ("exo16.18", "Exodus 16:18"), ("mat6.11", "Matthew 6:11"), ("mat6.33", "Matthew 6:33"),
    ("mat6.34", "Matthew 6:34"), ("jhn6.12", "John 6:12"), ("lev19.9", "Leviticus 19:9"), ("rut2.12", "Ruth 2:12"),
    ("2co9.7", "2 Corinthians 9:7"), ("pro6.6-8", "Proverbs 6:6-8"),
    # shepherd, lost and found, grace
    ("jhn10.27", "John 10:27"), ("luk15.4-6", "Luke 15:4-6"), ("luk15.8-9", "Luke 15:8-9"), ("luk15.20", "Luke 15:20"),
    ("isa42.3", "Isaiah 42:3"), ("mat14.31", "Matthew 14:31"), ("jer18.4", "Jeremiah 18:4"), ("jer18.6", "Jeremiah 18:6"),
    ("mal3.3", "Malachi 3:3"), ("psa103.12", "Psalm 103:12"),
    # growth, fruit, building
    ("mrk4.26-28", "Mark 4:26-28"), ("mat13.31-32", "Matthew 13:31-32"), ("mat13.45-46", "Matthew 13:45-46"),
    ("jhn15.5", "John 15:5"), ("gal5.22-23", "Galatians 5:22-23"), ("1co3.6", "1 Corinthians 3:6"),
    ("mat7.24-25", "Matthew 7:24-25"), ("1pe2.5", "1 Peter 2:5"), ("neh6.15", "Nehemiah 6:15"), ("psa127.1", "Psalm 127:1"),
    ("exo31.3", "Exodus 31:3"), ("ecc3.1", "Ecclesiastes 3:1"), ("ezk47.12", "Ezekiel 47:12"), ("rev22.2", "Revelation 22:2"),
    ("rev21.5", "Revelation 21:5"),
    # light, praise, joy, hope
    ("mat5.14-16", "Matthew 5:14-16"), ("psa150.6", "Psalm 150:6"), ("psa96.1", "Psalm 96:1"), ("1sa16.23", "1 Samuel 16:23"),
    ("psa121.1-2", "Psalm 121:1-2"), ("psa84.5-6", "Psalm 84:5-6"), ("psa126.5", "Psalm 126:5"), ("mat2.10", "Matthew 2:10"),
    ("luk2.14", "Luke 2:14"), ("isa43.2", "Isaiah 43:2"), ("mat1.23", "Matthew 1:23"), ("num6.24-26", "Numbers 6:24-26"),
    ("rom15.13", "Romans 15:13"), ("2co5.17", "2 Corinthians 5:17"), ("heb12.1", "Hebrews 12:1"), ("jas1.5", "James 1:5"),
]

DROP: dict[str, dict[str, str]] = {
    "psa62.1": {"en": "For the choirmaster. According to Jeduthun. A Psalm of David."},
    "psa19.1": {"en": "For the choirmaster. A Psalm of David."},
    "psa23.1-3": {"en": "A Psalm of David.", "pl": "Psalm Dawidowy.", "de": "Ein Psalm Davids.", "sv": "En psalm av David."},
    "psa121.1-2": {"en": "A song of ascents.", "pl": "Pieśń stopni.", "de": "Ein Lied im höhern Chor.", "sv": "En vallfartssång."},
    "psa127.1": {"en": "A song of ascents. Of Solomon.", "pl": "Pieśń stopni dla Salomona.",
                 "de": "Ein Lied Salomos im Höhern Chor.", "sv": "En vallfartssång; av Salomo."},
}

# getbible "polgdanska" records that hold two verses (chapter ends fitted to English chapter lengths):
# split after `marker`, the verse boundary printed in the Gdańsk Bible (fetch_verses.SPLITS has Ps 46,11).
PL_SPLITS: dict[str, str] = {
    "Ps 4,8": "obficie zrodzą.",
}

REF_RE = re.compile(r"^(?P<book>(?:[123] )?[A-Z][A-Za-z ]+?) (?P<ch>\d{1,3}):(?P<v1>\d{1,3})(?:-(?P<v2>\d{1,3}))?$")
LETTERS = re.compile(r"[^\W\d_]", re.UNICODE)
PUNCT = set(" ,.;:?!()'’‘“”»«-–—…")
MIN_RATIO = {"en": 0.85, "de": 0.90, "sv": 0.90}


# ─── download (cached in the data dir) ─────────────────────────────────

def fetch(url: str, dest: Path, offline: bool) -> bytes:
    fresh = not dest.exists()
    data = fv.fetch(url, dest, offline)
    if fresh:
        time.sleep(0.3)  # be gentle with the sites
    return data


# eBible's verse-per-line files use their own codes for a few books
EBIBLE_CODES = {"SOL": "SNG", "EZE": "EZK", "JOE": "JOL", "NAH": "NAM", "MAR": "MRK", "JOH": "JHN", "PHI": "PHP",
                "JAM": "JAS", "1JO": "1JN", "2JO": "2JN", "3JO": "3JN"}


def vpl(zip_bytes: bytes, name: str) -> dict[tuple[str, int, int], str]:
    """eBible's verse-per-line text: 'PSA 46:10 text', keyed by USFM code."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        raw = z.read(name).decode("utf-8-sig")
    out: dict[tuple[str, int, int], str] = {}
    for line in raw.splitlines():
        m = re.match(r"^([1-3A-Z]{3}) (\d+):(\d+) (.*)$", line)
        if m:
            code = EBIBLE_CODES.get(m.group(1), m.group(1))
            out[(code, int(m.group(2)), int(m.group(3)))] = m.group(4)
    return out


def load_bsb(data_dir: Path, offline: bool) -> dict[tuple[str, int, int], str]:
    raw = fetch(BSB_URL, data_dir / "bsb" / "bsb.txt", offline).decode("utf-8-sig")
    out: dict[tuple[str, int, int], str] = {}
    for line in raw.splitlines():
        ref, _, text = line.partition("\t")
        m = re.match(r"^((?:[123] )?[A-Z][A-Za-z ]*?) (\d+):(\d+)$", ref.strip())
        if m and m.group(1) in BSB_NAME_TO_CODE:
            out[(BSB_NAME_TO_CODE[m.group(1)], int(m.group(2)), int(m.group(3)))] = text.strip()
    if len(out) < 100:
        sys.exit("bsb.txt: unexpected format")
    return out


class BibelOnlineChapter(HTMLParser):
    """Verses of a bibel-online.net chapter page: <sub>N</sub> <span class="vers-hover">text<sub>xref</sub></span>."""

    def __init__(self, html: str) -> None:
        super().__init__(convert_charrefs=True)
        self.verses: dict[int, str] = {}
        self.pending: str | None = None
        self.num = ""
        self.in_num = False
        self.in_verse = 0
        self.skip = 0
        self.text: list[str] = []
        self.feed(html)
        self.close()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = dict(attrs).get("class") or ""
        if self.in_verse:
            if tag == "sub":
                self.skip += 1
            elif tag == "br":
                self.text.append(" ")
            if tag == "span":
                self.in_verse += 1
            return
        if tag == "sub":
            self.in_num, self.num = True, ""
        elif tag == "span" and "vers-hover" in cls.split() and self.pending:
            self.in_verse, self.text = 1, []

    def handle_endtag(self, tag: str) -> None:
        if self.in_verse:
            if tag == "sub" and self.skip:
                self.skip -= 1
            elif tag == "span":
                self.in_verse -= 1
                if not self.in_verse:
                    self.verses[int(self.pending)] = " ".join("".join(self.text).split())
                    self.pending = None
            return
        if tag == "sub" and self.in_num:
            self.in_num = False
            self.pending = self.num.strip() if self.num.strip().isdigit() else None

    def handle_data(self, data: str) -> None:
        if self.in_verse and not self.skip:
            self.text.append(data)
        elif self.in_num:
            self.num += data


def load_bibel_online(code: str, ch: int, data_dir: Path, offline: bool) -> dict[int, str]:
    slug = BOOKS[code][3]
    raw = fetch(BIBEL_ONLINE.format(slug=slug, ch=ch), data_dir / "bibel-online" / f"{slug}_{ch}.html", offline)
    verses = {v: re.sub(r"\s*\(Andere (?:Überlieferung|Übersetzung)[^)]*\)", "", t)
              for v, t in BibelOnlineChapter(raw.decode("utf-8", errors="replace")).verses.items()}
    if not verses:
        sys.exit(f"bibel-online.net {slug} {ch}: no verses found")
    return verses


class WikisourceBook(HTMLParser):
    """Verses of a Swedish Wikisource 'Bibeln 1917/<book>' page: <span id="C:V"><sup>V</sup></span> text."""

    def __init__(self, html: str) -> None:
        super().__init__(convert_charrefs=True)
        self.verses: dict[tuple[int, int], str] = {}
        self.cur: tuple[int, int] | None = None
        self.in_marker = 0
        self.skip = 0
        self.text: list[str] = []
        self.feed(html)
        self.close()
        self.flush()

    def flush(self) -> None:
        if self.cur:
            # some books give the cross-references inline, after ">" ("… given. >1 Kon. 3:5 f."): drop them
            self.verses[self.cur] = " ".join("".join(self.text).split(">")[0].split())
        self.cur, self.text = None, []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v or "") for k, v in attrs}
        vid = a.get("id", "")
        if tag == "span" and re.fullmatch(r"\d+:\d+", vid):
            self.flush()
            c, v = vid.split(":")
            self.cur = (int(c), int(v))
            self.in_marker = 1
            return
        if self.in_marker:
            self.in_marker += tag == "span"
            return
        if tag in {"h1", "h2", "h3", "h4"} or (tag == "span" and re.fullmatch(r"\d+", vid)):
            self.flush()
        elif tag in {"sup", "small", "style", "script"} and self.cur:
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if self.in_marker:
            self.in_marker -= tag == "span"
            return
        if tag in {"sup", "small", "style", "script"} and self.skip:
            self.skip -= 1
        elif tag == "p" and self.cur:
            self.flush()

    def handle_data(self, data: str) -> None:
        if self.cur and not self.in_marker and not self.skip:
            self.text.append(data)


def load_sv_wikisource(code: str, data_dir: Path, offline: bool) -> dict[tuple[int, int], str]:
    page = f"Bibeln 1917/{BOOKS[code][4]}"
    query = urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json",
                                    "formatversion": "2", "redirects": "1", "disablelimitreport": "1"})
    safe = re.sub(r"[^\w-]+", "_", BOOKS[code][4])
    doc = json.loads(fetch(f"{SV_WIKISOURCE_API}?{query}", data_dir / "sv-wikisource" / f"{safe}.json", offline))
    if "parse" not in doc:
        sys.exit(f"sv.wikisource: no page {page!r}")
    verses = WikisourceBook(doc["parse"]["text"]).verses
    if not verses:
        sys.exit(f"sv.wikisource {page}: no verses found")
    return verses


def load_getbible_sv(data_dir: Path, offline: bool) -> dict[tuple[int, int], dict[int, str]]:
    doc = json.loads(fetch(GETBIBLE_SV_URL, data_dir / "getbible" / "swedish.json", offline).decode("utf-8"))
    if doc.get("abbreviation") != "swedish" or doc.get("distribution_license") != "Public Domain":
        sys.exit("unexpected getbible swedish metadata")
    # a few verses carry the edition's glossary notes at the end ("[1] Se Fader vår i Ordförklaringarna.")
    return {(int(b["nr"]), int(c["chapter"])): {int(v["verse"]): re.sub(r"\s*\[\d+\].*$", "", str(v["text"]))
                                                 for v in c["verses"]}
            for b in doc["books"] for c in b["chapters"]}


# ─── text helpers ──────────────────────────────────────────────────────

def norm(s: str) -> str:
    return " ".join(s.split())


def letters(s: str) -> str:
    t = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in t if LETTERS.match(c) and not unicodedata.combining(c))


def ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, letters(a), letters(b), autojunk=False).ratio()


def word_diff(a: str, b: str) -> list[str]:
    wa, wb = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        if op != "equal":
            out.append(f"{' '.join(wa[i1:i2]) or '∅'} ≠ {' '.join(wb[j1:j2]) or '∅'}")
    return out


def balance_quotes(s: str) -> str:
    """Drop quotation marks that open or close outside the quoted verses (a speech that started before
    or goes on after them): “…” pairs in English, » in Swedish."""
    for op, cl in (("“", "”"), ("‘", "’")):
        depth, keep = 0, []
        for i, ch in enumerate(s):
            if ch == op:
                depth += 1
            elif ch == cl and not (cl == "’" and i and s[i - 1].isalpha()):   # "potter’s" is an apostrophe
                if depth == 0:
                    continue          # closes a quotation opened before the passage
                depth -= 1
            keep.append(ch)
        s = "".join(keep)
        while depth > 0:              # opens a quotation that ends after the passage
            i = s.rfind(op)
            s = s[:i] + s[i + 1:]
            depth -= 1
    if s.count("»") % 2:              # Swedish uses » both to open and to close
        if s.startswith("»"):         # the passage opens a speech that ends after it: drop the last mark
            i = s.rfind("»")
            s = s[:i] + s[i + 1:]
        else:                         # the passage starts inside a speech: drop the mark that closes it
            s = s.replace("»", "", 1)
    return norm(s)


def edges(s: str) -> str:
    """A quotation that starts or ends inside a sentence gets an ellipsis there (the verse's own comma,
    semicolon or colon at the end gives way to it): "…eins aber ist not.", "…radością bardzo wielką…"."""
    s = s.strip()
    if s and s[0].islower():
        s = "…" + s
    if s and s[-1] in ",;:—–-":
        s = s[:-1].rstrip() + "…"
    elif s and (s[-1].isalpha() or s[-1] == ")"):
        s += "…"
    return s


def check_chars(label: str, s: str, failures: list[str]) -> None:
    bad = sorted({c for c in s if not (c.isalpha() or c in PUNCT)})
    if bad or not s:
        failures.append(f"{label}: empty or unexpected characters {bad}")


def ts_string(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def fmt_range(v1: int, v2: int) -> str:
    return f"{v1}" if v1 == v2 else f"{v1}–{v2}"


# ─── main ──────────────────────────────────────────────────────────────

def parse_ref(ref: str) -> tuple[str, int, int, int]:
    m = REF_RE.match(ref)
    if not m or m.group("book") not in BSB_NAME_TO_CODE:
        sys.exit(f"bad BSB ref {ref!r}")
    v1 = int(m.group("v1"))
    v2 = int(m.group("v2") or v1)
    if v2 < v1:
        sys.exit(f"bad range {ref!r}")
    return BSB_NAME_TO_CODE[m.group("book")], int(m.group("ch")), v1, v2


def drop(lang: str, pid: str, text: str, failures: list[str]) -> str:
    prefix = DROP.get(pid, {}).get(lang)
    if not prefix:
        return text
    if not text.startswith(prefix):
        failures.append(f"{pid} {lang}: drop rule {prefix!r} does not match {text[:60]!r}")
        return text
    return text[len(prefix):].lstrip()


class Sources:
    """Every download, loaded once."""

    def __init__(self, data_dir: Path, offline: bool) -> None:
        self.data_dir, self.offline = data_dir, offline
        self.bsb = load_bsb(data_dir, offline)
        self.engbsb = vpl(fetch(ENGBSB_URL, data_dir / "ebible" / "engbsb_vpl.zip", offline), "engbsb_vpl.txt")
        self.deu = vpl(fetch(DEU1912_URL, data_dir / "ebible" / "deu1912_vpl.zip", offline), "deu1912_vpl.txt")
        fv.SPLITS.update(PL_SPLITS)
        self.gb_pl = fv.load_getbible(data_dir, offline)
        self.gb_sv = load_getbible_sv(data_dir, offline)


class Passage:
    """One passage being checked: the texts per language, the report lines and the failures."""

    def __init__(self, pid: str, ref: str, report: list[str], failures: list[str]) -> None:
        self.pid = pid
        self.code, self.ch, self.v1, self.v2 = parse_ref(ref)
        self.report, self.failures = report, failures
        self.texts: dict[str, list[str]] = {"en": [], "pl": [], "de": [], "sv": []}
        self.offset = 0

    def fail(self, lang: str, msg: str) -> None:
        self.failures.append(f"{self.pid} {lang}: {msg}")

    def compared(self, lang: str, label: str, text: str, witness: str, wname: str, need: float) -> None:
        r = ratio(text, witness) if witness else 0.0
        status = "ok" if r >= need else "LOW"
        self.report.append(f"  {lang} {label:<16} {status:<4} {r:.2f}  {text}")
        if norm(text) != norm(witness):
            self.report.append(f"  {'':<26}{wname}: {norm(witness)}")
            self.report += [f"  {'':<26}diff: {d}" for d in word_diff(norm(text), norm(witness))]
        if status != "ok":
            self.fail(lang, f"{label}: {status} {r:.2f} against {wname}")


def english(p: Passage, src: Sources) -> None:
    """BSB from the publisher's file; eBible's copy (sometimes an older revision) as the witness."""
    name = BOOKS[p.code][0]
    for v in range(p.v1, p.v2 + 1):
        text, witness = src.bsb.get((p.code, p.ch, v)), src.engbsb.get((p.code, p.ch, v))
        if text is None or witness is None:
            p.fail("en", f"{name} {p.ch}:{v} missing ({'bereanbible.com' if text is None else 'eBible'})")
            continue
        p.compared("en", f"{name} {p.ch}:{v}", norm(text), witness, "eBible", MIN_RATIO["en"])
        p.texts["en"].append(norm(text))


def psalm_offset(p: Passage, src: Sources) -> tuple[dict[int, str], dict[tuple[int, int], str]]:
    """Load the German and Swedish witnesses and set the passage's verse offset (psalm titles)."""
    bo = load_bibel_online(p.code, p.ch, src.data_dir, src.offline)
    ws_sv = load_sv_wikisource(p.code, src.data_dir, src.offline)
    if p.code == "PSA":
        en_len = max(v for (c, h, v) in src.bsb if c == p.code and h == p.ch)
        off_de = max(bo) - en_len
        off_sv = max(v for (c, v) in ws_sv if c == p.ch) - en_len
        if off_de != off_sv or off_de < 0:
            p.fail("de/sv", f"psalm offsets disagree: Luther {off_de}, Bibel 1917 {off_sv}")
        p.offset = off_de
    return bo, ws_sv


def polish(p: Passage, src: Sources) -> None:
    """Gdańska from getbible, checked verse by verse against Polish Wikisource (fetch_verses)."""
    abbr = BOOKS[p.code][1]
    found = fv.load_wikisource(abbr, p.ch, src.data_dir, src.offline)
    if found is None:
        p.fail("pl", "no Wikisource chapter to verify against")
        return
    ws, witness = found
    vs = fv.getbible_chapter(src.gb_pl, abbr, p.ch)
    for v in range(p.v1 + p.offset, p.v2 + p.offset + 1):
        label = f"{abbr} {p.ch},{v}"
        if v not in vs:
            p.fail("pl", f"{label} missing in getbible (glued to the verse before? add a PL_SPLITS rule)")
            continue
        text = norm(vs[v])
        status, lines = fv.check_verse(label, v, text, vs, ws, witness)
        p.report.extend("  pl " + line for line in lines)
        if status != "ok":
            # the witness's own numbering is sometimes off by one: accept only a near-exact neighbour
            near = [n for n in (v - 1, v + 1) if n in ws and fv.ratio(text, ws[n]) >= 0.95]
            if near:
                p.report.append(f"  pl {'':<23}accepted: Wikisource numbers this verse {abbr} {p.ch},{near[0]}")
            else:
                p.fail("pl", f"{label}: {status}")
        p.texts["pl"].append(text)


def german(p: Passage, src: Sources, bo: dict[int, str]) -> None:
    """Luther 1912 from eBible (English numbering), checked against bibel-online.net (Luther's numbering)."""
    name = BOOKS[p.code][2]
    for v in range(p.v1, p.v2 + 1):
        text = src.deu.get((p.code, p.ch, v))
        if text is None:
            p.fail("de", f"{p.code} {p.ch}:{v} missing in eBible")
            continue
        text = norm(text)
        if v == 1 and p.offset > 0:         # eBible joins a psalm's title verse to verse 1
            title = norm(bo.get(1, ""))
            if not title or not text.startswith(title):
                p.fail("de", f"title {title!r} not at the start of {text[:60]!r}")
            text = text[len(title):].lstrip()
        witness = bo.get(v + p.offset)
        if witness is None:
            p.fail("de", f"verse {p.ch},{v + p.offset} missing in bibel-online.net")
            continue
        p.compared("de", f"{name} {p.ch},{v + p.offset}", text, witness, "bibel-online", MIN_RATIO["de"])
        p.texts["de"].append(text)


def swedish(p: Passage, src: Sources, ws: dict[tuple[int, int], str]) -> None:
    """Bibel 1917 from Swedish Wikisource, checked against getbible "swedish"."""
    abbr = BOOKS[p.code][5]
    gch = src.gb_sv.get((GETBIBLE_NR[p.code], p.ch), {})
    sv_len = max(v for (c, v) in ws if c == p.ch)
    for v in range(p.v1 + p.offset, p.v2 + p.offset + 1):
        text = ws.get((p.ch, v))
        if text is None:
            p.fail("sv", f"{abbr} {p.ch}:{v} missing in Wikisource")
            continue
        text = norm(text)
        last = max(gch) if gch else 0
        if gch and sv_len > last and v >= last:
            # getbible ends the chapter early and glues the rest onto its last verse: find this verse in it
            glued = norm(gch[last])
            m = difflib.SequenceMatcher(None, letters(glued), letters(text), autojunk=False).find_longest_match()
            r = m.size / max(1, len(letters(text)))
            status = "ok" if r >= MIN_RATIO["sv"] else "LOW"
            p.report.append(f"  sv {abbr} {p.ch}:{v:<10} {status:<4} {r:.2f}  {text}")
            p.report.append(f"  {'':<26}getbible (glued into {p.ch}:{last}): {glued}")
            if status != "ok":
                p.fail("sv", f"{abbr} {p.ch}:{v}: {status} {r:.2f} against the glued getbible verse")
        else:
            g = norm(gch.get(v, ""))
            if g and len(letters(g)) < len(letters(text)) and letters(text).startswith(letters(g)):
                p.report.append(f"  sv {abbr} {p.ch}:{v:<10} ok   (getbible cuts the verse short: {g})  {text}")
            else:
                p.compared("sv", f"{abbr} {p.ch}:{v}", text, g, "getbible", MIN_RATIO["sv"])
        p.texts["sv"].append(text)


def refs(p: Passage) -> dict[str, str]:
    name, pl_abbr, de_name, _, _, sv_abbr = BOOKS[p.code]
    en = fmt_range(p.v1, p.v2)
    native = fmt_range(p.v1 + p.offset, p.v2 + p.offset)
    return {"en": f"{name} {p.ch}:{en}", "pl": f"{pl_abbr} {p.ch},{native}",
            "de": f"{de_name} {p.ch},{native}", "sv": f"{sv_abbr} {p.ch}:{native}"}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--data-dir", type=Path,
                    default=Path(os.environ.get("SCRIPTURE_DATA_DIR") or Path(tempfile.gettempdir()) / "emmanuel-scripture"))
    ap.add_argument("--report", type=Path, help="write the verification report here too")
    ap.add_argument("--offline", action="store_true", help="use cached downloads only")
    ap.add_argument("--check", action="store_true", help="verify only; do not write scripture.ts")
    args = ap.parse_args()

    data_dir = args.data_dir.resolve()
    if data_dir == REPO or REPO in data_dir.parents:
        sys.exit("--data-dir must be outside the repository (downloads are untrusted data)")
    ids = [p for p, _ in PASSAGES]
    dupes = sorted({p for p in ids if ids.count(p) > 1})
    if dupes:
        sys.exit(f"duplicate passage ids: {dupes}")

    src = Sources(data_dir, args.offline)
    report: list[str] = []
    failures: list[str] = []
    out: dict[str, dict[str, tuple[str, str]]] = {}
    for pid, ref in PASSAGES:
        p = Passage(pid, ref, report, failures)
        report.append(f"\n━━ {pid}  {ref}")
        english(p, src)
        bo, ws_sv = psalm_offset(p, src)
        polish(p, src)
        german(p, src, bo)
        swedish(p, src, ws_sv)
        r = refs(p)
        out[pid] = {}
        for lang in ("pl", "en", "de", "sv"):
            joined = edges(balance_quotes(drop(lang, pid, " ".join(p.texts[lang]), failures)))
            check_chars(f"{pid} {lang}", joined, failures)
            out[pid][lang] = (joined, r[lang])
            report.append(f"  ⇒ {lang} [{r[lang]}] {joined}")

    report.append(f"\n{len(out)} passages")
    print("\n".join(report))
    if args.report:
        args.report.write_text("\n".join(report) + "\n", encoding="utf-8")
    if failures:
        print("\nFAILED:\n  " + "\n  ".join(failures), file=sys.stderr)
        sys.exit(1)
    if not args.check:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(render_ts(out), encoding="utf-8")
        print(f"\nwrote {OUT.relative_to(REPO)}")


def render_ts(out: dict[str, dict[str, tuple[str, str]]]) -> str:
    lines = [
        "/**",
        " * Scripture for the arcade games, in the app's four languages. GENERATED by web/scripts/fetch_scripture.py;",
        " * do not edit by hand: add the passage to PASSAGES in the script and re-run it.",
        " *",
        " * Public-domain editions, verbatim (whitespace normalised; quotation marks that open or close outside the",
        " * quoted verses and psalm titles printed inside a verse are dropped):",
        f" *   en  Berean Standard Bible — {BSB_URL}, checked against eBible.org engbsb",
        " *   pl  Biblia Gdańska (1881) — getbible.net polgdanska, verified against Polish Wikisource",
        " *   de  Lutherbibel 1912 — eBible.org deu1912, verified against bibel-online.net",
        " *   sv  Bibel 1917 — Swedish Wikisource, verified against getbible.net swedish",
        " * References use each edition's own numbering (a psalm title is verse 1 in pl, de and sv).",
        " */",
        "import { lang as pageLang, type Lang } from '../i18n';",
        "",
        "export type PassageId =",
        *(f"  | {ts_string(pid)}" for pid in out),
        "  ;",
        "",
        "export interface Passage {",
        "  /** the verses, verbatim */",
        "  text: string;",
        "  /** the reference in the edition's numbering, e.g. \"Ps 46,11\" */",
        "  ref: string;",
        "  /** the edition, e.g. \"Biblia Gdańska\" */",
        "  bible: string;",
        "}",
        "",
        "export const BIBLE_NAMES: Readonly<Record<Lang, string>> = {",
        *(f"  {k}: {ts_string(v)}," for k, v in BIBLES.items()),
        "};",
        "",
        "/** [text, reference] per language. */",
        "export const SCRIPTURE: Readonly<Record<PassageId, Readonly<Record<Lang, readonly [string, string]>>>> = {",
    ]
    for pid, langs in out.items():
        lines.append(f"  {ts_string(pid)}: {{")
        for lang in ("pl", "en", "de", "sv"):
            text, ref = langs[lang]
            lines.append(f"    {lang}: [{ts_string(text)}, {ts_string(ref)}],")
        lines.append("  },")
    lines += [
        "};",
        "",
        "/** A passage in the page's language (or `l`). */",
        "export function passage(id: PassageId, l: Lang = pageLang): Passage {",
        "  const [text, ref] = SCRIPTURE[id][l];",
        "  return { text, ref, bible: BIBLE_NAMES[l] };",
        "}",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
