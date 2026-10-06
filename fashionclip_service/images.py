"""Bounded image input with DNS-pinned HTTPS (no redirects or proxy support)."""
import http.client
import io
import ipaddress
import json
import socket
import ssl
import time
import warnings
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageOps

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def checked_target(url, allowed_hosts, resolver=socket.getaddrinfo):
    if not isinstance(url, str) or len(url) > 2048 or any(ord(c) <= 32 for c in url):
        raise ValueError("Invalid image URL")
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.username is not None or parsed.password is not None
            or parsed.fragment or parsed.port not in (None, 443) or not parsed.hostname
            or parsed.hostname.lower() not in allowed_hosts):
        raise ValueError("Image host must be explicitly allowed HTTPS, port 443")
    addresses = {entry[4][0] for entry in resolver(parsed.hostname, 443, type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
        raise ValueError("Non-public image address is forbidden")
    return parsed, sorted(addresses)[0]


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, hostname, address):
        super().__init__(hostname, 443, timeout=10, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        # Connect to the validated numeric IP, retaining the original hostname for
        # TLS certificate validation and SNI. DNS is not queried again on connect.
        sock = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise


def remote_bytes(url, allowed_hosts):
    parsed, address = checked_target(url, allowed_hosts)
    connection = PinnedHTTPSConnection(parsed.hostname, address)
    started = time.monotonic()
    try:
        target = parsed.path or "/"
        if parsed.query:
            target += "?" + parsed.query
        connection.request("GET", target, headers={"Accept": "image/jpeg,image/png,image/webp",
                                                    "Accept-Encoding": "identity"})
        response = connection.getresponse()
        # In particular, never follow a redirect into an internal network.
        if response.status != 200:
            raise ValueError("Image download failed; redirects are not allowed")
        if response.getheader("Content-Encoding", "identity") != "identity":
            raise ValueError("Compressed HTTP bodies are not allowed")
        if response.getheader("Content-Type", "").split(";")[0].lower() not in {
                "image/jpeg", "image/png", "image/webp"}:
            raise ValueError("Unsupported image content type")
        length = response.getheader("Content-Length")
        if length and (int(length) < 1 or int(length) > MAX_BYTES):
            raise ValueError("Image is too large")
        output = bytearray()
        while True:
            remaining = 30 - (time.monotonic() - started)
            if remaining <= 0:
                raise ValueError("Image download deadline exceeded")
            if connection.sock:
                connection.sock.settimeout(min(10, remaining))
            chunk = response.read1(min(65536, MAX_BYTES + 1 - len(output)))
            if not chunk:
                break
            output.extend(chunk)
            if len(output) > MAX_BYTES:
                raise ValueError("Image is too large")
        return bytes(output)
    finally:
        connection.close()


def local_bytes(item_id, root):
    manifest = json.loads((root / "assets/photo-sources.json").read_text(encoding="utf-8"))
    item = next((entry for entry in manifest["items"] if entry["id"] == item_id), None)
    if item is None:
        raise ValueError("Unknown registered itemId")
    file = (root / item["localPath"]).resolve()
    if not file.is_relative_to((root / "assets/outfits").resolve()) or not file.is_file():
        raise ValueError("Registered image path is invalid")
    if file.stat().st_size > MAX_BYTES:
        raise ValueError("Image is too large")
    with file.open("rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("Image is too large")
    return data


def decoded_image(data):
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Invalid image size")
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > MAX_PIXELS:
                raise ValueError("Unsupported or oversized image")
            image.load()
            return ImageOps.exif_transpose(image).convert("RGB")
