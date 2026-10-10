# 追加コーデ画像の生成記録

2026-10-08に組み込みの `imagegen` で18枚の3×3シートを生成しました。各シートの9コーデを独立した写真にして、合計162枚を `assets/generated/` に保存しています。元シートは `assets/generated/sheets/`、各写真との対応は `assets/generated-photo-sources.json`、服装ラベルと対象方向は `generated-outfits.js` にあります。

共通プロンプトは次の通りです（服装の指定部分をシートごとに変更）。

> Create ONE high-quality photographic contact sheet with EXACTLY 3 columns and 3 rows, nine completely separate evenly sized portrait photos, thin white dividing lines. Each cell is a unique head-to-toe editorial street-style outfit photo of one ordinary adult man or woman in Japan, photographed in natural daylight on an uncluttered Japanese neighborhood street or neutral studio wall. These are accessible contemporary Japanese everyday styles, varied ages 20s through 50s and varied body types, natural candid poses. Full shoes visible, ample margins, no cropped bodies, no text, no logos, no repeated outfits or people. All nine cells have the same 2:3 aspect. Outfits in reading order row by row: [nine specified outfits]. Accurate wearable garments, modest practical styling, photorealistic catalog quality.

各シートの指定は、きれいめ、デイリーカジュアル、ワーク・デニム、モード、スポーティー、ナチュラルな日常着を男女別に9組ずつ変えています。色、羽織り、ボトムの形、靴、季節を入れ替えた詳細な服装は `generated-outfits.js` に日本語ラベルとして記録しています。生成画像の人物と場所は架空です。

2026-10-10には指定の26系統のうち、メンズのトラッド／フレンチカジュアル／ビジネス・オフィスカジュアル／ミリタリー、レディースのトラッド／ガーリー／モード／メンズライク／ミリタリーを追加生成しました。共通条件は上記と同じです。各系統の9着の具体的な指定は `generated-outfits.js` の `styleGroups` にあります。メンズのトラッドのみシートの最後の3枠が空白だったため除外し、この9シートから78枚を採用しました。生成写真は累計240枚です。
