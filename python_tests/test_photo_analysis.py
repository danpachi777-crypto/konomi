import importlib.util
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location("analyze_photos", Path(__file__).resolve().parents[1] / "scripts/analyze_photos.py")
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


class PhotoAnalysisTests(unittest.TestCase):
    def test_known_colors(self):
        for rgb, name in [((0, 0, 0), "黒"), ((255, 255, 255), "白"),
                          ((30, 50, 220), "青"), ((220, 20, 20), "赤")]:
            self.assertEqual(analysis.color_family(rgb), name)

    def test_background_periphery_is_excluded(self):
        image = Image.new("RGB", (100, 100), "red")
        image.paste((0, 0, 255), (28, 28, 72, 88))
        palette = analysis.analyze_image(image)["palette"]
        self.assertEqual(palette, [{"name": "青", "share": 1.0}])

    def test_shares_total_one_and_source_is_unchanged(self):
        image = Image.new("RGB", (100, 100), "white")
        before = image.tobytes()
        result = analysis.analyze_image(image)
        self.assertAlmostEqual(sum(color["share"] for color in result["palette"]), 1, places=3)
        self.assertEqual(image.tobytes(), before)


if __name__ == "__main__":
    unittest.main()
