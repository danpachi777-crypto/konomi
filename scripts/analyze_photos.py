"""Measure central image colors locally; this does not segment clothing."""
import colorsys
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
METHOD = "central-region-colors-v1"


def color_family(rgb):
    r, g, b = (channel / 255 for channel in rgb)
    hue, saturation, value = colorsys.rgb_to_hsv(r, g, b)
    if value < 0.22:
        return "黒"
    if saturation < 0.16:
        return "白" if value > 0.83 else "グレー"
    degrees = hue * 360
    if 15 <= degrees < 65 and saturation < 0.5:
        return "ベージュ" if value > 0.65 else "ブラウン"
    if degrees < 15 or degrees >= 345:
        return "赤"
    if degrees < 45:
        return "オレンジ・茶"
    if degrees < 70:
        return "黄"
    if degrees < 170:
        return "緑"
    if degrees < 260:
        return "青"
    return "紫・ピンク"


def analyze_image(image):
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size
    # Reduce peripheral background and the upper face area, without claiming
    # to detect the subject or to separate clothes from skin/background.
    region = image.crop((int(width * 0.28), int(height * 0.28),
                         int(width * 0.72), int(height * 0.88)))
    region.thumbnail((80, 120))
    pixels = list(region.get_flattened_data())
    counts = Counter(color_family(pixel) for pixel in pixels)
    palette = [{"name": name, "share": round(count / len(pixels), 4)}
               for name, count in counts.most_common()]
    return {"method": METHOD, "palette": palette,
            "brightness": round(sum(max(pixel) / 255 for pixel in pixels) / len(pixels), 4),
            "sampleRegion": [0.28, 0.28, 0.72, 0.88]}


def main():
    manifest = json.loads((ROOT / "assets/photo-sources.json").read_text(encoding="utf-8"))
    items = {}
    for source in manifest["items"]:
        file = (ROOT / source["localPath"]).resolve()
        if not file.is_relative_to(ROOT / "assets/outfits"):
            raise ValueError("Photo path is outside the outfit directory")
        with Image.open(file) as image:
            result = analyze_image(image)
        result["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
        items[source["id"]] = result
    output = {"schemaVersion": 1, "method": METHOD, "items": items}
    serialized = json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    (ROOT / "assets/photo-analysis.json").write_text(serialized, encoding="utf-8")
    (ROOT / "photo-analysis.js").write_text(
        "(function(root) { const analysis = " + serialized.rstrip()
        + "; if (typeof module === 'object' && module.exports) module.exports = analysis;"
        + " else (root.window || root).KONOMI_PHOTO_ANALYSIS = analysis; })(globalThis);\n",
        encoding="utf-8")
    print(f"Analyzed {len(items)} photographs with Python/Pillow.")


if __name__ == "__main__":
    main()
