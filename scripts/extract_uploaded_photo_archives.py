#!/usr/bin/env python3
"""Extract user-supplied lemon photo archives into static JPG files for GitHub Pages."""
# Build revision 1: static JPEG output, no runtime archive extraction.
from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "images"
OUTPUT_ROOT = IMAGE_ROOT / "catalog-jpg"
CATALOG_PATH = IMAGE_ROOT / "product-photos.json"

ARCHIVES = {
    "Limone Caviale": ("LIMONE CAVIALE.zip", "limone-caviale"),
    "Limone Siracusano": ("limone-siracusano-foto.zip", "limone-siracusano"),
    "Limone Femminello": ("limone-femminello-foto.zip", "limone-femminello"),
    "Limone Lunario": ("limone-lunario-corretto-foto.zip", "limone-lunario"),
    "Limone Bergamotto": ("limone-bergamotto-foto.zip", "limone-bergamotto"),
    "Limone Carrubbo": ("limone-carrubbo-foto.zip", "limone-carrubbo"),
    "Limone Amalfitana": ("limone-amalfitana-foto.zip", "limone-amalfitana"),
    "Limone Zagara Bianca": ("limone-zagara-bianca-foto-aggiornato.zip", "limone-zagara-bianca"),
}

def natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", value)]

def convert_to_jpg(raw: bytes, destination: Path) -> None:
    with Image.open(BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")
        image.save(destination, format="JPEG", quality=92, optimize=True, progressive=True)

def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    all_rows = []
    total = 0

    for product_name, (archive_name, slug) in ARCHIVES.items():
        archive_path = IMAGE_ROOT / archive_name
        if not archive_path.exists():
            raise FileNotFoundError(f"Archive not found: {archive_path}")

        destination_dir = OUTPUT_ROOT / slug
        if destination_dir.exists():
            shutil.rmtree(destination_dir)
        destination_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(archive_path) as archive:
            members = [
                item for item in archive.infolist()
                if not item.is_dir()
                and item.filename.lower().endswith((".jpg", ".jpeg", ".png"))
                and "__macosx" not in item.filename.lower()
                and not Path(item.filename).name.startswith("._")
            ]
            members.sort(key=lambda item: natural_key(item.filename))

            if not members:
                raise ValueError(f"No image files found in {archive_name}")

            rows = []
            for index, member in enumerate(members, start=1):
                filename = f"{slug}-{index:02d}.jpg"
                destination = destination_dir / filename
                convert_to_jpg(archive.read(member), destination)
                relative_url = f"images/catalog-jpg/{slug}/{filename}"
                row = {
                    "url": relative_url,
                    "title": f"{product_name} — foto {index}",
                    "author": "Foto fornite da Vivaio Siracusa",
                    "license": "Archivio fotografico fornito dal titolare del progetto",
                    "source": archive_name
                }
                rows.append(row)
                all_rows.append({"varieta": product_name, "file": relative_url})
                total += 1

        catalog[product_name] = rows
        print(f"{product_name}: {len(rows)} JPG")

    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(
            {"total_jpg": total, "varieties": len(ARCHIVES), "files": all_rows},
            ensure_ascii=False, indent=2
        ) + "\n",
        encoding="utf-8"
    )

    if total != 24:
        print(f"NOTICE: found {total} JPGs instead of the expected 24.")
    print(f"TOTAL: {total} JPG files across {len(ARCHIVES)} varieties.")

if __name__ == "__main__":
    main()
