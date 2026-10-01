param(
  [switch]$Force
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sheetRoot = Join-Path $projectRoot "assets\sheets"
$outputRoot = Join-Path $projectRoot "assets\outfits"
$sheetPlan = @(
  @{ Name = "minimal-classic.png"; Count = 8 },
  @{ Name = "street-sport.png"; Count = 8 },
  @{ Name = "natural-vintage.png"; Count = 8 },
  @{ Name = "color-mode.png"; Count = 6 },
  @{ Name = "korean-cityboy.png"; Count = 8 },
  @{ Name = "y2k-amekaji.png"; Count = 8 },
  @{ Name = "sport-outdoor.png"; Count = 8 }
)

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$index = 1
$created = 0

foreach ($sheet in $sheetPlan) {
  $sheetPath = Join-Path $sheetRoot $sheet.Name
  $image = [System.Drawing.Bitmap]::FromFile($sheetPath)

  try {
    for ($cell = 0; $cell -lt $sheet.Count; $cell++) {
      $row = [int][Math]::Floor($cell / 4)
      $column = $cell % 4
      $left = [int][Math]::Floor($column * $image.Width / 4)
      $right = [int][Math]::Floor(($column + 1) * $image.Width / 4)
      $top = [int][Math]::Floor($row * $image.Height / 2)
      $bottom = [int][Math]::Floor(($row + 1) * $image.Height / 2)
      $destination = Join-Path $outputRoot ("look-{0:D2}.png" -f $index)

      if ($Force -or -not (Test-Path -LiteralPath $destination)) {
        $rect = New-Object System.Drawing.Rectangle($left, $top, ($right - $left), ($bottom - $top))
        $crop = $image.Clone($rect, $image.PixelFormat)
        try {
          $crop.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
          $created++
        }
        finally {
          $crop.Dispose()
        }
      }

      $index++
    }
  }
  finally {
    $image.Dispose()
  }
}

Write-Output "Prepared $($index - 1) outfit cards; created $created new files in $outputRoot"
