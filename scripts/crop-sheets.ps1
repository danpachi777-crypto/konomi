Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sheetRoot = Join-Path $projectRoot "assets\sheets"
$outputRoot = Join-Path $projectRoot "assets\outfits"
$sheets = @(
  "minimal-classic.png",
  "street-sport.png",
  "natural-vintage.png",
  "color-mode.png"
)

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$index = 1

foreach ($sheetName in $sheets) {
  $sheetPath = Join-Path $sheetRoot $sheetName
  $image = [System.Drawing.Bitmap]::FromFile($sheetPath)

  try {
    for ($row = 0; $row -lt 2; $row++) {
      for ($column = 0; $column -lt 4; $column++) {
        $left = [int][Math]::Floor($column * $image.Width / 4)
        $right = [int][Math]::Floor(($column + 1) * $image.Width / 4)
        $top = [int][Math]::Floor($row * $image.Height / 2)
        $bottom = [int][Math]::Floor(($row + 1) * $image.Height / 2)
        $rect = New-Object System.Drawing.Rectangle($left, $top, ($right - $left), ($bottom - $top))
        $crop = $image.Clone($rect, $image.PixelFormat)
        $fileName = "look-{0:D2}.png" -f $index
        $destination = Join-Path $outputRoot $fileName

        try {
          $crop.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
          $crop.Dispose()
        }

        $index++
      }
    }
  }
  finally {
    $image.Dispose()
  }
}

Write-Output "Created $($index - 1) outfit cards in $outputRoot"
