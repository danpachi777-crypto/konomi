"""Security/cache tests use isolated test fixtures, NOT real model verification."""
import http.client
import io
import json
import tempfile
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer

from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fashionclip_service.engine import EmbeddingCache, validate_embedding
from fashionclip_service.images import checked_target, decoded_image, local_bytes, remote_bytes
from fashionclip_service.server import make_handler


def dns(ip):
    return lambda *args, **kwargs: [(2, 1, 6, '', (ip, 443))]


class ImageSecurityTests(unittest.TestCase):
    def test_only_exact_https_allowed_hosts(self):
        for url in ['http://images.example.com/x', 'https://images.example.com.evil/x',
                    'https://user:pass@images.example.com/x', 'file:///etc/passwd',
                    'https://images.example.com:444/x', 'https://images.example.com/x#fragment',
                    'https://127.0.0.1/x', 'https://images.example.com/x\r\nHost: evil']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                checked_target(url, {'images.example.com'}, dns('8.8.8.8'))
        parsed, ip = checked_target('https://images.example.com/x?q=1', {'images.example.com'}, dns('8.8.8.8'))
        self.assertEqual(ip, '8.8.8.8')
        self.assertEqual(parsed.hostname, 'images.example.com')

    def test_internal_metadata_ipv6_and_mixed_dns_rejected(self):
        for ip in ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1']:
            with self.subTest(ip=ip), self.assertRaises(ValueError):
                checked_target('https://images.example.com/x', {'images.example.com'}, dns(ip))
        mixed = lambda *args, **kwargs: dns('8.8.8.8')() + dns('10.0.0.1')()
        with self.assertRaises(ValueError):
            checked_target('https://images.example.com/x', {'images.example.com'}, mixed)

    def test_local_paths_must_be_registered_and_inside_outfits(self):
        root = Path(__file__).resolve().parents[1]
        with self.assertRaises(ValueError):
            local_bytes('../../server.js', root)
        self.assertTrue(local_bytes('men-clean-01', root).startswith(b'\xff\xd8'))

    def test_decode_rejects_non_images(self):
        with self.assertRaises(Exception):
            decoded_image(b'<html>not an image</html>')
        data = io.BytesIO()
        Image.new('RGB', (8, 8), 'white').save(data, format='PNG')
        with decoded_image(data.getvalue()) as image:
            self.assertEqual(image.mode, 'RGB')

    def test_redirects_are_not_followed(self):
        class Response:
            status = 302
        class Connection:
            calls = 0
            def __init__(self, *args): pass
            def request(self, *args, **kwargs): self.calls += 1
            def getresponse(self): return Response()
            def close(self): pass
        with patch('fashionclip_service.images.checked_target', return_value=(__import__('urllib.parse', fromlist=['urlsplit']).urlsplit('https://images.example.com/x'), '8.8.8.8')):
            with patch('fashionclip_service.images.PinnedHTTPSConnection', Connection):
                with self.assertRaises(ValueError): remote_bytes('https://images.example.com/x', {'images.example.com'})


class CacheTests(unittest.TestCase):
    def test_hash_and_model_version_isolate_cache(self):
        # Normalized synthetic unit fixture; never a production embedding.
        fixture = [1.0] + [0.0] * 511
        with tempfile.TemporaryDirectory() as directory:
            cache = EmbeddingCache(Path(directory) / 'test.sqlite3')
            self.assertIsNone(cache.get('hash-a', 'model-a'))
            cache.put('hash-a', 'model-a', fixture)
            self.assertEqual(cache.get('hash-a', 'model-a'), fixture)
            self.assertIsNone(cache.get('hash-b', 'model-a'))
            self.assertIsNone(cache.get('hash-a', 'model-b'))

    def test_invalid_vectors_never_saved(self):
        for values in [[], [0.0] * 512, [float('nan')] * 512, [True] * 512]:
            with self.assertRaises(ValueError): validate_embedding(values)


class ServiceContractTests(unittest.TestCase):
    def setUp(self):
        class NoInferenceEngine:
            version = 'test-contract-only-no-inference'
            def embed(self, _):
                raise RuntimeError('Inference intentionally unavailable in contract test')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(NoInferenceEngine(), 'x' * 32, set()))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def call(self, body, authorized=True):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        headers = {'Content-Type': 'application/json'}
        if authorized: headers['Authorization'] = 'Bearer ' + 'x' * 32
        connection.request('POST', '/embed', json.dumps(body), headers)
        response = connection.getresponse()
        result = (response.status, json.loads(response.read()))
        connection.close()
        return result

    def test_requires_token_and_blocks_unknown_url(self):
        self.assertEqual(self.call({'itemId': 'men-clean-01'}, False)[0], 401)
        self.assertEqual(self.call({'imageUrl': 'http://169.254.169.254/latest/meta-data'})[0], 400)
        self.assertEqual(self.call({'itemId': 'men-clean-01', 'imageUrl': 'https://example.com'})[0], 400)
        self.assertEqual(self.call({'itemId': '../server.js'})[0], 400)

    def test_inference_failure_has_no_success_or_embedding(self):
        with patch('fashionclip_service.server.logging.exception'):
            status, result = self.call({'itemId': 'men-clean-01'})
        self.assertEqual(status, 503)
        self.assertNotIn('embedding', result)


if __name__ == '__main__':
    unittest.main()
