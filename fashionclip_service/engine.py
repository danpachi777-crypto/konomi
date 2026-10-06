"""Only real pretrained FashionCLIP output is cached or returned."""
import hashlib
import json
import math
import sqlite3
from contextlib import closing
from pathlib import Path

from .images import decoded_image

MODEL_ID = "patrickjohncyh/fashion-clip"
DIMENSION = 512
PREPROCESS_VERSION = "clipimageprocessor-exif-rgb-l2-v1"


def validate_embedding(values):
    if not isinstance(values, list) or len(values) != DIMENSION or any(
            isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        raise ValueError("Invalid FashionCLIP embedding")
    if not 0.999 <= sum(v * v for v in values) ** 0.5 <= 1.001:
        raise ValueError("Embedding must be L2-normalized")
    return values


class EmbeddingCache:
    def __init__(self, file):
        Path(file).parent.mkdir(parents=True, exist_ok=True)
        self.file = str(file)
        with closing(sqlite3.connect(self.file, isolation_level=None)) as db:
            db.execute("CREATE TABLE IF NOT EXISTS embeddings (image_sha256 TEXT, model_version TEXT, "
                       "embedding TEXT NOT NULL, PRIMARY KEY(image_sha256, model_version))")

    def get(self, digest, version):
        with closing(sqlite3.connect(self.file, isolation_level=None)) as db:
            row = db.execute("SELECT embedding FROM embeddings WHERE image_sha256=? AND model_version=?",
                             (digest, version)).fetchone()
        return validate_embedding(json.loads(row[0])) if row else None

    def put(self, digest, version, values):
        validate_embedding(values)
        with closing(sqlite3.connect(self.file, isolation_level=None)) as db:
            db.execute("INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?)",
                       (digest, version, json.dumps(values, allow_nan=False)))


class FashionCLIP:
    def __init__(self, revision="main", offline=False, device="cpu", cache_file=".fashionclip/embeddings.sqlite3"):
        # Imported and loaded once by server startup, never by a request handler.
        import torch
        from transformers import CLIPImageProcessor, CLIPModel
        self.torch = torch
        self.device = device
        torch.set_num_threads(2)
        self.model = CLIPModel.from_pretrained(MODEL_ID, revision=revision, local_files_only=offline,
                                               trust_remote_code=False, use_safetensors=True).to(device).eval()
        commit = getattr(self.model.config, "_commit_hash", None)
        if not commit:
            raise RuntimeError("Cannot resolve model commit; refusing an unversioned embedding")
        self.processor = CLIPImageProcessor.from_pretrained(MODEL_ID, revision=commit, local_files_only=offline)
        if self.model.config.projection_dim != DIMENSION:
            raise RuntimeError("Unexpected FashionCLIP embedding dimension")
        self.version = MODEL_ID + "@" + commit + ":" + PREPROCESS_VERSION
        self.cache = EmbeddingCache(cache_file)

    def embed(self, data):
        digest = hashlib.sha256(data).hexdigest()
        values = self.cache.get(digest, self.version)
        cached = values is not None
        if values is None:
            with decoded_image(data) as image:
                inputs = self.processor(images=image, return_tensors="pt")
            inputs = {key: value.to(self.device) for key, value in inputs.items()}
            with self.torch.inference_mode():
                output = self.model.get_image_features(**inputs)
                output = output / output.norm(p=2, dim=-1, keepdim=True)
            values = validate_embedding(output[0].float().cpu().tolist())
            self.cache.put(digest, self.version, values)
        return {"embedding": values, "dimension": DIMENSION, "model": MODEL_ID,
                "modelVersion": self.version, "imageSha256": digest, "cached": cached}
