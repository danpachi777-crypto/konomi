"""Audit remote catalog images for a visible face before diagnosis use.

Download and review observations are resumable under .qa-person-photos.
Run with --apply after inspecting the contact sheets to update the catalog.
"""

import argparse
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import threading

from PIL import Image, ImageOps
import requests


ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / ".qa-person-photos"
IMAGES = QA / "images"
OBSERVATIONS = QA / "face-observations.json"
SOURCES = ("brand-photos",)
_thread = threading.local()
FACE_MODEL = QA / "face_detection_yunet_2023mar.onnx"
FACE_MODEL_URL = ("https://github.com/opencv/opencv_zoo/raw/refs/heads/main/models/"
                  "face_detection_yunet/face_detection_yunet_2023mar.onnx")
# A face printed on the garment fooled the detector during the visual review.
EXCLUDED_IDS = {"9134480bec08dc1e"}


def catalog_photos():
    photos = {}
    for name in SOURCES:
        catalog = json.loads((ROOT / "assets" / f"{name}.json").read_text(encoding="utf-8"))
        for source in catalog["sources"]:
            for photo in source["photos"][:30]:
                photos[photo["image"]] = (name, source["brand"], photo["id"])
    return photos


def image_path(url):
    return IMAGES / (hashlib.sha256(url.encode()).hexdigest() + ".jpg")


def fetch_image(item):
    url, _ = item
    target = image_path(url)
    if target.exists():
        return url, "cached"
    if not hasattr(_thread, "session"):
        _thread.session = requests.Session()
        _thread.session.headers.update({"User-Agent": "Mozilla/5.0"})
    try:
        response = _thread.session.get(url, timeout=12)
        response.raise_for_status()
        if len(response.content) > 8_000_000:
            return url, "too large"
        image = Image.open(io.BytesIO(response.content))
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((640, 640))
        if min(image.size) < 80:
            return url, "too small"
        image.save(target, quality=83)
        return url, "ok"
    except Exception as error:
        return url, str(error)[:120]


def download(photos):
    IMAGES.mkdir(parents=True, exist_ok=True)
    counts = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        for index, (url, status) in enumerate(pool.map(fetch_image, photos.items()), 1):
            counts[status] = counts.get(status, 0) + 1
            if index % 100 == 0:
                print(f"downloaded {index}/{len(photos)}: ok={counts.get('ok', 0) + counts.get('cached', 0)}", flush=True)
    print(f"download complete: ok={counts.get('ok', 0) + counts.get('cached', 0)}, failed={len(photos) - counts.get('ok', 0) - counts.get('cached', 0)}", flush=True)


def classify(photos):
    import cv2

    previous = json.loads(OBSERVATIONS.read_text(encoding="utf-8")) if OBSERVATIONS.exists() else {}
    pending = [(url, meta, image_path(url)) for url, meta in photos.items()
               if url not in previous and image_path(url).exists()]
    if not FACE_MODEL.exists():
        response = requests.get(FACE_MODEL_URL, timeout=30)
        response.raise_for_status()
        FACE_MODEL.write_bytes(response.content)
    model = cv2.FaceDetectorYN.create(model=str(FACE_MODEL), config='', input_size=(320, 320),
                                      score_threshold=.6, nms_threshold=.3, top_k=5000)
    for index, (url, (catalog, brand, photo_id), path) in enumerate(pending, 1):
        image = cv2.imread(str(path))
        if image is None:
            continue
        height, width = image.shape[:2]
        model.setInputSize((width, height))
        faces = model.detect(image)[1]
        previous[url] = {"catalog": catalog, "brand": brand, "id": photo_id,
                         "faces": [{"confidence": round(float(face[-1]), 3),
                                    "area": round(float(face[2] * face[3] / (width * height)), 4)}
                                   for face in faces] if faces is not None else []}
        if index % 200 == 0 or index == len(pending):
            OBSERVATIONS.write_text(json.dumps(previous, ensure_ascii=False), encoding="utf-8")
            print(f"classified {index}/{len(pending)}", flush=True)
    OBSERVATIONS.write_text(json.dumps(previous, ensure_ascii=False), encoding="utf-8")
    print(f"classification complete: {len(previous)} observations", flush=True)


def apply_review():
    observations = json.loads(OBSERVATIONS.read_text(encoding="utf-8"))
    path = ROOT / "assets" / "brand-photos.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    cached = [photo for source in catalog["sources"] for photo in source["photos"][:30]
              if image_path(photo["image"]).exists()]
    missing = [photo["image"] for photo in cached if photo["image"] not in observations]
    if missing:
        raise RuntimeError(f"Face review is incomplete for {len(missing)} cached images")
    count = 0
    for source in catalog["sources"]:
        for index, photo in enumerate(source["photos"]):
            photo.pop("personVerified", None)
            observation = observations.get(photo["image"])
            if index >= 30 or photo["id"] in EXCLUDED_IDS or observation is None or observation["id"] != photo["id"]:
                continue
            if any(face["confidence"] >= .9 and face["area"] >= .002
                   for face in observation["faces"]):
                photo["personVerified"] = True
                count += 1
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"approved {count} verified person photos; repack the compact catalog", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--classify-only", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.apply:
        apply_review()
    else:
        photos = catalog_photos()
    if not args.apply and not args.classify_only:
        download(photos)
    if not args.apply and not args.download_only:
        classify(photos)
