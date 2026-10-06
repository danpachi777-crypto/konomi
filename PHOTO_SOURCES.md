# 写真素材の管理記録

取得・確認日: 2026-10-06

## 現在の写真

診断と結果に表示する104枚は、Pexelsで公開された実写の服装写真です。メンズ52枚・ウィメンズ52枚で13カテゴリーをカバーし、選択した方向の写真だけを表示します。従来78枚と異なる写真を26枚追加しました。

- 提供元: [Pexels](https://www.pexels.com/)
- ライセンス: [Pexels License](https://www.pexels.com/ja-jp/license/)
- 利用規約: [Pexels Terms of Service](https://www.pexels.com/ja-jp/terms-of-service/)
- 個別の原典・撮影者・取得日・対象方向・カテゴリー: `assets/photo-sources.json`
- ブラウザ用一覧: `credits.html`
- 再取得スクリプト: `scripts/import-curated-outfits.ps1`（初期52枚）、`scripts/import-additional-outfits.cjs`（追加52枚）

出典表示は必須ではありませんが、来歴を追跡できるよう撮影者名と原典ページを写真ごとに保存しています。

## 診断写真の選定基準

各写真を目視し、次の条件を満たすものだけを診断対象にしています。

- トップスとボトムス、またはワンピース全体の組み合わせが判別できる
- 13カテゴリーのどれに分類したかを台帳に記録できる
- メンズ／ウィメンズの診断方向を明示できる
- 靴、小物、布地、服のラックだけを写した写真ではない
- 被写体が極端に遠い、暗い、または大きく隠れていない
- 未成年を題材にしていない
- 目立つブランド名やロゴを主題にしていない

対象方向はアプリの商品・写真フィルター上の区分であり、写っている人物の性自認を断定するものではありません。

## 権利・安全面の扱い

PexelsライセンスはWebサイトやアプリでの利用を認め、投稿者には必要なモデル／プロパティリリースその他の許可を取得・保持することを利用規約で求めています。また、特定可能な人物を攻撃的に扱うこと、人物・ブランドによる推奨を示唆すること、素材を無加工のまま再販売すること等を禁止しています。

ただし、Pexelsは各素材について人物の肖像・プライバシー、商標、意匠、建物等の別個の権利が完全に処理済みであることを一律保証していません。KONOMIでも、写真の人物・撮影者がサービスを推奨または提携しているとは表示しません。商用公開、広告利用、対象地域の拡大前には、各原典の再確認と専門家による法務確認が必要です。

## 実写性について

Pexelsは写真素材サービスであり、今回の104枚は写真ページの説明、撮影情報、画面の目視を基に実写として選定しました。ただし、第三者投稿素材についてAI生成でないことを技術的に100%証明するものではありません。完全な保証が必要な公開用途では、自社撮影または撮影者から原本・撮影情報・リリースを直接取得してください。

## 更新手順

Windows PowerShell 5では日本語を含むスクリプトをUTF-8として読み込んで実行します。正常に取得済みのJPEGは再ダウンロードしません。

```powershell
$source = Get-Content -LiteralPath .\scripts\import-curated-outfits.ps1 -Raw -Encoding utf8
& ([scriptblock]::Create($source))
npm.cmd test
```

## 参照した公式文書

- [Pexels License](https://www.pexels.com/ja-jp/license/)
- [Pexels Terms of Service](https://www.pexels.com/ja-jp/terms-of-service/)
- [Pexels: commercial use](https://help.pexels.com/hc/en-us/articles/360042295214-Can-I-use-the-photos-and-videos-for-a-commercial-project)
