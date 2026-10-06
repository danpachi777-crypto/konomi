const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readLocalCatalog } = require('../local-catalog.js');

test('実NodeサーバーでAI停止中もUIを配信し、秘密・管理ファイルと不正Originを拒否する', async () => {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), windowsHide: true,
    env: { ...process.env, PORT: String(port), SUPABASE_URL: '', SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '', FASHIONCLIP_BASE_URL: 'http://127.0.0.1:1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited before ready')); });
      child.stdout.on('data', (data) => { if (data.toString().includes('KONOMI is running')) { clearTimeout(timeout); resolve(); } });
    });
    const base = 'http://127.0.0.1:' + port;
    const index = await fetch(base);
    assert.equal(index.status, 200);
    assert.ok((await index.text()).includes('cloud-sync.js'));
    const ai = await (await fetch(base + '/api/fashionclip/status')).json();
    assert.equal(ai.ready, false); assert.equal(ai.configured, true);
    const config = await (await fetch(base + '/api/cloud/config')).json();
    assert.deepEqual(config, { configured: false });
    const catalog = await (await fetch(base + '/api/fashionclip/catalog')).json();
    assert.equal(catalog.available, readLocalCatalog().available);
    assert.equal(catalog.items.length, readLocalCatalog().items.length);
    // This endpoint works from disk with FashionCLIP stopped and Supabase unconfigured.
    assert.equal((await fetch(base + '/api/fashionclip/catalog', { headers: { Origin: 'https://evil.example' } })).status, 403);
    const attempt = await fetch(base + '/api/swipes', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(attempt.status, 403);
    for (const file of ['.env', '.fashionclip/catalog.json', 'local-catalog.js', 'cloud-api.js', 'server.js', 'scripts/precompute-fashionclip.cjs',
      'fashionclip_service/server.py', 'supabase/migrations/202610060001_fashionclip_ingestion.sql']) {
      assert.equal((await fetch(base + '/' + file)).status, 403, file);
    }
  } finally {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
});
