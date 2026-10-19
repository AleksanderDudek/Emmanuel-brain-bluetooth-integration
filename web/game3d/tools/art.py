#!/usr/bin/env python3
"""
Painted art for HolyHolyHoly 3D, generated locally (free, offline after the first download):
archangels, the people under their protection, Christ in icon style, the traumas, skill icons
for every tier, story panels and textures.

    python3 game3d/tools/art.py generate [ids…]   paint what is missing (or the given ids) → ~/generations
    python3 game3d/tools/art.py process  [ids…]   derive the game files (cut-out, trim, resize, WebP)
    python3 game3d/tools/art.py list              show the manifest and what is done
    python3 game3d/tools/art.py prune             forget lock entries of ids no longer in the manifest

Model: DreamShaper XL Lightning (SDXL, OpenRAIL++-M) with the fp16-fixed SDXL VAE, through
diffusers on Apple Silicon (MPS) or CUDA; 6 steps, CFG 2, DPM++ SDE Karras. Cut-outs: rembg
(BiRefNet). Needs: torch, diffusers>=0.35, transformers, rembg, Pillow.

Every original is saved flat into ~/generations as holyholyholy3d_<id>_<unix>.png with a JSON
sidecar (model, prompt, seed, parameters), the same contract as the /generate skill, and the
chosen original per id is pinned in game3d/art/lock.json. The game uses only the processed
files in project/assets, so the build never needs the model.
"""
import hashlib
import json
import os
import re
import sys
import time
import zlib
from pathlib import Path

GAME3D = Path(__file__).resolve().parent.parent
ART = GAME3D / "art"
MANIFEST = ART / "manifest.json"
LOCK = ART / "lock.json"
ASSETS = GAME3D / "project" / "assets"
GENERATIONS = Path(os.environ.get("GENERATIONS_DIR", Path.home() / "generations"))
MODEL = "Lykon/dreamshaper-xl-lightning"
VAE = "madebyollin/sdxl-vae-fp16-fix"
STYLE_NEGATIVE = (
    "blurry, lowres, jpeg artifacts, deformed, disfigured, bad anatomy, extra limbs, extra fingers, "
    "mutated hands, text, letters, watermark, signature, logo, frame, border, cropped, out of frame"
)


def load_manifest():
    """Items with their style and defaults applied. {NAME} in a prompt is replaced from "vars"; an
    item without a seed gets a stable one from its id (change the seed to paint a new version)."""
    data = json.loads(MANIFEST.read_text())
    defaults = data.get("defaults", {})
    styles = data.get("styles", {})
    variables = data.get("vars", {})
    expand = lambda text: re.sub(r"\{([A-Z_]+)\}", lambda m: variables[m.group(1)], text)
    items = []
    for item in data["items"]:
        style = styles.get(item.get("style", ""), {})
        merged = {**defaults, **{k: v for k, v in style.items() if k not in ("prefix", "suffix")}, **item}
        merged.setdefault("seed", zlib.crc32(item["id"].encode()) % 1_000_000)
        merged["prompt"] = expand(" ".join(p for p in [style.get("prefix", ""), item["prompt"], style.get("suffix", "")] if p).strip())
        merged["negative"] = ", ".join(p for p in [STYLE_NEGATIVE, style.get("negative", ""), item.get("negative", "")] if p)
        items.append(merged)
    ids = [i["id"] for i in items]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise SystemExit(f"duplicate ids in the manifest: {sorted(duplicates)}")
    return items


def prompt_hash(item):
    key = json.dumps([item["prompt"], item["negative"], item["width"], item["height"], item["steps"], item["guidance"], item["seed"]])
    return hashlib.sha1(key.encode()).hexdigest()[:12]


def read_lock():
    return json.loads(LOCK.read_text()) if LOCK.exists() else {}


def write_lock(lock):
    LOCK.write_text(json.dumps(dict(sorted(lock.items())), indent=1, ensure_ascii=False) + "\n")


def pipeline():
    import torch
    from diffusers import AutoencoderKL, DPMSolverMultistepScheduler, StableDiffusionXLPipeline

    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device != "cpu" else torch.float32
    vae = AutoencoderKL.from_pretrained(VAE, torch_dtype=dtype)
    pipe = StableDiffusionXLPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=dtype, variant="fp16")
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
    # decoding in tiles keeps the VAE's peak memory low, so the UNet is not swapped out between images
    pipe.enable_vae_tiling()
    return pipe.to(device), torch


def make_tileable(pipe):
    """Circular padding in every convolution: the image wraps around, so textures tile seamlessly."""
    import torch

    for module in list(pipe.unet.modules()) + list(pipe.vae.modules()):
        if isinstance(module, torch.nn.Conv2d):
            module.padding_mode = "circular"


def make_flat(pipe):
    import torch

    for module in list(pipe.unet.modules()) + list(pipe.vae.modules()):
        if isinstance(module, torch.nn.Conv2d):
            module.padding_mode = "zeros"


def generate(ids):
    items = load_manifest()
    lock = read_lock()
    # "keep": the pinned original stays even if the prompt changed (an earlier painting was the best one)
    todo = [i for i in items if (i["id"] in ids if ids else lock.get(i["id"], {}).get("hash") != prompt_hash(i) and not (i.get("keep") and i["id"] in lock))]
    if not todo:
        print("Nothing to paint: every item matches the lock.")
        return
    print(f"Painting {len(todo)} item(s) with {MODEL} …", flush=True)
    pipe, torch = pipeline()
    for item in todo:
        # CLIP reads 77 tokens; whatever comes later is silently dropped, so warn about it
        count = len(pipe.tokenizer(item["prompt"]).input_ids)
        if count > 77:
            print(f"  ! {item['id']}: prompt is {count} tokens, the end is cut off", flush=True)
    GENERATIONS.mkdir(parents=True, exist_ok=True)
    tiled = None
    for n, item in enumerate(todo, 1):
        if item.get("tileable", False) != tiled:
            (make_tileable if item.get("tileable") else make_flat)(pipe)
            tiled = item.get("tileable", False)
            # tiles would break the wrap-around of seamless textures
            (pipe.disable_vae_tiling if tiled else pipe.enable_vae_tiling)()
        started = time.time()
        image = pipe(
            prompt=item["prompt"],
            negative_prompt=item["negative"],
            width=item["width"],
            height=item["height"],
            num_inference_steps=item["steps"],
            guidance_scale=item["guidance"],
            generator=torch.Generator("cpu").manual_seed(item["seed"]),
        ).images[0]
        stamp = int(time.time())
        name = f"holyholyholy3d_{item['id'].replace('-', '_')}_{stamp}"
        image.save(GENERATIONS / f"{name}.png")
        sidecar = {
            "model": MODEL,
            "alias": "dreamshaper-xl-lightning",
            "provider": "local (diffusers, " + str(pipe.device) + ")",
            "prompt": item["prompt"],
            "negative_prompt": item["negative"],
            "refs": [],
            "params": {k: item[k] for k in ("width", "height", "steps", "guidance", "seed")} | {"scheduler": "DPM++ SDE Karras", "vae": VAE, "tileable": bool(item.get("tileable"))},
            "cost_usd": 0,
            "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(stamp)),
            "source_url": None,
            "file": f"{name}.png",
            "project": "holyholyholy3d",
            "manifest_id": item["id"],
        }
        (GENERATIONS / f"{name}.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False))
        lock[item["id"]] = {"original": f"{name}.png", "hash": prompt_hash(item)}
        write_lock(lock)
        print(f"[{n}/{len(todo)}] {item['id']} → {name}.png ({time.time() - started:.0f} s)", flush=True)


_SESSION = None


def cutout(image):
    """Removes the background (BiRefNet), keeping soft edges."""
    global _SESSION
    from rembg import new_session, remove

    if _SESSION is None:
        _SESSION = new_session("birefnet-general")
    return remove(image, session=_SESSION, post_process_mask=True)


def luminance_alpha(image):
    """For glowing effects painted on black: brightness becomes opacity, colour is kept bright."""
    from PIL import Image, ImageChops

    rgb = image.convert("RGB")
    alpha = rgb.convert("L").point(lambda v: min(255, int(max(0, v - 12) * 1.6)))
    out = rgb.copy()
    out.putalpha(alpha)
    return out


GOLD = (226, 186, 98, 255)
GOLD_DARK = (120, 84, 30, 255)


def framed(image, kind):
    """Frames drawn at 4× and scaled down: a round medallion (portraits) or a gilded square (skill icons)."""
    from PIL import Image, ImageDraw

    size = image.width
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    ring = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(mask)
    r = ImageDraw.Draw(ring)
    if kind == "medallion":
        d.ellipse((0, 0, big - 1, big - 1), fill=255)
        r.ellipse((8, 8, big - 9, big - 9), outline=GOLD_DARK, width=int(big * 0.05))
        r.ellipse((16, 16, big - 17, big - 17), outline=GOLD, width=int(big * 0.03))
    else:
        radius = int(big * 0.12)
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=radius, fill=255)
        r.rounded_rectangle((6, 6, big - 7, big - 7), radius=radius, outline=GOLD_DARK, width=int(big * 0.04))
        r.rounded_rectangle((14, 14, big - 15, big - 15), radius=radius - 8, outline=GOLD, width=int(big * 0.022))
    out = image.convert("RGBA").resize((big, big), Image.LANCZOS)
    out.putalpha(mask)
    out = Image.alpha_composite(out, ring)
    return out.resize((size, size), Image.LANCZOS)


def process(ids):
    from PIL import Image

    items = load_manifest()
    lock = read_lock()
    done = 0
    for item in items:
        if ids and item["id"] not in ids:
            continue
        entry = lock.get(item["id"])
        if not entry:
            print(f"  skip {item['id']}: not painted yet")
            continue
        image = Image.open(GENERATIONS / entry["original"]).convert("RGBA")
        mode = item.get("alpha", "none")
        if mode == "cutout":
            image = cutout(image)
        elif mode == "glow":
            image = luminance_alpha(image)
        if mode in ("cutout", "glow"):
            box = image.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
            if box:
                pad = 4
                image = image.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad), min(image.height, box[3] + pad)))
        if item.get("repeat", 1) > 1:
            # a seamless texture repeated n×n, so its pattern comes out finer in the game
            n = item["repeat"]
            tiled = Image.new(image.mode, (image.width * n, image.height * n))
            for ty in range(n):
                for tx in range(n):
                    tiled.paste(image, (tx * image.width, ty * image.height))
            image = tiled
        if "tone" in item:
            # [brightness, saturation]: calmer floors keep the figures readable
            from PIL import ImageEnhance

            brightness, saturation = item["tone"]
            rgb = ImageEnhance.Color(ImageEnhance.Brightness(image.convert("RGB")).enhance(brightness)).enhance(saturation)
            image = rgb.convert(image.mode)
        out_w, out_h = item["out_size"]
        if item.get("fit", "contain") == "cover":
            scale = max(out_w / image.width, out_h / image.height)
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
            left, top = (image.width - out_w) // 2, (image.height - out_h) // 2
            image = image.crop((left, top, left + out_w, top + out_h))
        else:
            image.thumbnail((out_w, out_h), Image.LANCZOS)
        if item.get("frame"):
            image = framed(image, item["frame"])
        target = ASSETS / item["out"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.suffix == ".webp":
            image.save(target, "WEBP", quality=item.get("quality", 82), method=6)
        elif target.suffix == ".jpg":
            image.convert("RGB").save(target, "JPEG", quality=item.get("quality", 84), optimize=True, progressive=True)
        else:
            image.save(target, "PNG", optimize=True)
        done += 1
        print(f"  {item['id']} → {item['out']} {image.size[0]}×{image.size[1]}")
    print(f"{done} file(s) processed")


def show():
    lock = read_lock()
    items = load_manifest()
    for item in items:
        state = "missing" if item["id"] not in lock else "done" if item.get("keep") or lock[item["id"]].get("hash") == prompt_hash(item) else "changed"
        print(f"{state:8} {item['id']:34} → {item['out']}")
    stale = sorted(set(lock) - {i["id"] for i in items})
    if stale:
        print("not in the manifest any more (kept in ~/generations):", ", ".join(stale))


def prune():
    """Drops lock entries of ids that left the manifest (their originals stay in ~/generations)."""
    lock = read_lock()
    ids = {i["id"] for i in load_manifest()}
    write_lock({k: v for k, v in lock.items() if k in ids})


if __name__ == "__main__":
    command, *rest = sys.argv[1:] or ["list"]
    {"generate": generate, "process": process, "list": lambda _: show(), "prune": lambda _: prune()}[command](rest)
