# FashionCLIP 第1段階：事前embeddingとスワイプ履歴

この文書の実装範囲は第1段階時点の記録です。現在はFashionCLIPの実推論が成功し、Supabase設定を後回しにして第2段階のローカル好み学習・推薦を実装しました。最新の構成・テスト・起動方法は [FASHIONCLIP_STAGE2.md](FASHIONCLIP_STAGE2.md) を参照してください。Supabase実保存は未完了です。

## 既存構成を確認した結果

このリポジトリはNext.js／TypeScriptではなく、Node.jsのHTTPサーバー、素のJavaScript／HTML／CSS、PWAです。写真は`data.js`と出典台帳`assets/photo-sources.json`で管理し、104枚のローカルJPEGがあります。既存の認証・Supabaseクライアント・DBスキーマ・写真テーブル・履歴テーブルはありませんでした。従来の回答は`konomi-state-v5`のlocalStorageに保存されています。

既存UI、写真、Python/Pillowの中央領域色分析、従来の診断・推薦、localStorageキーを維持しています。今回のFashionCLIP出力は従来の分析・推薦には接続していません。新しい好みベクトル、推薦算法、表示順最適化、STYLE SCORE、分析画面は実装していません。

変更したUIは初回診断の「保留」と、「このサービスについて」内の小さな任意クラウド保存欄のみです。Supabase未設定時はクラウド欄を非表示にします。登録済みSupabase Authユーザーのメール・パスワードログインです。新規登録、匿名アカウント作成、OAuth、認証方式の自動移行は行いません。

## 実装の構成

- Python起動時に`patrickjohncyh/fashion-clip`をTransformersで1回読み込む。`eval()`＋`torch.inference_mode()`を使用し、512次元L2正規化ベクトルを返す。
- `/embed`は事前分析用。スワイプからは一切呼ばない。管理者の明示的なバッチだけが既存104枚を分析する。
- Python SQLiteキャッシュは画像のSHA-256＋モデルの解決済みcommit＋前処理版で一意。DBの保存済み同一hash／モデル版も再利用する。画像やモデル版が変わったときだけ再分析する。
- バッチは現在の出典台帳を使い、`source_url`、`source_name`、撮影者、ライセンス、確認情報を保存する。FashionCLIPは著作権・肖像権・掲載許可を解決しない。台帳の手動確認も権利の完全保証ではない。
- 写真IDを変えず保存する。診断の`men-clean-01`と推薦の`r-men-clean-01`は同じDB項目に正規化する。
- 認証済みユーザーの右スワイプは`like`、左は`dislike`、保留は`skip`。「一部だけ好き」は服全体の評価としては`skip`とし、既存の部分回答は従来のローカル保存を維持する。
- `(user_id, fashion_item_id)`を主キーにして最新回答をupsertする。全操作のイベントログではない。再回答で重複行は増えない。初回の戻るは取り消しDELETE、再比較の戻るは直前回答に戻す。`created_at`は初回、`updated_at`は最終変更。
- ユーザーJWTをSupabase Authで検証し、そのJWTでData APIに保存する。ブラウザ指定の`user_id`は受け付けない。ユーザー操作にservice-roleを使わない。RLSで自分の履歴だけ読み書き／削除できる。
- 未送信履歴はユーザーID別のlocalStorageに保存し、ログイン時・オンライン復帰・「再送信」で再送。セッションはsessionStorageのみ。ログイン前の既存履歴を勝手にアカウントへ送らない。デモは送信しない。
- FashionCLIPが停止してもアプリ／クラウド履歴保存は継続。モデル読込・推論失敗時は成功を返さず、ダミーembeddingも生成しない。

モデルは商品画像寄りの学習をしており、コーデ写真では人物・背景の影響もあります。服の好みへの有効性評価やクロップの検討は、今回の範囲外です。

## パッケージと現環境の状態

Node依存パッケージは追加していません。Supabase REST、HTTP、バッチにはNode標準機能を使います。Python HTTPサービスも標準ライブラリを使用します。

`fashionclip_service/requirements.txt`の直接依存は次の3つです。pipではそれぞれの必須の間接依存も導入されます。

- `torch==2.10.0`
- `transformers==4.57.3`
- `Pillow==12.0.0`（FashionCLIP専用環境。既存の色分析環境は別）

このPCの既存`.python`は色分析用の埋め込みPythonで、構成を変更していません。FashionCLIPは専用`.venv-fashionclip`のPython 3.12.14で実行します。ユーザーによる依存導入後、torch 2.10.0+cpu／transformers 4.57.3／Pillow 12.0.0のimportと、実画像からの推論・キャッシュを確認済みです。追加インストールは不要です。

## 起動・環境変数

初回だけ、通常版Pythonで別の仮想環境を用意します。既存の色分析環境とは分離します。

```powershell
cd C:\Users\shota\konomi
python -m venv .venv-fashionclip
.\.venv-fashionclip\Scripts\python.exe -m pip install -r fashionclip_service/requirements.txt
Copy-Item -LiteralPath .env.example -Destination .env
```

`.env`を編集してください（このファイルはGit除外・HTTP配信拒否です）。パッケージ導入はCPU構成でよく、GPU／CUDAパッケージは必須ではありません。

| 変数 | 用途 |
| --- | --- |
| `FASHIONCLIP_BASE_URL` | Node／バッチから接続する固定サービスorigin。既定例`http://127.0.0.1:8001` |
| `FASHIONCLIP_API_TOKEN` | 必須。32文字以上のランダムASCII秘密。バッチとPythonで共通 |
| `FASHIONCLIP_PORT` | Python待受。既定8001。常に127.0.0.1で待ち受ける |
| `FASHIONCLIP_ALLOWED_HOSTS` | 外部画像URLの完全一致ホストのカンマ区切り。空なら全外部URL拒否。ローカル写真バッチには不要 |
| `FASHIONCLIP_DEVICE` | 既定`cpu`。GPU環境を明示準備した場合のみ`cuda` |
| `FASHIONCLIP_REVISION` | 既定`main`。運用では確認済みcommitを固定推奨。実際に解決したcommitを各embeddingに保存 |
| `FASHIONCLIP_OFFLINE` | 1なら既取得のモデルだけを使う。未取得なら起動失敗する |
| `FASHIONCLIP_PYTHON` | 通常版Python実行ファイル。未指定なら`.venv-fashionclip`、なければPATHのpython |
| `FASHIONCLIP_CACHE_DB` | 任意の秘密キャッシュSQLiteパス。既定`.fashionclip/embeddings.sqlite3` |
| `SUPABASE_URL` | 自分のSupabase origin。未設定なら従来のローカル動作 |
| `SUPABASE_ANON_KEY` | Supabaseのanonまたはpublishableキー。ユーザー操作用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理者バッチのみ。秘密。ブラウザに送らずユーザー履歴保存には使用しない |

秘密生成例（生成した値を`.env`へ記入）:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

起動は2つのターミナルで:

```powershell
# Python: 起動時に一度だけモデルを読み込む。初回は約605MBの重み取得が必要。
npm.cmd run fashionclip:serve

# 別ターミナル: 既存アプリ。従来prestartのPillow色分析を残す。
npm.cmd run analyze:photos
node --env-file=.env server.js
```

`.env`を読むのは上記Nodeコマンドです。Pythonへは起動スクリプトが環境を引き継ぎます。通常の`npm.cmd start`はこれまで通り外部接続未設定でも動作し、FashionCLIPを自動起動／再計算しません。

API:

```text
GET http://127.0.0.1:8001/health
POST http://127.0.0.1:8001/embed
Authorization: Bearer <FASHIONCLIP_API_TOKEN>
Content-Type: application/json

{"itemId":"men-clean-01"}
または（許可済み外部画像ホストのみ）
{"imageUrl":"https://allowed.example/image.jpg"}

200: {"embedding":[512個の実測数値],"dimension":512,"model":"patrickjohncyh/fashion-clip",
      "modelVersion":"モデル@commit:前処理版","imageSha256":"...","cached":false}
```

外部画像はHTTPS443・完全一致ホストのみ。ユーザー名／パスワード入りURLやfragment、内部／予約／loopback／リンクローカルIPを拒否し、DNS結果の接続先IPを固定したまま元ホストでTLS検証します。リダイレクト・プロキシを使わず、10MB／20MP、読み取りtimeout／全体deadline、1件ずつの推論に制限。サービスはloopback＋秘密トークンで管理用に限定し、一般利用者へ直接公開しないでください。別Pythonマシンへ置く場合は自分たちのSSHトンネル等の管理経路を用意してください。公開用ゲートウェイ・TLS・認証基盤の構築は今回は行いません。

## Supabaseに用意した変更（未適用）

接続情報がないため、実際のSupabaseへは何も適用／保存していません。アカウント／課金契約も作成していません。

1. 対象プロジェクトのSQL Editorで`supabase/inspect-existing.sql`を実行し、既存テーブル／列／RLS／pgvectorを確認する。
2. 既存写真／履歴テーブルがあれば優先して拡張する。付属migrationは「新規スキーマ用」であり、既存`fashion_items`／`swipes`があると停止する。別名の既存テーブルがある場合も勝手に適用せず、確認後にSQLとRESTの対応先を調整する。
3. 新規DBであることを確認できた場合のみ`supabase/migrations/202610060001_fashionclip_ingestion.sql`を適用する。pgvectorがextensions以外のスキーマに既存導入されている場合も移動せず停止するため、型参照を確認・調整する。

追加するもの:

- `fashion_items`: 既存カードの文字列ID、画像URL、出典・権利情報、SHA-256、`vector(512)`、モデルID／版／生成日時。一般クライアントは権利確認済み項目を読むだけで、embeddingや出典を変更できない。
- `swipes`: AuthユーザーUUID、写真ID、`like/dislike/skip`、作成／更新日時。複合主キーと各操作の所有者RLS。
- pgvector拡張、同一内容／モデル版を探す通常index、履歴日時のtrigger。近傍検索index・推薦RPCは作らない。

## 写真登録と事前分析

```powershell
# 通信・推論・DB書込みなしで全104枚の出典とファイルを検査
node scripts/precompute-fashionclip.cjs --dry-run

# Supabase設定＋migration適用後。先に出典台帳だけ登録する場合
npm.cmd run fashionclip:precompute -- --register-only

# 実FashionCLIP起動後。実画像を事前分析しSupabaseに保存
npm.cmd run fashionclip:precompute
```

`--register-only`はembeddingを捏造しません。新規／画像変更時はNULLで登録し、同じ画像に既存の実embeddingがあれば保持します。実バッチはモデル停止／出力不正時に失敗します。成功済み行は残るので再実行で続きを処理できます。SQLiteキャッシュと既存DBで重複推論を避けます。バッチは管理者1プロセスで実行してください（複数マシンの同時バッチ用分散ロックは未実装）。

既存画像はローカルなので`image_url`は`assets/outfits/...`の相対パスです。台帳の元画像URLは`rights_metadata.sourceImage`にも残します。本番では既存の配信先に合わせてパスを解決してください。画像のSupabase Storageアップロードや転載先の変更は今回行いません。

## 動作確認

この環境で実行済み:

- `npm.cmd test`: Nodeテスト57件成功（既存回帰、クラウド保存・認証契約、未送信／undo、事前分析契約、実Node HTTPで停止時の継続・管理ファイル拒否）。
- `npm.cmd run test:python`: Pythonテスト12件成功（既存色分析3件＋URL制限、SSRF、画像入力、キャッシュ、推論失敗9件）。
- `node scripts/precompute-fashionclip.cjs --dry-run`: 104枚を確認。外部送信・実推論・DB書込みなし。

テストの一部は明示的なfixtureを使う単体／契約テストです。これは実FashionCLIP推論や実Supabase RLSの成功を意味しません。テスト用のベクトルは一時領域だけで、本番embeddingとして登録していません。

実環境が用意できた後:

```powershell
# 実モデル以外を使わないsmoke test: 実画像512次元／L2正規化／hash／2回目cache確認
node --env-file=.env scripts/verify-fashionclip.cjs
```

1. 実モデルsmoke成功後、事前分析バッチを実行。Supabaseのembedding／モデル版／出典を確認。
2. 2回目のバッチで保存済みembeddingが再利用されることを確認。
3. SQL Editorで`supabase/tests/swipes_rls.sql`のUUIDを「登録済みの別々のテストAuthユーザー2名」に置き換えて実行。自分の読み書き／upsert／skip／undoと、他人の読み書き禁止を確認。最後にROLLBACKするためfixtureは残らない。
4. アプリの「このサービスについて」→クラウド保存で登録済みユーザーにログインし、右／左／保留→Supabaseのactionと主キーを確認。
5. 戻るでDELETE／前の回答復元を確認。ネットワーク停止→未送信表示→復帰・再送を確認。
6. FashionCLIPを停止してもスワイプと画面表示が継続することを確認。`/api/fashionclip/status`はready:falseを返す。

ブラウザの自動操作は保存済みアクセス拒否があるため今回は実行していません。UIの見た目・実ログイン操作は実環境での手動確認が残っています。

## 現時点で未完了／未実装

- 環境不足により、PyTorch／Transformers導入、重み取得、実FashionCLIP推論、104枚の実embedding生成、実SupabaseへのSQL適用・保存・RLS実行検証は未完了。
- 次段階の好みベクトル計算、FashionCLIP推薦、次の服の自動最適化、STYLE SCORE／割合分析／新分析画面は未実装。従来機能は維持したが、FashionCLIPが動くと見せる変更はしていない。
- クラウド履歴を複数端末から従来診断画面へ復元・マージする機能、新規アカウント登録、管理画面、分散バッチロックは未実装。クラウド履歴は`GET /api/swipes`で本人分を取得できる。
- 現Nodeサーバーは従来通りloopback開発用。公開運用のTLS／厳密なAuth rate limiting／セッションのhttpOnly Cookie化等は別途設計が必要。

## 料金・参考資料

OpenAI API／Hugging Face Inference API／有料AI API／有料サービスは導入・契約・利用していません。Hugging Faceから無料公開モデル重みを取得して、自分たちのCPU／GPUで推論する構成です。モデル取得・ローカル計算には通信・ディスク・電力等の自分たちのコストがあり、自分たちでSupabaseクラウドを設定する場合は選んだプラン／利用量次第で料金が発生し得ます。無料を一律保証せず、勝手にプランを作成／変更していません。既存のGoogle Places機能には手を加えていません。

- [FashionCLIP公式モデルカード](https://huggingface.co/patrickjohncyh/fashion-clip)
- [公式モデル構成（projection_dim:512）](https://huggingface.co/patrickjohncyh/fashion-clip/blob/main/config.json)
- [Transformers CLIP](https://huggingface.co/docs/transformers/model_doc/clip)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## この段階で変更したファイル

既存変更: `.gitignore`, `app.js`, `index.html`, `package.json`, `server.js`, `sw.js`, `README.md`, `tests/adaptive-diagnosis.test.js`。

新規: `.env.example`, `FASHIONCLIP_SETUP.md`, `cloud-api.js`, `cloud-sync.js`, `fashionclip_service/__init__.py`, `fashionclip_service/requirements.txt`, `fashionclip_service/images.py`, `fashionclip_service/engine.py`, `fashionclip_service/server.py`, `scripts/run-fashionclip.cjs`, `scripts/precompute-fashionclip.cjs`, `scripts/verify-fashionclip.cjs`, `supabase/inspect-existing.sql`, `supabase/migrations/202610060001_fashionclip_ingestion.sql`, `supabase/tests/swipes_rls.sql`, `python_tests/test_fashionclip_service.py`, `tests/cloud-ingestion.test.js`, `tests/cloud-server.test.js`。
