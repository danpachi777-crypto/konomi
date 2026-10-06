# FashionCLIP 第2段階：ローカル好み学習・コーデ推薦

更新：第3段階のSTYLE SCORE・好み分析は [FASHIONCLIP_STAGE3.md](FASHIONCLIP_STAGE3.md) を参照してください。以下は第2段階時点の記録です。第3段階ではskipでスコアが変わらないよう、最近の重みをlike/dislikeだけで数え、過去に評価した写真をskipしても前回評価を保持する仕様へ更新しました。

## 完了した範囲

既存の素のJavaScript／HTML／CSS／Node HTTP／PWAを維持し、FashionCLIP画像embeddingによる好み学習と次のコーデ選択を接続しました。Supabase設定・SQL適用は不要です。既存クラウド認証・保存は変更していません。モデル・画像・認証情報を外部有料AIへ送信する処理はありません。

新しいSTYLE SCORE、スタイル割合、新しい分析画面、AIの自然言語解説は追加していません。既存の診断画面・タグベースの分析・ブランド／商品／店舗機能は削除せず維持しています。今回のFashionCLIP推薦の対象は登録済みコーデ画像で、商品のembedding推薦やブランド・店舗アルゴリズムの変更ではありません。

## 好みベクトル

```
likeMean = Σ(weight × likedEmbedding) / Σ(likeWeight)
dislikeMean = Σ(weight × dislikedEmbedding) / Σ(dislikeWeight)
preference = L2normalize(likeMean − 0.2 × dislikeMean)
```

- 512次元の有限なL2正規化済み実embeddingだけを使用。同じモデルcommit・前処理版のカタログを使用します。
- dislikeがないときは減算項を0とします。likeがないとき・数値的にゼロになったときは好みベクトルを生成せず、多様性選択を続けます。
- 右=like、左の既存`no`=dislike、skip／一部だけ好きの`neutral`=服全体への評価なし。部分回答は従来機能だけに反映します。
- 同じ写真の通常IDと`r-`付きIDを統合し、最新の回答だけを採用。skipへ変更した場合は前のlike／dislikeを取り消します。戻るでは直前の状態へ再計算します。
- 最新の回答順に直近50件=1.0、51〜150件=0.7、それ以前=0.4。skipは平均・分母に入れません（回答順の経過としては数えます）。未回答写真をdislikeと推測しません。
- 旧データに履歴がなく保存されたlikeだけがある場合は古い肯定回答として移行します。画像embeddingが欠けていれば計算から除外してmissing数を記録します。

値は`fashion-preference.js`の`CONFIG`にまとめています。

## 次のコーデ／コールドスタート

- 性別の既存フィルターを維持し、回答済みIDと同一画像hashを候補から除外。表示中・選択済みのバッチも予約し、重複を防ぎます。
- 初回は約20枚。初めは画像群の重心から離れた1枚、その後は既出のどの画像にも近すぎないものを優先する最大最小距離法で多様性を確保します。
- embedding付きlike／dislikeが10件以下なら多様性選択のみ。10〜20件で個別化確率を0→1へ徐々に増やし、20件で通常推薦になります。skipだけでは個別化しません。
- 好みと候補のcosine similarityを計算。相似度順位の上位30%を近い候補、中間40%を少し離れた候補、下位30%を遠い候補とします。近い候補は最高相似度、中間／遠い候補は帯域内で既出との差を重視します。
- 通常推薦の選択割合はnear 70%、middle 20%、far 10%。決定的な重み付きスケジュールで、十分な候補のある100選択では70／20／10になります。コールドスタートとの混合中・少数のバッチ・候補不足時に、この件数比を厳密に保証するものではありません。
- 各スワイプ後に好みを再計算し、未回答のキューだけを更新します。完了済み／表示中の位置と戻る操作を保護します。
- 候補が少なければ別の利用可能な帯域へフォールバック。実embedding付き候補が尽き、未分析の未回答写真があればスコアなしで扱います。全写真が回答済みならラウンドを短縮／終了し、勝手に再表示しません。既存の「過去の写真を比較し直す」を明示的に選んだ場合と診断リセットは例外です。

相似度は服だけの理解・正解の保証ではありません。背景・人物の影響やモデルの偏りは残ります。70／20／10は探索方針であり、ファッションジャンルの割合ではありません。

## 保存の境界

- `.fashionclip/embeddings.sqlite3`：既存Pythonの実推論キャッシュ（画像hash＋モデル版）。
- `.fashionclip/catalog.json`：事前分析した実embedding、画像ID、画像hash、モデル版、出典URL／名前。104枚を今回生成済み。Git除外。既存の出典・権利台帳も維持。FashionCLIPが掲載権・肖像権を保証するわけではありません。
- `konomi-state-v5`：従来のlocalStorage状態・履歴。新しい回答には時刻を付けます。
- `konomi-fashion-preference-v1`：最新回答履歴、512次元好みベクトルまたはnull、モデル版、like／dislike／skip／欠損数、個別化率、更新時刻。
- `createLocalStorageAdapter`／`createController`の保存アダプターと、既存状態の`stateStorage.load/save`を分離。将来のSupabase実装ではこの保存境界を差し替えます。第2段階のクラウド保存・複数端末同期自体は未実装です。

匿名の開発用状態はブラウザの同一オリジン・同一プロファイル内に保存します。共有端末ではユーザー間分離を提供しません。localStorageを消すと好みも消え、ポートを変えると別の保存領域になります。

## 起動・再確認（PowerShell）

プロジェクトルート`C:\Users\shota\konomi`で実行します。依存は今回追加インストールしていません。専用Pythonの既存torch／transformers／Pillowを使用します。

```powershell
npm.cmd run fashionclip:serve
```

モデル起動を待ち、別ターミナルで初回／画像追加時だけ実行します（今回は104枚分完了済み）。

```powershell
npm.cmd run fashionclip:precompute:local
```

これは明示的な管理バッチです。同じhash／モデル版のローカルカタログを再利用し、必要な場合だけ既存`POST /embed`へ送ります。Pythonキャッシュも再利用。途中失敗時は実生成済み分だけを保存し、再実行で続けられます。バッチは1プロセスで実行してください。

```powershell
npm.cmd start
npm.cmd run test:fashionclip:local
npm.cmd test
npm.cmd run test:python
```

サーバーコード変更後はNodeサーバーを再起動してください。4173に旧サーバーがある場合、別ポートでは`$env:PORT='4174'; node --env-file=.env server.js`でも起動できます。カタログがあれば、FashionCLIPサービスを停止してもスワイプ・好み更新・推薦は動作します。

環境変数は第1段階の`.env`の`FASHIONCLIP_BASE_URL`／`FASHIONCLIP_API_TOKEN`等を事前分析時だけ使用。ブラウザやスワイプ処理へトークンを渡しません。Supabase欄は空欄のままで構いません。新しい必須環境変数・SQL・パッケージ・有料サービスはありません。

ブラウザでプロフィール→診断→追加診断と回答してください。開発者コンソールの`konomiFashionDebug()`で件数、ベクトル有無、個別化率、次の候補ID・選択モードを確認できます。debug関数はカタログ読込成功後のみ使用できます。デモ画面は学習・保存しません。カタログなし／不正／写真hash変更時は既存UIへ戻り、ダミーembeddingを生成しません。

## 確認結果

- 登録済み104枚の実JPEGから本物のFashionCLIP embeddingを生成。モデルcommit `7e3ba62ce16b379a1ab479346b66f192e76f51b7`。512次元・有限値・L2正規化・現在の画像hashを検証。
- `verify-fashionclip.cjs`：実`POST /embed`を再確認、2回目のキャッシュ成功。
- `test:fashionclip:local`：30スワイプでlike 16／dislike 8／skip 6、512次元好みベクトル生成、推薦候補・順位変化、重複なし。メンズ52枚を一意に選択し、終了後は再表示なし。成熟した好みで100選択=near70／middle20／far10。検証中の推論呼出し0、Supabase呼出し0。
- Node全66テスト成功、失敗0、skip0。新しい8テストは数式、加重平均、探索割合、多様性、ID統合、保存アダプター、既存UIスワイプ／undo／追加ラウンドの連携を確認。画像ベクトルは実カタログを使用し、生成fixtureは使いません。別環境で実カタログがなければ実画像テストは明示的にskipし、smokeは失敗します。
- Python全12テスト成功（既存色分析＋SSRF／入力／キャッシュ／サービス契約）。以前からある契約テストのfixtureは実推論成功の根拠にしていません。
- 実Node HTTPでFashionCLIP接続停止・Supabase空欄でも、画面と実カタログを配信すること、秘密ファイル拒否、不正Origin拒否を確認。
- UI連携は自動DOMテストで確認。今回Chrome上の目視・実タッチ操作の検証は行っていません。

## 今回のファイル

変更：`app.js`、`index.html`、`server.js`、`sw.js`、`package.json`、`fashionclip_service/requirements.txt`（実導入済み版へ修正）、`tests/cloud-server.test.js`、`FASHIONCLIP_SETUP.md`、`STAGE1_ACTUAL_VERIFICATION.md`。

追加：`fashion-preference.js`、`local-catalog.js`、`scripts/precompute-fashionclip-local.cjs`、`scripts/verify-fashion-preference.cjs`、`tests/fashion-preference.test.js`、本書。生成データ：Git除外の`.fashionclip/catalog.json`と既存SQLiteキャッシュへの実embedding追加。

Supabase変更：なし（設定・SQL適用・実保存を要求せず、実施していません）。インストールパッケージ：なし。有料AI API／新しい有料サービス：使用・導入なし。

未実装：第3段階のSTYLE SCORE、新しい割合／分析画面、AI自然言語解説、商品／ブランド／店舗へのembedding推薦、第2段階のSupabase永続化・複数端末同期、嗜好精度のユーザー調査・背景除去等。ここで停止します。
