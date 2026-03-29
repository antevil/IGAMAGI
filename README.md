# IGAMAGI Reader rebuild

半手動で論文PDFを読み進めるための Flask アプリです。

## できること

- PDFアップロード
- PyMuPDF による line 抽出
- PDFページプレビュー表示
- line クリック / ドラッグで paragraph を手動指定
- paragraph を保存後、spaCy(sentencizer) で文分割
- DeepL API で文ごとに翻訳
- 左ペインに English / Japanese を交互表示
- figure 本体はドラッグで bbox 指定
- figure caption は line 選択で指定
- setup 上で使用済み line を色分け表示
- 右ペインに figure 画像と caption を表示

## セットアップ

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# または cmd
.\.venv\Scripts\activate.bat

pip install -r requirements.txt
python tools/init_db.py
python app.py

## DeepL を使う場合

環境変数を設定してください。

```bash
set DEEPL_AUTH_KEY=your_key_here
```

PowerShell の場合:

```powershell
$env:DEEPL_AUTH_KEY="your_key_here"
```

## 補足

- spaCy は `spacy.blank("en") + sentencizer` を使っているため、追加モデル不要です。
- 図表参照 `sentence_figure_refs` のUI登録画面はまだ最小です。APIは用意済みです。
- 初期実装なので認証・排他制御・履歴管理は未対応です。
