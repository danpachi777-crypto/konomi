# 系統別の写真診断

対象は `data.js` の `styleSpecs` にあるメンズ14系統・ウィメンズ12系統です。初回は選択した方向の写真から150枚を抽選し、系統ごとに未表示の写真を確保します。回答と系統IDを使い、結果と「あなたが好きな服」で未表示の写真を優先します。旧来の系統別単写真は `assets/styles/`、追加生成写真は `assets/generated/` に保存しています。

画像生成には組み込みの ImageGen を使用しました。共通プロンプトは次のとおりです。

> Use case: photorealistic-natural. Asset type: fashion diagnosis photo. Full-body vertical editorial street-style photograph of one adult Japanese person wearing [the style-specific outfit below]. Every garment and shoes visible, standing naturally on a quiet Japanese street, soft daylight, realistic fabric texture, outfit clearly central. No text, logos, collage, watermark, other people.

系統ごとの服装指定は `data.js` の `styleSpecs` のラベルに沿って設定しました。追加候補の生成では同じ条件に `Distinct outfit and person from diagnosis photo` を加え、配色とアイテムを変えています。生成写真は実在の商品やブランドを示すものではありません。

追加生成写真の詳細は [GENERATED_IMAGE_PROMPTS.md](GENERATED_IMAGE_PROMPTS.md)、国内スタイリングの調査は [STYLE_RESEARCH.md](STYLE_RESEARCH.md) を参照してください。
