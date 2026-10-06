[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$scriptDirectory = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "scripts" }
$projectRoot = Split-Path -Parent $scriptDirectory
$outfitDirectory = Join-Path $projectRoot "assets\outfits"
$retrievedAt = (Get-Date).ToString("yyyy-MM-dd")
$userAgent = "KONOMI/0.2 curated-outfit-import"

# Two complete outfits per category and audience. Every entry was manually
# reviewed from its Pexels source page for visible top/bottom (or one-piece),
# adult presentation, and absence of a prominent brand mark.
$photos = @(
  @{ key="men-clean-01"; audience="men"; category="洗練きれいめ"; pexelsId=29242239; slug="elegant-man-in-stylish-cream-suit-fashion-portrait"; creator="Bruno Casttro"; description="クリーム色のスーツを着た男性の全身スタジオコーデ" },
  @{ key="men-clean-02"; audience="men"; category="洗練きれいめ"; pexelsId=31268615; slug="confident-asian-man-posing-in-studio-portrait"; creator="Duy's House of Photo"; description="ダークカラーの端正な服を着た男性の全身スタジオコーデ" },
  @{ key="women-clean-01"; audience="women"; category="洗練きれいめ"; pexelsId=8423863; slug="studio-shoot-of-a-woman-in-long-sleeve-and-denim-jeans"; creator="Pavel Danilyuk"; description="長袖トップスとデニムを端正に合わせた女性の全身コーデ" },
  @{ key="women-clean-02"; audience="women"; category="洗練きれいめ"; pexelsId=32275955; slug="fashionable-woman-posing-on-urban-street"; creator="Rajat Sahu"; description="ブルーのブレザーとパンツを合わせた女性の全身コーデ" },

  @{ key="men-casual-01"; audience="men"; category="デイリーカジュアル"; pexelsId=31988319; slug="stylish-man-in-denim-outfit-on-city-street"; creator="Fernando Huelgas"; description="デニムを中心にまとめた男性の街着コーデ" },
  @{ key="men-casual-02"; audience="men"; category="デイリーカジュアル"; pexelsId=30133696; slug="casual-portrait-of-man-in-denim-outfit"; creator="Sydney Sang"; description="デニムを重ねた男性のカジュアルコーデ" },
  @{ key="women-casual-01"; audience="women"; category="デイリーカジュアル"; pexelsId=29850538; slug="stylish-young-woman-in-casual-denim-outfit"; creator="Marcus Queiroga Silva"; description="黒トップスとデニムを合わせた女性の全身コーデ" },
  @{ key="women-casual-02"; audience="women"; category="デイリーカジュアル"; pexelsId=6727812; slug="fashionable-young-woman-in-denim-clothing"; creator="sushantphotographyy"; description="デニムのセットアップを着た女性の全身コーデ" },

  @{ key="men-street-01"; audience="men"; category="都会派ストリート"; pexelsId=28758240; slug="casual-fashion-model-in-oversized-t-shirt"; creator="INFECTED Store"; description="オーバーサイズTシャツとショーツを合わせた男性の全身コーデ" },
  @{ key="men-street-02"; audience="men"; category="都会派ストリート"; pexelsId=8505241; slug="a-fashionable-man-in-streetwear-walking-on-the-street"; creator="SALOMON BYUMA"; description="街を歩く男性のレイヤードストリートコーデ" },
  @{ key="women-street-01"; audience="women"; category="都会派ストリート"; pexelsId=30188054; slug="modern-streetwear-fashion-woman-posing-outdoors"; creator="Rajat Sahu"; description="ゆとりあるシルエットでまとめた女性のストリートコーデ" },
  @{ key="women-street-02"; audience="women"; category="都会派ストリート"; pexelsId=35345374; slug="stylish-woman-in-trendy-streetwear-fashion"; creator="Ever Rayan"; description="赤いトップスとルーズデニムを合わせた女性の全身コーデ" },

  @{ key="men-korean-01"; audience="men"; category="ソウル・韓国系"; pexelsId=7164521; slug="thoughtful-young-ethnic-male-millennial-chilling-on-city-street-on-cloudy-day"; creator="Tran Long"; description="ニュートラルカラーを端正にまとめた男性の全身コーデ" },
  @{ key="men-korean-02"; audience="men"; category="ソウル・韓国系"; pexelsId=32414872; slug="modern-streetwear-fashion-on-city-street"; creator="Miff Ibra"; description="白トップスとルーズな淡色パンツを合わせた男性の全身コーデ" },
  @{ key="women-korean-03"; audience="women"; category="ソウル・韓国系"; pexelsId=7691132; slug="stylish-asian-woman-in-elegant-outfit"; creator="Monstera Production"; description="ライトブルーのジャケットを淡色でまとめた女性の全身コーデ" },
  @{ key="women-korean-02"; audience="women"; category="ソウル・韓国系"; pexelsId=2605991; slug="woman-standing-beside-white-wall"; creator="Chu Chup Hinh"; description="ベージュのワントーンでまとめた女性の全身コーデ" },

  @{ key="men-mode-03"; audience="men"; category="エッジ・モード系"; pexelsId=38953444; slug="stylish-young-man-posing-in-streetwear-fashion"; creator="Aj Collins Artistry"; description="ダークトーンを重ねて輪郭を出した男性の全身モードコーデ" },
  @{ key="men-mode-02"; audience="men"; category="エッジ・モード系"; pexelsId=37087019; slug="trendy-young-man-in-stylish-streetwear-outfit"; creator="Aj Collins Artistry"; description="黒のレザーとワイドパンツを合わせた男性のモードコーデ" },
  @{ key="women-mode-01"; audience="women"; category="エッジ・モード系"; pexelsId=13709894; slug="beautiful-woman-on-black-clothes-posing"; creator="Jaycee300s"; description="黒一色で輪郭を強調した女性の全身コーデ" },
  @{ key="women-mode-02"; audience="women"; category="エッジ・モード系"; pexelsId=6856002; slug="stylish-woman-sitting-on-white-background-in-studio"; creator="Karina Karzhavina"; description="黒ジャケットとブーツを合わせた女性のモードコーデ" },

  @{ key="men-vintage-01"; audience="men"; category="古着・ヴィンテージ"; pexelsId=6207172; slug="stylish-man-in-fashionable-leather-vintage-boots-on-shabby-street"; creator="furkanfdemir"; description="キャップとスーツ、革靴を合わせた男性のヴィンテージコーデ" },
  @{ key="men-vintage-02"; audience="men"; category="古着・ヴィンテージ"; pexelsId=6044597; slug="fashionable-man-wearing-stylish-outfit-in-studio"; creator="Skylar Kang"; description="ウェスタン要素を重ねた男性の全身コーデ" },
  @{ key="women-vintage-01"; audience="women"; category="古着・ヴィンテージ"; pexelsId=7080718; slug="faceless-woman-at-vintage-writing-cabinet"; creator="furkanfdemir"; description="レトロな服を重ねた女性の全身コーデ" },
  @{ key="women-vintage-02"; audience="women"; category="古着・ヴィンテージ"; pexelsId=6851820; slug="elegant-young-woman-smiling-while-standing-near-vintage-cabinet-at-home"; creator="Vika Glitter"; description="ブルーのドレスとハットを合わせた女性のレトロコーデ" },

  @{ key="men-amekaji-01"; audience="men"; category="王道アメカジ"; pexelsId=37691100; slug="casual-outdoor-portrait-of-man-in-denim"; creator="Daniel & Hannah Snipes"; description="白Tシャツとデニム、革靴を合わせた男性のアメカジコーデ" },
  @{ key="men-amekaji-02"; audience="men"; category="王道アメカジ"; pexelsId=15637836; slug="man-posing-in-jeans"; creator="joao Guerreiro"; description="デニムジャケットとジーンズを合わせた男性の全身コーデ" },
  @{ key="women-amekaji-01"; audience="women"; category="王道アメカジ"; pexelsId=19359930; slug="a-woman-standing-in-front-of-a-barn"; creator="Neva Szpigel"; description="Tシャツとデニムオーバーオールを合わせた女性コーデ" },
  @{ key="women-amekaji-02"; audience="women"; category="王道アメカジ"; pexelsId=37495269; slug="confident-woman-in-denim-overalls-by-vintage-car"; creator="Mayara Caroline Mombelli"; description="チェックシャツとデニムオーバーオールを合わせた女性コーデ" },

  @{ key="men-cityboy-01"; audience="men"; category="シティーボーイ系"; pexelsId=15104194; slug="man-posing-in-studio"; creator="Bruno Casttro"; description="シャツとニットを重ねた男性のプレッピーコーデ" },
  @{ key="men-cityboy-02"; audience="men"; category="シティーボーイ系"; pexelsId=7164523; slug="stylish-young-asian-male-model-sitting-on-sidewalk-in-city-district"; creator="Tran Long"; description="街になじむシャツとワイドボトムの男性コーデ" },
  @{ key="women-cityboy-01"; audience="women"; category="シティーボーイ系"; pexelsId=982585; slug="woman-wearing-gray-blazer"; creator="Andrea Yurko"; description="グレーのブレザーを軸にした女性の全身コーデ" },
  @{ key="women-cityboy-02"; audience="women"; category="シティーボーイ系"; pexelsId=8989477; slug="a-happy-woman-wearing-a-blazer-indoors"; creator="Alena Darmel"; description="ブレザーとデニム、白スニーカーを合わせた女性コーデ" },

  @{ key="men-sporty-01"; audience="men"; category="アクティブ・スポーティ"; pexelsId=7869677; slug="mature-black-man-in-sporty-outfit-jogging-on-pavement"; creator="Barbara Olsen"; description="暖かなアクティブウェアを着た男性の全身コーデ" },
  @{ key="men-sporty-02"; audience="men"; category="アクティブ・スポーティ"; pexelsId=7869672; slug="man-in-casual-activewear-jogging-on-paved-sidewalk-in-city"; creator="Barbara Olsen"; description="ウインドブレーカーとスウェットパンツの男性コーデ" },
  @{ key="women-sporty-01"; audience="women"; category="アクティブ・スポーティ"; pexelsId=6165111; slug="stylish-woman-wearing-white-clothes"; creator="Ali Pazani"; description="白いフーディーとパンツを合わせた女性のスポーツコーデ" },
  @{ key="women-sporty-02"; audience="women"; category="アクティブ・スポーティ"; pexelsId=7787925; slug="young-woman-in-activewear-near-wall-on-street"; creator="Ivan Babydov"; description="Tシャツとショーツ、スニーカーの女性アクティブコーデ" },

  @{ key="men-outdoor-01"; audience="men"; category="アウトドア・ゴープコア"; pexelsId=9467306; slug="man-in-black-jacket-and-black-pants-walking-on-green-grass-field"; creator="Juliano Ferreira"; description="黒いシェルとパンツ、バックパックの男性アウトドアコーデ" },
  @{ key="men-outdoor-03"; audience="men"; category="アウトドア・ゴープコア"; pexelsId=7009585; slug="man-in-winter-clothing-looking-on-a-map"; creator="Tima Miroshnichenko"; description="グリーンのジャケットとブルーパンツを合わせた男性の全身アウトドアコーデ" },
  @{ key="women-outdoor-01"; audience="women"; category="アウトドア・ゴープコア"; pexelsId=6264435; slug="woman-in-outwear-o-in-forest"; creator="Marina Abrosimova"; description="グリーンのパーカとバックパックの女性アウトドアコーデ" },
  @{ key="women-outdoor-02"; audience="women"; category="アウトドア・ゴープコア"; pexelsId=7009832; slug="person-in-red-jacket-with-packed-bags-looking-through-a-camera"; creator="Tima Miroshnichenko"; description="赤いジャケットとグレーパンツの女性ハイキングコーデ" },

  @{ key="men-y2k-01"; audience="men"; category="Y2Kリバイバル"; pexelsId=30599804; slug="young-man-in-urban-streetwear-by-empty-booth"; creator="Mustapha Damilola"; description="タンクトップとバギーデニムを合わせた男性のY2Kコーデ" },
  @{ key="men-y2k-02"; audience="men"; category="Y2Kリバイバル"; pexelsId=32819862; slug="trendy-urban-fashion-with-a-casual-vibe"; creator="Hakim LEVEL"; description="ビーニーとオーバーサイズパンツの男性Y2Kコーデ" },
  @{ key="women-y2k-01"; audience="women"; category="Y2Kリバイバル"; pexelsId=16652548; slug="young-woman-in-jeans-and-a-crop-top-standing-outside"; creator="Yaritza"; description="クロップドトップとデニムを合わせた女性のY2Kコーデ" },
  @{ key="women-y2k-02"; audience="women"; category="Y2Kリバイバル"; pexelsId=32991735; slug="trendy-y2k-fashion-portrait-outdoors"; creator="Cagri Kanmaz"; description="コンパクトトップとデニムを合わせた女性のY2Kコーデ" },

  @{ key="men-minimal-01"; audience="men"; category="静かなミニマル"; pexelsId=6207074; slug="confident-man-near-bright-red-building"; creator="furkanfdemir"; description="白のワントーンでまとめた男性の全身ミニマルコーデ" },
  @{ key="men-minimal-02"; audience="men"; category="静かなミニマル"; pexelsId=4489338; slug="unrecognizable-man-walking-on-paved-sidewalk"; creator="Mathias Reding"; description="淡色ジャケットとパンツを合わせた男性のミニマルコーデ" },
  @{ key="women-minimal-01"; audience="women"; category="静かなミニマル"; pexelsId=9596573; slug="a-woman-in-white-crop-top"; creator="Joshua Lim"; description="白のワントーンでまとめた女性の全身ミニマルコーデ" },
  @{ key="women-minimal-02"; audience="women"; category="静かなミニマル"; pexelsId=6780039; slug="stylish-woman-sitting-on-cube-in-studio"; creator="Zizi zi"; description="モノトーンのジャンプスーツを着た女性の全身コーデ" },

  @{ key="men-natural-01"; audience="men"; category="自然体ナチュラル"; pexelsId=32825460; slug="stylish-male-model-in-beige-linen-outfit-outdoors"; creator="King Nkosy"; description="ベージュのリネンを重ねた男性のナチュラルコーデ" },
  @{ key="men-natural-02"; audience="men"; category="自然体ナチュラル"; pexelsId=29871564; slug="young-man-standing-outdoors-in-formal-attire"; creator="Daniwura TCI"; description="アースカラーを自然光になじませた男性の全身コーデ" },
  @{ key="women-natural-01"; audience="women"; category="自然体ナチュラル"; pexelsId=16253955; slug="beautiful-brunette-woman-in-black-top-posing-on-field"; creator="DARKMODE CINEMA"; description="黒トップスとベージュのワイドパンツを合わせた女性コーデ" },
  @{ key="women-natural-02"; audience="women"; category="自然体ナチュラル"; pexelsId=7627807; slug="relaxed-young-trendy-woman-in-boho-styled-outfit-standing-in-green-garden"; creator="Faruk Tokluoglu"; description="柔らかな羽織りを重ねた女性のボヘミアンコーデ" }
)

if ($photos.Count -ne 52) { throw "The curated plan must contain exactly 52 outfits." }
if (($photos.pexelsId | Select-Object -Unique).Count -ne 52) { throw "Pexels photo IDs must be unique." }

function Test-CompleteJpeg {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return $bytes.Length -ge 20000 -and
      $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8 -and
      $bytes[$bytes.Length - 2] -eq 0xFF -and $bytes[$bytes.Length - 1] -eq 0xD9
  } catch {
    return $false
  }
}

$items = [System.Collections.Generic.List[object]]::new()
foreach ($photo in $photos) {
  $fileName = "$($photo.key).jpg"
  $relativePath = "assets/outfits/$fileName"
  $destination = Join-Path $outfitDirectory $fileName
  $imageUrl = "https://images.pexels.com/photos/$($photo.pexelsId)/pexels-photo-$($photo.pexelsId).jpeg?auto=compress&cs=tinysrgb&w=1400"
  $sourcePage = "https://www.pexels.com/photo/$($photo.slug)-$($photo.pexelsId)/"

  if (Test-CompleteJpeg -Path $destination) {
    Write-Host "Keeping verified file: $relativePath"
  } else {
    $temporaryPath = "$destination.part"
    Write-Host "Downloading $relativePath"
    & curl.exe -sS -L --fail --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 15 --max-time 120 -A $userAgent -o $temporaryPath $imageUrl
    if ($LASTEXITCODE -ne 0 -or -not (Test-CompleteJpeg -Path $temporaryPath)) {
      throw "Could not download a complete JPEG for $relativePath"
    }
    Move-Item -LiteralPath $temporaryPath -Destination $destination -Force
  }

  $bytes = [System.IO.File]::ReadAllBytes($destination)
  if ($bytes.Length -lt 20000 -or $bytes[0] -ne 0xFF -or $bytes[1] -ne 0xD8 -or $bytes[$bytes.Length - 2] -ne 0xFF -or $bytes[$bytes.Length - 1] -ne 0xD9) {
    throw "Downloaded file is not a complete JPEG: $relativePath"
  }

  $items.Add([ordered]@{
    id = $photo.key
    collection = "diagnosis-and-results"
    localPath = $relativePath
    description = $photo.description
    creator = $photo.creator
    creatorUrl = "https://www.pexels.com/"
    source = "Pexels"
    sourcePage = $sourcePage
    sourceImage = $imageUrl
    pexelsId = $photo.pexelsId
    license = "Pexels License"
    licenseUrl = "https://www.pexels.com/license/"
    termsUrl = "https://www.pexels.com/terms-of-service/"
    retrievedAt = $retrievedAt
    audience = $photo.audience
    category = $photo.category
    outfitVisibility = "full-or-readable-coordination"
    manuallyReviewed = $true
  })
}

$manifest = [ordered]@{
  schemaVersion = 2
  generatedAt = $retrievedAt
  sourcePolicy = [ordered]@{
    provider = "Pexels"
    providerUrl = "https://www.pexels.com/"
    license = "Pexels License"
    licenseUrl = "https://www.pexels.com/license/"
    termsUrl = "https://www.pexels.com/terms-of-service/"
    selectionNotes = "Manually selected real-photo outfit images. Each diagnosis direction has two readable head-to-toe or top-and-bottom looks for each of 13 categories. Accessories-only, textile-only, clothing-rack, distant-subject, child, and prominent-logo images are excluded. Audience labels describe the app's requested shopping direction, not a claim about anyone's gender identity. Depicted people and photographers do not endorse KONOMI."
  }
  items = $items
}

$manifestPath = Join-Path $projectRoot "assets\photo-sources.json"
$manifestJson = $manifest | ConvertTo-Json -Depth 8
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8WithoutBom)

Write-Host "Saved $($items.Count) curated outfit photographs and provenance records."

# Keep the additional collection in the provenance manifest after refreshing the base set.
& node (Join-Path $projectRoot "scripts\import-additional-outfits.cjs")
if ($LASTEXITCODE -ne 0) { throw "Could not restore the additional outfit collection." }
