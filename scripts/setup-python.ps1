$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root '.python'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$archive = Join-Path $runtime 'python.zip'
if (!(Test-Path (Join-Path $runtime 'python.exe'))) {
  Invoke-WebRequest -UseBasicParsing 'https://www.python.org/ftp/python/3.13.16/python-3.13.16-embed-amd64.zip' -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
}
$pillow = Invoke-RestMethod 'https://pypi.org/pypi/Pillow/12.3.0/json'
$wheel = $pillow.urls | Where-Object { $_.filename -match 'cp313-cp313-win_amd64.whl$' } | Select-Object -First 1
if (!$wheel) { throw 'Pillow wheel not found' }
$wheelPath = Join-Path $runtime 'pillow.zip'
Invoke-WebRequest -UseBasicParsing $wheel.url -OutFile $wheelPath
if ((Get-FileHash -LiteralPath $wheelPath -Algorithm SHA256).Hash.ToLower() -ne $wheel.digests.sha256) { throw 'Pillow checksum mismatch' }
Expand-Archive -LiteralPath $wheelPath -DestinationPath (Join-Path $runtime 'packages') -Force
[System.IO.File]::WriteAllText((Join-Path $runtime 'python313._pth'), "python313.zip`n.`npackages`nimport site`n")
& (Join-Path $runtime 'python.exe') --version
& (Join-Path $runtime 'python.exe') -c "import PIL; print('Pillow', PIL.__version__)"
if ($LASTEXITCODE -ne 0) { throw 'Python setup failed' }
