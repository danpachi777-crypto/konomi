# ブランド写真の取得元

診断の26系統に登録されている94ブランドについて、`brand-directory.js` の公式 URL を最初に確認します。トップページから服の写真を特定できない場合は、ブランド別の商品一覧、公式の個別商品ページ・ルックブック、またはブランドを指定できる取扱サイトを確認します。採用した代替ページは `scripts/build-brand-photo-catalog.cjs` の `alternateSources` に記録しています。

取得結果は `assets/brand-photos.json` に保存します。各ブランドの `sourceUrl` はブランド一覧の公式 URL、`alternateSourceUrl` は最後に写真を採用した代替ページです。複数ページから採用した場合も、各写真の `url` で実際の商品・掲載ページを確認できます。各写真には画像 URL、商品または掲載ページ URL、商品名を残し、ブランドには診断系統 ID への参照を残します。共有ストアではブランド別の一覧を使い、別ブランドの商品を混ぜません。

2026-10-13時点で94ブランドすべてに40枚ずつ、合計3,760枚を登録しています。各ブランドの先頭30枚のうち、人の顔を確認でき、かつ対象を判定できる写真だけを診断に使います。対象が混在した掲載元は`photo-audience.js`で写真ごとの確認がないものを診断から除外します。Uniqlo UとCOSは目視で確認した写真だけに対象ラベルを付けています。続く10枚は診断結果に応じた「好き」タブの候補です。ブランド古着店の[RAGTAG](https://www.ragtag.jp/)から193枚、[Kindal](https://shop.kind.co.jp/)から199枚を`assets/vintage-brand-photos.json` に保存しています。古着写真は初回診断には使わず、「好き」タブでは対象を確認できたKindalのウィメンズ写真だけを表示します。

表示順位は診断で「好き」と答えた系統をもとに決まり、診断で表示済みの写真も除外します。画像自体の色や形を新しいブランド・古着台帳から解析しているわけではありません。診断中のカードにはブランド名と系統名を表示しません。

`scripts/review-diagnosis-people.py`で診断候補の画像を取得し、顔を検出します。必要なPythonパッケージは`requests`、`Pillow`、`opencv-python`です。検出結果と確認用画像は`.qa-person-photos/`に保存されます。誤検出を目視で除いたうえで`--apply`を実行すると、確認済みの写真だけに`personVerified`が付きます。最後に小さい起動用ファイルを再生成します。

```powershell
.\.venv-fashionclip\Scripts\python.exe scripts\review-diagnosis-people.py --download-only
.\.venv-fashionclip\Scripts\python.exe scripts\review-diagnosis-people.py --classify-only
.\.venv-fashionclip\Scripts\python.exe scripts\review-diagnosis-people.py --apply
node scripts\refresh-diagnosis-catalog.cjs
```

起動時は`assets/brand-diagnosis-catalog.json`から人物写真だけを読み、全件の台帳はブランド写真一覧を開いたときに読み込みます。画像URLを更新した場合、新しい写真は確認が終わるまで診断に入りません。

```powershell
node scripts/build-brand-photo-catalog.cjs
```

このコマンドで94件を更新します。通信が途切れた場合は、開始番号と終了番号で範囲を指定できます（開始は0、終了は含みません）。一時的なアクセス失敗で写真を取得できなかった場合は、前回取得できた写真を保持します。

```powershell
node scripts/build-brand-photo-catalog.cjs 0 24
```

枚数が不足するブランドだけを再取得するときは、3番目の数値に閾値を指定します。次の例は40枚未満のブランドだけを更新します。公式ページだけで足りない場合は、登録したブランド別一覧や複数の商品ページから重複しない写真を集めます。

```powershell
node scripts/build-brand-photo-catalog.cjs 0 94 40
```

写真は掲載元の URL から直接表示します。掲載先の更新、アクセス制限、外部画像の埋め込み制限によって表示できなくなる場合があります。商品写真は商品ページへ、ルックブックなどの写真は掲載ページへリンクします。

古着写真は上の2サイトのブランド名と服カテゴリーを掲載データで確認し、商品ごとに画像URLと商品ページURLを記録しています。Kindalのウィメンズ写真は商品データの `Women` タグも確認しています。RAGTAGの商品自体の対象性別は全件確認できていないため、画面の候補から除外しています。取得処理は `scripts/build-vintage-photo-catalog.cjs` と `scripts/build-balanced-vintage-catalog.cjs` に残しています。古着商品は売り切れや掲載終了によって画像URLが変わる場合があります。

掲載元の利用許諾や画像の再表示条件は全件について確認できていません。公開・商用利用の前に権利者から必要な許諾を得るか、利用条件が適合する写真へ差し替える必要があります。
