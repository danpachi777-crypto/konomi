param(
  [switch]$Force
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sheetRoot = Join-Path $projectRoot "assets\sheets"
$outputRoot = Join-Path $projectRoot "assets\recommendations"
$sheetPlan = @(
  "recommend-clean-korean.png",
  "recommend-street-y2k-mode.png",
  "recommend-vintage-amekaji.png",
  "recommend-sport-outdoor.png",
  "recommend-natural-color.png"
)

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$index = 1
$created = 0

foreach ($sheetName in $sheetPlan) {
  $sheetPath = Join-Path $sheetRoot $sheetName
  $image = [System.Drawing.Bitmap]::FromFile($sheetPath)

  try {
    for ($cell = 0; $cell -lt 8; $cell++) {
      $row = [int][Math]::Floor($cell / 4)
      $column = $cell % 4
      $left = [int][Math]::Floor($column * $image.Width / 4)
      $right = [int][Math]::Floor(($column + 1) * $image.Width / 4)
      $top = [int][Math]::Floor($row * $image.Height / 2)
      $bottom = [int][Math]::Floor(($row + 1) * $image.Height / 2)
      $destination = Join-Path $outputRoot ("recommend-{0:D2}.png" -f $index)

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

Write-Output "Prepared $($index - 1) recommendation cards; created $created new files in $outputRoot"
