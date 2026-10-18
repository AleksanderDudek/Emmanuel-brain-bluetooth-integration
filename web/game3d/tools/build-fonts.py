#!/usr/bin/env python3
"""
Builds the two fonts of HolyHolyHoly 3D (project/assets/fonts), the same faces as the 2D game:
Cinzel for titles and EB Garamond for text, both SIL Open Font License.

The variable fonts come from the google/fonts repository at a pinned commit; each is instanced at
one weight and subset to Latin, Latin Extended-A (Polish: ą ć ę ł ń ó ś ź ż) and punctuation, so
the game ships two small TTF files that render the same in every browser.

    python3 game3d/tools/build-fonts.py        (needs fontTools: pip install fonttools)
"""
import io
import pathlib
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl"
OUT = pathlib.Path(__file__).resolve().parent.parent / "project" / "assets" / "fonts"

FONTS = [
    # (source file, licence folder, weight, output)
    ("cinzel/Cinzel%5Bwght%5D.ttf", "cinzel", 600, "Cinzel-SemiBold.ttf"),
    ("ebgaramond/EBGaramond%5Bwght%5D.ttf", "ebgaramond", 500, "EBGaramond-Medium.ttf"),
]

# Basic Latin, Latin-1, Latin Extended-A, general punctuation, currency, arrows, multiplication sign
UNICODES = [*range(0x20, 0x7F), *range(0xA0, 0x180), *range(0x2010, 0x2070), *range(0x20A0, 0x20C0), *range(0x2190, 0x2194)]


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url) as response:
        return response.read()


def build(source: str, weight: int) -> TTFont:
    font = TTFont(io.BytesIO(fetch(f"{GOOGLE_FONTS}/{source}")))
    font = instancer.instantiateVariableFont(font, {"wght": weight})
    options = subset.Options()
    options.layout_features = ["kern", "liga", "clig", "calt", "ccmp", "locl", "mark", "mkmk", "lnum", "pnum"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    return font


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source, folder, weight, name in FONTS:
        font = build(source, weight)
        font.save(OUT / name)
        (OUT / f"OFL-{folder}.txt").write_bytes(fetch(f"{GOOGLE_FONTS}/{folder}/OFL.txt"))
        print(f"{name}: {(OUT / name).stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
