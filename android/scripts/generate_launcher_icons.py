#!/usr/bin/env python3
"""Generate Android launcher icons from the live public iStore PWA manifest."""

import io
import json
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_URL = "https://ist.web.id/api/public/pwa-manifest"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def fetch(url: str, accept: str):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "iStore-Android-Icon-Builder/1.0", "Accept": accept},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        final_url = response.geturl()
        if urllib.parse.urlparse(final_url).scheme != "https":
            raise RuntimeError("Icon source redirected away from HTTPS.")
        return response.read(), response.headers.get("Content-Type", "")


def main() -> None:
    manifest_bytes, content_type = fetch(MANIFEST_URL, "application/manifest+json, application/json")
    if "json" not in content_type.lower():
        raise RuntimeError("Expected JSON manifest, received Content-Type: " + content_type)
    manifest = json.loads(manifest_bytes)
    icons = manifest.get("icons")
    if not isinstance(icons, list) or not icons:
        raise RuntimeError("Public PWA manifest has no icons array.")

    candidates = []
    for icon in icons:
        src = icon.get("src")
        if not isinstance(src, str) or not src.strip():
            continue
        url = urllib.parse.urljoin(MANIFEST_URL, src)
        if urllib.parse.urlparse(url).scheme != "https":
            continue
        declared = 0
        for token in str(icon.get("sizes", "")).split():
            try:
                declared = max(declared, int(token.lower().split("x", 1)[0]))
            except (ValueError, IndexError):
                continue
        candidates.append((declared, url))

    if not candidates:
        raise RuntimeError("No HTTPS icon URL was found in the public PWA manifest.")

    candidates.sort(reverse=True)
    errors = []
    for _, icon_url in candidates:
        try:
            image_bytes, image_type = fetch(icon_url, "image/png, image/webp, image/jpeg, image/*")
            if not image_type.lower().startswith("image/"):
                raise RuntimeError("Expected image, received Content-Type: " + image_type)
            with Image.open(io.BytesIO(image_bytes)) as source:
                source.load()
                if source.width < 192 or source.height < 192:
                    raise RuntimeError(
                        "Configured icon is too small (" + str(source.width) + "x" + str(source.height)
                        + "); provide an icon of at least 192x192."
                    )
                icon = ImageOps.fit(
                    source.convert("RGBA"),
                    (512, 512),
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
                for folder, size in SIZES.items():
                    destination = ROOT / "app" / "src" / "main" / "res" / folder / "ic_launcher.png"
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    icon.resize((size, size), Image.Resampling.LANCZOS).save(destination, "PNG")
            print("Generated launcher icons from " + urllib.parse.urlparse(icon_url).hostname
                  + "; source content type: " + image_type)
            return
        except Exception as exc:
            errors.append(icon_url + ": " + str(exc))

    raise RuntimeError("Unable to generate launcher icons. " + " | ".join(errors))


if __name__ == "__main__":
    main()
