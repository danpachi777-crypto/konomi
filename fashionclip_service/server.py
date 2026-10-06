"""Run: python -m fashionclip_service.server (loopback only)."""
import hmac
import json
import logging
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .engine import DIMENSION, MODEL_ID, FashionCLIP
from .images import local_bytes, remote_bytes

ROOT = Path(__file__).resolve().parents[1]


def make_handler(engine, token, allowed_hosts, root=ROOT):
    busy = threading.BoundedSemaphore(1)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log URLs, credentials, or request bodies.

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def reply(self, status, body):
            payload = json.dumps(body, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.path != "/health":
                return self.reply(404, {"error": "Not found"})
            self.reply(200, {"ready": True, "model": MODEL_ID, "dimension": DIMENSION,
                             "modelVersion": engine.version})

        def do_POST(self):
            if self.path != "/embed":
                return self.reply(404, {"error": "Not found"})
            if not hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + token).encode("utf-8")):
                return self.reply(401, {"error": "Unauthorized"})
            if not busy.acquire(blocking=False):
                return self.reply(429, {"error": "Embedding service is busy; retry later"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if self.headers.get("Transfer-Encoding") or not 0 < length <= 4096:
                    return self.reply(413, {"error": "Invalid request size"})
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    return self.reply(415, {"error": "Use application/json"})
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict) or set(body) not in ({"imageUrl"}, {"itemId"}):
                    raise ValueError("Supply exactly one imageUrl or registered itemId")
                if "itemId" in body:
                    data = local_bytes(body["itemId"], root)
                else:
                    data = remote_bytes(body["imageUrl"], allowed_hosts)
                return self.reply(200, engine.embed(data))
            except (ValueError, TypeError):
                self.reply(400, {"error": "Invalid or forbidden image input"})
            except (OSError, socket.timeout):
                self.reply(502, {"error": "Image could not be read"})
            except Exception:
                logging.exception("FashionCLIP inference failed")
                self.reply(503, {"error": "FashionCLIP inference failed; no embedding generated"})
            finally:
                busy.release()

    return Handler


def main():
    token = os.environ.get("FASHIONCLIP_API_TOKEN", "")
    if len(token) < 32 or not token.isascii():
        raise SystemExit("FASHIONCLIP_API_TOKEN must contain at least 32 ASCII characters")
    hosts = {host.strip().lower() for host in os.environ.get("FASHIONCLIP_ALLOWED_HOSTS", "").split(",") if host.strip()}
    engine = FashionCLIP(revision=os.environ.get("FASHIONCLIP_REVISION", "main"),
                         offline=os.environ.get("FASHIONCLIP_OFFLINE") == "1",
                         device=os.environ.get("FASHIONCLIP_DEVICE", "cpu"),
                         cache_file=os.environ.get("FASHIONCLIP_CACHE_DB", str(ROOT / ".fashionclip/embeddings.sqlite3")))
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("FASHIONCLIP_PORT", "8001"))),
                                make_handler(engine, token, hosts))
    server.daemon_threads = True
    print("FashionCLIP ready on http://127.0.0.1:%s (%s)" % (server.server_port, engine.version), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
