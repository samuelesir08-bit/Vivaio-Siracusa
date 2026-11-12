#!/usr/bin/env python3
"""Build a reviewable JPG pack for the 21 non-lemon citrus varieties."""
import csv
import io
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image, ImageOps

ROOT = Path.cwd()
SOURCE_JSON = ROOT / "images" / "product-photos.json"
OUT = ROOT / "photo-pack"
PHOTOS = OUT / "21-varieta"
OUT.mkdir(exist_ok=True)
PHOTOS.mkdir(exist_ok=True)

EXCLUDE = {
    "Limone Caviale", "Limone Siracusano", "Limone Femminello",
    "Limone Lunario", "Limone Bergamotto", "Limone Carrubbo",
    "Limone Amalfitana", "Limone Zagara Bianca"
}
# Exact-cultivar searches first; botanical fallback is explicitly marked generic.
SEARCHES = {
    "Arancio Tarocco": (["Tarocco orange citrus"], ["Citrus sinensis orange tree fruit"]),
    "Arancio Washington": (["Washington navel orange"], ["Citrus sinensis navel orange"]),
    "Arancio Moro": (["Moro blood orange"], ["blood orange Citrus sinensis"]),
    "Arancio Navellino": (["Navelina orange citrus"], ["Citrus sinensis orange fruit"]),
    "Arancio Valencia": (["Valencia orange citrus"], ["Citrus sinensis orange fruit"]),
    "Arancio Calabrese": (["Ovale Calabrese orange"], ["Citrus sinensis orange fruit"]),
    "Clementino Isa": (["Clementine ISA citrus"], ["Citrus clementina clementine tree fruit"]),
    "Clementino Hermand": (["Hernandina clementine"], ["Citrus clementina clementine tree fruit"]),
    "Mandarino Marzaiolo": (["Mandarino Marzaiolo"], ["Citrus reticulata mandarin tree fruit"]),
    "Mandarino Tardivo": (["Tardivo di Ciaculli mandarin"], ["Citrus reticulata mandarin tree fruit"]),
    "Kounguat": (["Kumquat Fortunella margarita"], ["Citrus japonica kumquat tree fruit"]),
    "LemonKounguat": (["Lemonquat citrus hybrid"], ["lemonquat citrus fruit"]),
    "Kounguat Gigante": (["Meiwa giant kumquat"], ["large kumquat Fortunella fruit"]),
    "Lime Taiti": (["Tahiti lime Persian lime"], ["Citrus latifolia lime tree fruit"]),
    "Lime Singapore": (["Singapore lime citrus"], ["lime Citrus aurantiifolia tree fruit"]),
    "Pompelmo Rosa": (["pink grapefruit Citrus paradisi"], ["pink grapefruit fruit tree"]),
    "Pompelmo Bianco": (["Marsh seedless white grapefruit"], ["white grapefruit Citrus paradisi"]),
    "Pompelmo Rosso": (["Star Ruby red grapefruit"], ["red grapefruit Citrus paradisi"]),
    "Cedro Diamante": (["Diamante citron Citrus medica"], ["Citrus medica citron fruit tree"]),
    "Cedro Virettone": (["Virettone citron Citrus medica"], ["Citrus medica citron fruit tree"]),
    "Cedro Mano di Buddha": (["Buddha hand citron Citrus medica"], ["Citrus medica sarcodactylis fruit tree"]),
}
HEADERS = {"User-Agent": "AziendaSiracusaPhotoPack/1.1 (+https://github.com/samuelesir08-bit/Vivaio-Siracusa; catalogue image research)"}
session = requests.Session()
session.headers.update(HEADERS)
last_commons_request = 0.0

def clean_html(value):
    return re.sub(r"<[^>]+>", " ", str(value or "")).replace("&nbsp;", " ").strip()

def accepted_commons_license(ext):
    short = clean_html(ext.get("LicenseShortName", {}).get("value", ""))
    url = clean_html(ext.get("LicenseUrl", {}).get("value", ""))
    lowered = (short + " " + url).lower()
    if "noncommercial" in lowered or "by-nc" in lowered or "nc-" in lowered:
        return False
    if "no derivatives" in lowered or "by-nd" in lowered or "nd-" in lowered:
        return False
    return (
        "cc0" in lowered or "public domain" in lowered or "pd-" in lowered
        or "by 4.0" in lowered or "by-sa 4.0" in lowered
        or "by 3.0" in lowered or "by-sa 3.0" in lowered
        or "by 2.0" in lowered or "by-sa 2.0" in lowered
        or "cc by" in lowered or "cc-by" in lowered
    )

def commons_results(query):
    global last_commons_request
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f'filetype:bitmap "{query}"',
        "gsrnamespace": 6, "gsrlimit": 25,
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
        "iiurlwidth": 1600, "maxlag": 5
    }
    # Wikimedia throttles bursts: space requests and retry 429/503 responses.
    wait_for = max(0.0, 3.2 - (time.monotonic() - last_commons_request))
    if wait_for:
        time.sleep(wait_for)
    for attempt, delay in enumerate((0, 6, 15), start=1):
        try:
            response = session.get("https://commons.wikimedia.org/w/api.php", params=params, timeout=45)
            last_commons_request = time.monotonic()
            if response.status_code in (429, 503):
                if attempt < 3:
                    time.sleep(delay or 6)
                    continue
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages", {})
            return sorted(pages.values(), key=lambda p: p.get("title", ""))
        except Exception as exc:
            last_commons_request = time.monotonic()
            if attempt < 3:
                time.sleep(delay or 6)
                continue
            print(f"Commons search failed ({query}): {exc}", file=sys.stderr)
    return []

def image_to_jpg(content, destination):
    im = Image.open(io.BytesIO(content))
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB",):
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            alpha = im.getchannel("A") if "A" in im.getbands() else None
            bg.paste(im.convert("RGB"), mask=alpha)
            im = bg
        else:
            im = im.convert("RGB")
    im.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    im.save(destination, "JPEG", quality=88, optimize=True, progressive=True)

def download_url(url, dest):
    r = session.get(url, timeout=45, stream=True)
    r.raise_for_status()
    data = r.content
    if not data or len(data) > 25 * 1024 * 1024:
        raise ValueError("empty file or larger than 25 MB")
    image_to_jpg(data, dest)
    return len(data)

def get_commons_candidates(query, exact=True):
    candidates = []
    for page in commons_results(query):
        info = (page.get("imageinfo") or [{}])[0]
        ext = info.get("extmetadata", {})
        mime = info.get("mime", "")
        lic = clean_html(ext.get("LicenseShortName", {}).get("value", ""))
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if not accepted_commons_license(ext):
            continue
        candidates.append({
            "url": info.get("thumburl") or info.get("url"),
            "title": page.get("title", "").replace("File:", ""),
            "author": clean_html(ext.get("Artist", {}).get("value", "")),
            "license": lic,
            "license_url": clean_html(ext.get("LicenseUrl", {}).get("value", "")),
            "source": "Wikimedia Commons",
            "match_type": "cultivar_search" if exact else "botanical_fallback",
        })
    return candidates

with SOURCE_JSON.open(encoding="utf-8") as f:
    photo_data = json.load(f)

varieties = [name for name in photo_data if name not in EXCLUDE]
# Keep only the 21 products requested; preserve the order in the catalog.
if len(varieties) != 21:
    raise SystemExit(f"Expected 21 varieties; found {len(varieties)}: {varieties}")

manifest_rows = []
summary = {}
total = 0
for variety in varieties:
    slug = re.sub(r"[^a-z0-9]+", "-", variety.lower()).strip("-")
    folder = PHOTOS / slug
    folder.mkdir(parents=True, exist_ok=True)
    seen = set()
    saved = 0
    # Existing catalog candidates are retained for review, but their rights status stays explicit.
    for entry in photo_data.get(variety, []):
        if saved >= 3:
            break
        url = entry.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        filename = f"{slug}-{saved+1:02d}.jpg"
        target = folder / filename
        try:
            size = download_url(url, target)
            manifest_rows.append({
                "variety": variety, "file": f"21-varieta/{slug}/{filename}",
                "source": entry.get("source", url), "image_url": url,
                "title": entry.get("title", ""), "author": entry.get("author", ""),
                "license_status": "DA_VERIFICARE: fonte già nel catalogo, riuso commerciale non verificato",
                "license": entry.get("license", ""), "match": "catalog_candidate",
                "download_bytes": size
            })
            saved += 1
            total += 1
        except Exception as exc:
            print(f"Download failed for {variety} candidate {url}: {exc}", file=sys.stderr)
            if target.exists():
                target.unlink()
    # Fill gaps from Commons: exact cultivar query before botanical fallback.
    exact_queries, fallback_queries = SEARCHES.get(variety, ([], []))
    pools = []
    for q in exact_queries:
        pools.extend(get_commons_candidates(q, True))
    for q in fallback_queries:
        if saved >= 3:
            break
        pools.extend(get_commons_candidates(q, False))
    for candidate in pools:
        if saved >= 3:
            break
        url = candidate.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        filename = f"{slug}-{saved+1:02d}.jpg"
        target = folder / filename
        try:
            size = download_url(url, target)
            manifest_rows.append({
                "variety": variety, "file": f"21-varieta/{slug}/{filename}",
                "source": candidate.get("source", ""), "image_url": url,
                "title": candidate.get("title", ""), "author": candidate.get("author", ""),
                "license_status": "LICENZA APERTA VERIFICATA IN COMMONS",
                "license": candidate.get("license", "") + " " + candidate.get("license_url", ""),
                "match": candidate.get("match_type", ""), "download_bytes": size
            })
            saved += 1
            total += 1
        except Exception as exc:
            print(f"Commons image failed for {variety} {url}: {exc}", file=sys.stderr)
            if target.exists():
                target.unlink()
        time.sleep(0.5)
    summary[variety] = saved
    print(f"{variety}: {saved}/3 JPG")

with (OUT / "fonti-e-licenze.csv").open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "variety", "file", "source", "image_url", "title", "author",
        "license_status", "license", "match", "download_bytes"
    ])
    writer.writeheader()
    writer.writerows(manifest_rows)
with (OUT / "riepilogo.json").open("w", encoding="utf-8") as f:
    json.dump({"totale_jpg": total, "varieta": summary}, f, ensure_ascii=False, indent=2)

zip_path = ROOT / "Azienda-Siracusa-21-varieta-JPG.zip"
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as z:
    for path in sorted(PHOTOS.rglob("*.jpg")):
        z.write(path, path.relative_to(OUT))
    z.write(OUT / "fonti-e-licenze.csv", "fonti-e-licenze.csv")
    z.write(OUT / "riepilogo.json", "riepilogo.json")

print(f"Created {zip_path} with {total} JPG files.")
if total == 0:
    raise SystemExit("No image files downloaded.")
