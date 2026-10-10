"""Crop reviewed 3x3 ImageGen style sheets into standalone local photographs."""
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path.home() / '.codex/generated_images/01a1142a-c1bf-73e0-86e6-f9078a58f90e'
SHEETS = {
    'men_trad': 'exec-06ffea8f-1189-425f-bcf3-37ca88f3e975.png',
    'men_french': 'exec-d792002f-7ddb-468e-a507-1e34f3a1f473.png',
    'women_trad': 'exec-ac46afa0-e842-4004-94fc-b311c8221439.png',
    'men_business': 'exec-d8a600d4-fad6-4606-8652-a746c40e0a5f.png',
    'men_military': 'exec-8b1cd9df-ac5b-41dc-ae9a-650cb5669c8e.png',
    'women_girly': 'exec-015925d3-8f05-41fd-8473-4c4d76a6c3d4.png',
    'women_mode': 'exec-cfa64186-d1b0-471e-b3de-95d945c57a93.png',
    'women_menslike': 'exec-721a0b8d-3247-4920-be09-1579ce7de5d5.png',
    'women_military': 'exec-f30354d1-82db-4d40-b519-60f9f21afb6a.png',
}
OUT = ROOT / 'assets/generated'
SHEET_DIR = OUT / 'sheets'
SHEET_DIR.mkdir(parents=True, exist_ok=True)
for style, filename in SHEETS.items():
    source = SOURCE / filename
    target = SHEET_DIR / f'{style}.png'
    if not target.exists():
        shutil.copy2(source, target)
    with Image.open(target) as image:
        width, height = image.size
        assert (width, height) == (1024, 1536), (style, image.size)
        for i in range(6 if style == 'men_trad' else 9):
            x0, y0 = round(i % 3 * width / 3), round(i // 3 * height / 3)
            x1, y1 = round((i % 3 + 1) * width / 3), round((i // 3 + 1) * height / 3)
            image.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3)).convert('RGB').save(
                OUT / f'{style}-{i + 1:02d}.jpg', quality=88, optimize=True)
manifest_path = ROOT / 'assets/generated-photo-sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
import subprocess
looks = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./generated-outfits.js')))"] , cwd=ROOT))
existing = {item['id'] for item in manifest['items']}
for look in looks:
    if look['id'] in existing or look.get('sheet') not in SHEETS:
        continue
    manifest['items'].append({'id': look['id'], 'localPath': look['image'], 'audience': look['audience'],
        'styleId': look['styleId'], 'description': look['label'],
        'sourceSheet': f"assets/generated/sheets/{look['sheet']}.png", 'tile': look['tile'],
        'generated': True, 'manuallyReviewed': True})
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {sum(6 if style == 'men_trad' else 9 for style in SHEETS)} style photographs')
