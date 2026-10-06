# 地域の服屋・口コミ検索

通常のブランド提案・コーデ提案はキーなしで動作します。Google Mapsの店舗・口コミを調べる機能は、Google Places API (New) のAPIキーをサーバー側に設定すると動作します。

1. Google CloudでPlaces API (New)を有効化し、課金・利用上限とキーのAPI制限を設定します。
2. ローカルのPowerShellで環境変数を設定し、サーバーを起動します。キーはチャットに貼らず、ブラウザのコードにも入れないでください。

```powershell
$env:GOOGLE_PLACES_API_KEY = '自分のAPIキー'
npm.cmd start
```

サーバー起動時にこの変数が設定されている必要があります。既に起動しているサーバーには後から反映されません。

結果画面の「近くの服屋を口コミから調べる」で検索します。エリアと好みの特徴だけをGoogleへ送信し、ニックネームや年代、診断履歴は送信しません。1回の検索はText Search最大2回、Place Details最大6回です。利用料金はGoogleのプラン・フィールドによります。

取得できる口コミは全口コミではありません。服の特徴の言及を参考として取り出しますが、現在の在庫・品ぞろえ・個人経営かどうかを確定する情報としては扱いません。閉店情報が返った店舗は除外します。Google Mapsの評価・口コミ原文・投稿者・原文へのリンクを表示します。口コミはメモリ内だけで扱い、サービスワーカーや端末の保存領域に保存しません。

現在、キー未設定の場合は明確に「未接続」と表示し、公式の取り扱い情報を参考にした候補を表示します。公式掲載ブランドと診断の相性は、アプリが選んだ服との共通点から推定したものです。

公式資料:

- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Google Placesの表示・出典ポリシー](https://developers.google.com/maps/documentation/places/web-service/policies)
