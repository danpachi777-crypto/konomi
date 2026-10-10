# 日本向け系統の調査と画像制作

対象は既存のメンズ14系統・レディース12系統。各系統200枚超には少なくとも5,226枚の異なる写真が必要。写真はブランド商品や実在スタッフの転載ではなく、公開スタイリングを服の組み合わせの参考にした生成画像として作る。

## 調査した公式スタイリング

- [UNIQLO StyleHint レディース・カジュアル](https://www.uniqlo.com/jp/ja/stylingbook/stylehint/women?hashtag=%E3%82%AB%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%82%B3%E3%83%BC%E3%83%87): 身長、色、日常シーンによる着こなしの幅。カジュアル、ベーシック、大人女子の参考。
- [UNIQLO StyleHint レディース・オフィスカジュアル](https://www.uniqlo.com/jp/ja/stylingbook/stylehint/women?hashtag=%E3%82%AA%E3%83%95%E3%82%A3%E3%82%B9%E3%82%AB%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB): シャツ、カーディガン、スラックスの合わせ方。
- [UNITED ARROWS メンズ・ビジネスカジュアル](https://store.united-arrows.co.jp/ua_columns/yomimono/20134): ジャケットと襟付きトップス、スラックス・チノの組み合わせ。
- [UNITED ARROWS メンズ・ノームコア](https://store.united-arrows.co.jp/ua_columns/yomimono/14359): 無地のTシャツ、シャツ、ニット、スウェットと落ち着いた色。
- [BEAMS メンズ・スタイリング](https://www.beams.co.jp/styling/?sex=M): アメカジ、ミリタリー、ストリートなど実際の国内スタッフコーデの幅。
- [BEAMS 2026春・メンズのワーク／ミリタリー](https://www.beams.co.jp/blog/5915/178851/): フィールドジャケット、カーゴ、レイヤードを日常着に混ぜる例。
- [BEAMS BOY 2026秋冬](https://www.beams.co.jp/special/beamsboy/26aw/): レディースのトラッド、メンズライク、ワーク、ミリタリーを混ぜる例。
- [SNIDEL 公式のガーリーなスタイリング](https://usagi-online.com/usagimagazine/158263/): ニット、カーディガン、チュール、スカート。
- [EMODA 公式スタッフコーデ](https://runway-webstore.com/coordinate/?aid3=rcmenu_coordinate&brand=MK040&pageSize=60): レディースのモード・トレンド感の参考。

## 実装した表示ルール

- 性別を選んだ後、その方向の写真から系統の偏りを抑えて150枚を抽選し、順序をセッション中は固定する。
- 各系統に診断未表示の写真を残す。結果の「あなたが好きな服」はLike/Dislikeから系統を順位付けし、未表示の写真のみを出す。
- 写真の出典と生成元シートは [generated-photo-sources.json](assets/generated-photo-sources.json) に記録。AI生成のモデル・場所は架空であり、ブランドが推薦した商品や実在在庫として扱わない。

## 制作残数

2026-10-10 時点で計392枚。各系統201枚以上の目標5,226枚に対し、追加4,834枚が必要。`npm run audit:styles` で系統ごとの不足枚数を確認できる。量を満たすために同じ写真の複製、リサイズ、色変えを別のコーデとして数えない。
