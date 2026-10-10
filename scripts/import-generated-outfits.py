"""Package the selected imagegen contact sheets as individual outfit photos.

The original sheets are retained in assets/generated/sheets. Cropping only separates
the nine photographs; it does not synthesize or alter their contents.
"""
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path.home() / ".codex/generated_images/01a1142a-c1bf-73e0-86e6-f9078a58f90e"
SHEETS = {
    "mix-00": "exec-bfb47297-d9cb-419d-a60e-104db0d69b24.png",
    "men-01": "exec-805b53ab-7265-42eb-a24f-68c150b2e81a.png",
    "women-01": "exec-7c881a5e-14d7-4290-b45d-8999235eafe2.png",
    "men-02": "exec-d212844a-074e-46c2-b905-e23c6516dd50.png",
    "women-02": "exec-a28f2bb2-b4fe-42f8-9562-b3afb60c5e3c.png",
    "men-03": "exec-b63d5493-3f7a-48bc-8f57-7a106e18d990.png",
    "women-03": "exec-6d71b39c-64a8-4feb-a12c-ab9f30cb4482.png",
    "men-04": "exec-39287e9c-13bf-43b2-8751-ea601ece9c96.png",
    "women-04": "exec-05e9f764-cc4c-41ef-a952-da07efb28f76.png",
    "men-05": "exec-8d0d8953-e54e-44a8-9f90-e91ec59576d3.png",
    "women-05": "exec-5bce8be5-b4b4-483c-a462-fa5288ded8c8.png",
    "men-06": "exec-c3f610ef-632d-43d6-a2dc-081b44f3cfd2.png",
    "women-06": "exec-948d1bd4-db5b-4b98-86c9-eebf6f4138db.png",
    "men-07": "exec-d75c77cd-9c87-46c1-92d1-e2ba9f8f405b.png",
    "women-07": "exec-59d44bd5-ad61-4db6-8944-ec827089675a.png",
    "men-08": "exec-dfee9742-6b3b-4991-abf2-dbdc26d7fb76.png",
    "women-08": "exec-5f6dc34c-8ce2-40dd-b242-6170a6c80794.png",
    "men-09": "exec-48b61603-797f-4e26-9a8a-7feb487cc8e0.png",
}

looks = json.loads(subprocess.check_output(
    ["node", "-e", "process.stdout.write(JSON.stringify(require('./generated-outfits.js')))"],
    cwd=ROOT,
))
assert len(looks) == 162
output = ROOT / "assets/generated"
sheet_dir = output / "sheets"
sheet_dir.mkdir(parents=True, exist_ok=True)

for sheet, filename in SHEETS.items():
    target = sheet_dir / f"{sheet}.png"
    if not target.exists():
        shutil.copy2(SOURCE / filename, target)
    with Image.open(target) as image:
        width, height = image.size
        assert width == 1024 and height == 1536, (sheet, image.size)
        for i in range(9):
            x0 = round((i % 3) * width / 3)
            y0 = round((i // 3) * height / 3)
            x1 = round(((i % 3) + 1) * width / 3)
            y1 = round(((i // 3) + 1) * height / 3)
            # A narrow inset removes the sheet's white dividing line.
            tile = image.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3)).convert("RGB")
            tile.save(output / f"{sheet}-{i + 1:02d}.jpg", quality=88, optimize=True)

manifest = {
    "schemaVersion": 1,
    "generatedAt": "2026-10-08",
    "source": "OpenAI imagegen built-in tool",
    "note": "AI-generated outfit photographs. The depicted people and places are synthetic. Each sheet contains nine separately reviewed looks.",
    "items": [
        {"id": look["id"], "localPath": look["image"], "audience": look["audience"],
         "description": look["label"], "sourceSheet": f"assets/generated/sheets/{look['sheet']}.png",
         "tile": look["tile"], "generated": True, "manuallyReviewed": True}
        for look in looks
    ],
}
(ROOT / "assets/generated-photo-sources.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(f"Imported {len(looks)} generated outfit photos from {len(SHEETS)} sheets")
