# 第1段階・実動作確認の手順と現在の状態

更新：以下の「現在の状態」は依存導入前の記録です。その後、Python 3.12.14／torch 2.10.0+cpu／transformers 4.57.3／Pillow 12.0.0で実推論・512次元・画像hash・キャッシュを確認しました。**FashionCLIP実推論：成功／Supabase実保存：未完了（ユーザーの指示で後回し）**。第2段階はSupabase不要のローカル実装として許可され、完了しています。最新手順は [FASHIONCLIP_STAGE2.md](FASHIONCLIP_STAGE2.md) にあります。

## 現在の状態（2026-10-06）

- **FashionCLIP実推論：未完了**。このPCに既存のPython 3.12.14＋pipを見つけ、`.venv-fashionclip`を作成した。既存`.python`は変更していない。CPU版torchとtransformersのpip導入を試したが、取得時に`WinError 10013`（ソケット接続拒否）が発生。専用環境のtorch／transformers／Pillowは未導入で、モデル重みも未取得。実embeddingはまだ返っていない。
- **Supabase実保存：未完了**。実プロジェクトの接続情報が未設定。SQL適用・出典登録・実embedding保存・実スワイプ保存は行っていない。
- `.env`を新規作成し、FashionCLIP用のランダムな実トークンを生成済み。Supabase欄は空白のまま。キーはログ・チャットに表示していない。`.env`と専用仮想環境はGit除外済み。
- 有料AI API・新しい有料サービスの導入、購入・契約、セキュリティ設定の変更は行っていない。第2段階の機能には進んでいない。
- 実起動も試したが、専用環境の`PIL`未導入で起動失敗。実`POST /embed`確認スクリプトは`NOT verified: fetch failed`で終了した。これを成功とは判定していない。回帰／単体テストはNode58件、既存色分析環境でのPython12件が成功しているが、実推論・実DB保存の代わりにはならない。

## 1. このPCで依存を導入する

エージェントの実行環境では外部接続が拒否されているため、ユーザー自身の通常のPowerShellで次を実行する。Firewallやセキュリティソフトは無効にしない。通常のターミナルでも接続できなければ、環境管理者へ許可された通信経路を確認する。

```powershell
cd C:\Users\shota\konomi

# 既に作成済みの専用環境に、公式配布のCPU版を導入
.\.venv-fashionclip\Scripts\python.exe -m pip install --only-binary=:all: --retries 0 --timeout 20 --index-url https://download.pytorch.org/whl/cpu torch==2.10.0

# 固定した残りの直接依存と、必須の間接依存をPyPIから導入
.\.venv-fashionclip\Scripts\python.exe -m pip install --only-binary=:all: --retries 0 --timeout 20 --index-url https://pypi.org/simple transformers==4.57.3 Pillow==12.0.0

# 実際にimportできることを確認
.\.venv-fashionclip\Scripts\python.exe -c "import torch, transformers, PIL; print(torch.__version__, transformers.__version__, PIL.__version__)"
```

CPU版torchは`2.10.0+cpu`と表示されても正常。CUDAやGPU用追加パッケージは不要。`No matching distribution`に続いて接続拒否が出る場合、ダミーや別の未確認モデルで埋めず、通信失敗として止める。

## 2. FashionCLIPを本当に起動して1枚を入力する

`.env`のFashionCLIP欄は既に設定済み。`FASHIONCLIP_API_TOKEN`をチャットへ貼らない。外部画像ホストは空でよく、既存の実JPEGを`itemId`で入力する。

```powershell
cd C:\Users\shota\konomi
npm.cmd run fashionclip:serve
```

初回はHugging Faceから公式モデルのsafetensors重み（約605MB）を取得する。必要に応じて数分以上かかる。無料公開重みを取得するだけで、Hugging Faceの有料Inference APIは呼ばない。起動完了の`FashionCLIP ready`が出るまで待つ。

別のPowerShell:

```powershell
cd C:\Users\shota\konomi
node --env-file=.env scripts/verify-fashionclip.cjs
```

このスクリプトは実画像`assets/outfits/men-clean-01.jpg`に対応する`{"itemId":"men-clean-01"}`を、Authorization付きの`POST /embed`へ2回送る。512次元・有限値・L2正規化・画像SHA-256・モデルIDを確認し、2回目がcacheで同じベクトルであることを確認する。ベクトル全体や秘密トークンは表示せず、検証成功と実モデルcommitを表示する。モデルを置き換えたり、テストfixtureを使ったりしない。

`REAL FashionCLIP verified`が実際に出た場合だけ、「FashionCLIP実推論：成功」と判断する。サービス起動だけ、契約テスト成功だけ、`/health`だけでは実推論成功としない。

## 3. Supabaseの実値を取得して.envへ設定する

既存の自分のプロジェクトを[Supabase Dashboard](https://supabase.com/dashboard)で開く。こちらから新しいプロジェクトや有料プランは作らない。対象プロジェクトがない場合は、まずユーザー側で利用する環境を決める必要がある。

| 設定先（C:\Users\shota\konomi\.env） | 値の取得場所 | 注意 |
| --- | --- | --- |
| `SUPABASE_URL=` | 対象プロジェクト上部の **Connect** に表示されるProject URL | `https://...supabase.co`等の実API origin。DashboardのURLやpostgres接続文字列ではない |
| `SUPABASE_ANON_KEY=` | **Connect** または **Settings → API Keys** の既存 **Publishable key** | `sb_publishable_...`。既存Legacy anon JWTでもよい。このコードの環境変数名は従来名を維持している |
| `SUPABASE_SERVICE_ROLE_KEY=` | **Settings → API Keys** の既存 **Secret key** | `sb_secret_...`。既存Legacy service_role JWTでもよい。管理バッチ専用。RLSを迂回できるので絶対に公開しない |

`.env`の末尾にある上記3行の`=`右側へ、それぞれ取得した実値を貼り付けて保存する。ファイル全体をチャットへ送らず、Gitへ追加せず、`NEXT_PUBLIC_`等の名前へ変更しない。旧例を再コピーして、生成済みFashionCLIPトークンを空欄に戻さない。

現行Supabaseのpublishable／secretキーにも対応する。secretキーはJWTではないので、管理バッチでは`apikey`ヘッダーにのみ送る。旧service_role JWTには従来通りAuthorizationも使う。利用者の保存は常に本人のAuth JWTを使い、管理キーを使わない。

値を画面に出さず設定有無だけ確認するには:

```powershell
node --env-file=.env -e "console.log({urlReady:!!process.env.SUPABASE_URL,publicKeyReady:!!process.env.SUPABASE_ANON_KEY,adminKeyReady:!!process.env.SUPABASE_SERVICE_ROLE_KEY})"
```

すべてtrueでも、値の正しさやSQL適用・実保存まで証明したことにはならない。

## 4. SQLをユーザー側で適用する手順

1. **対象プロジェクトが正しいことを確認**し、Dashboard左の **SQL Editor** を開く。
2. **New query** を作成する。ローカルの`supabase/inspect-existing.sql`を開き、内容全体を貼って **Run** を押す。これは読み取り専用。
3. 結果に既存の写真／コーデ／履歴テーブルがあるか確認する。`fashion_items`／`swipes`以外の名前でも、既存機能用なら優先して拡張する。既存テーブルがあれば次の新規migrationは実行しない。結果の「テーブル名・列名・RLS構成」だけを共有すれば対応を検討できる。キーや利用者データは不要。
4. 対象が新規DB、または写真／履歴テーブルが本当にないことを確認した場合だけ、別の **New query** へ`supabase/migrations/202610060001_fashionclip_ingestion.sql`の**全体**を貼って **Run** を押す。`begin`から`commit`まで分割せず一度に実行する。新規テーブル、pgvector、RLS、履歴日時triggerが作成される。
5. 既存テーブル検出・pgvectorスキーマ違い等でエラーになったら、その場で止める。エラーチェックを削除したり、既存テーブルをDROPしたりしない。このSQLはトランザクションなので成功しなければ全体適用されない。
6. **Table Editor** で`fashion_items`と`swipes`の存在を確認する。RLSを無効にする必要はない。

`supabase/verify-stage1.sql`は、適用後にSQL Editorで実行する読み取り専用の確認SQL。テーブル・RLS・行数・embedding保存状況を確認できる。

## 5. Supabaseに実際の画像embeddingを保存する

FashionCLIPの実推論成功＋実Supabase設定＋SQL適用が済んでから:

```powershell
cd C:\Users\shota\konomi
# 元画像・出典の確認のみ（通信／DB書込みなし）
node scripts/precompute-fashionclip.cjs --dry-run

# 実FashionCLIPによる事前分析と管理者権限での実保存
npm.cmd run fashionclip:precompute
```

最初に検証した1枚はPythonキャッシュから再利用される。他の写真も実モデルで順番に処理する。処理が途中で失敗した場合、成功済み行を残して停止する。通信／サービス回復後の再実行では同じhash＋モデル版のベクトルを再生成しない。

SQL Editorで`supabase/verify-stage1.sql`を実行し、`with_embedding`が実際に増えたこと、`men-clean-01`に実モデルID／commit版／生成日時／SHA-256／出典とembeddingが存在することを確認する。`--register-only`で行だけ作成しても、実embedding保存成功とは判定しない。

## 6. Supabaseにスワイプを実保存する

1. Supabaseの **Authentication → Users** で、テストに使う登録済みのメール・パスワードアカウントを確認する。既存のOAuth専用アカウントはこのログイン欄には使えない。メール・パスワードのテストユーザーがない場合は、ユーザー自身が **Add user / Create new user** で管理するテスト用アカウントを用意する。パスワードはチャットへ貼らない。
2. Nodeサーバーを.env付きで起動／再起動する。4173で旧サーバーが動いているなら、**そのサーバーを起動したターミナルで**Ctrl+Cを押してから起動する。他のNodeプロセスをまとめて停止しない。

```powershell
cd C:\Users\shota\konomi
node --env-file=.env server.js
```

3. 自分のブラウザで`http://127.0.0.1:4173/`を開く。**このサービスについて → スワイプ履歴のクラウド保存（任意）**からテストアカウントでログインする。`?demo=...`は付けない（デモは送信しない）。
4. 初回診断の実写真で右スワイプ／左スワイプ／保留を回答する。
5. Table Editorの`swipes`を自分のテストユーザーUUIDで絞り、対応する写真IDの`action`が`like`／`dislike`／`skip`として保存されていることを確認する。
6. 一つ戻る操作で取り消し、再回答で同じユーザー・写真の行が増えず最新回答に更新されることを確認する。これは最新回答テーブルであり、全イベントログではない。

RLSの実検証は、**別々の登録済みテストユーザー2名**のUUIDを`supabase/tests/swipes_rls.sql`冒頭の2箇所へ設定して、SQL Editorで全文を一度にRunする。placeholder UUIDのままなら停止する。最後にROLLBACKするためfixtureは残らない。`PASS`が出れば、自分の読み書き／skip／upsert／undo、他人の読み書き禁止の実検証になる。

本物のembedding行の実保存と、本人Auth JWTによるスワイプ行の実保存を確認した後だけ「Supabase実保存：成功」とする。SQL適用だけ・テストfixtureだけ・service-roleでの書込みだけでは本人の履歴保存まで確認したことにならない。

## 設定後に作業を再開するために

こちらへは「依存導入済み」「.env設定済み」「SQL適用済み」とだけ伝えてよい。失敗時は**秘密を除いたエラー**を共有する。APIキー・パスワード・.env全文は送らない。この実行環境の外部通信拒否が継続する場合、こちらからSupabaseへ接続できないため、上記実確認をユーザーの通常ターミナル／ブラウザで行う必要がある。

第2段階には進まない。有料AI APIや新しい有料サービスも導入しない。既存Supabaseプロジェクトの料金・利用枠はユーザー自身の契約で確認する。

参考：[Supabase公式APIキー手順](https://supabase.com/docs/guides/getting-started/api-keys)、[Supabase公式テーブル／SQL Editor](https://supabase.com/docs/guides/database/tables)、[PyTorch公式導入](https://pytorch.org/get-started/locally/)。
