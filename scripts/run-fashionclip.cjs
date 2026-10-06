const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const venv = path.join(root, '.venv-fashionclip', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.FASHIONCLIP_PYTHON || (fs.existsSync(venv) ? venv : 'python');
const child = spawn(python, ['-m', 'fashionclip_service.server'], { cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PYTHONUTF8: '1', HF_HUB_DISABLE_TELEMETRY: '1' } });
child.on('error', () => { console.error('FashionCLIP用の通常版Pythonを用意し、FASHIONCLIP_PYTHONを設定してください。'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
