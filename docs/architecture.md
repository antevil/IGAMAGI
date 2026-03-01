# ArsTransferendiTextum / イガマギ 翻訳ソフト - Architecture (MVP)

## 1. Goal
PDF論文を抽出し、原文(EN)と訳文(JA)をシームレスに交互表示する。
本文中の参照文字列（Fig./Table番号）に基づいて、右ペインに図表(IMG)を追従表示する。
デバッグ用途としてページプレビューとbbox参照を維持する。

## 2. Non-Goals (MVP)
- エディタ（訳文の手修正UI）は作らない（コピーしてWord等に貼る運用）
- WebSocket等の重いリアルタイム基盤は使わない（MVPはポーリング）
- Fig 2a 等のサブ図の厳密対応は後回し（MVPは番号優先）

## 3. UI / UX (MVP)
### 3.1 Main Reader
- レイアウト：左 60% テキスト（EN/JA交互）、右 図表ペイン（FIG追従）
- 「現在位置」定義：ビューポート中央線に最も近い文（sentence unit）
- FIG追従更新：中心文の変化をトリガに更新（debounce = 0.3s）
- 右ペイン：直近参照の図を表示＋以降の参照を縦に連続表示（スクロール）

### 3.2 Floating Debug Window
- 現在の unit_id/seq/status
- spans（block_id一覧、跨ぎフラグ）
- block bbox、page_no、page preview
- 翻訳入力(marker付)および分割結果（任意）

### 3.3 Bookmark
- ブックマークはDBに保存（anchor_seq）
- ラベルは自動生成（例："{seq} · {YYYY-MM-DD HH:MM}"）

## 4. Data Model (SQLite)
### 4.1 documents
- id (PK)
- filename
- title (optional)
- source_sha256 (optional)
- status (NEW/EXTRACTED/TRANSLATING/DONE/ERROR)
- created_at

### 4.2 pages (debug/geometry)
- id (PK)
- doc_id (FK -> documents.id)
- page_no
- width, height
- preview_path
- UNIQUE(doc_id, page_no)

### 4.3 blocks (physical text blocks)
- id (PK)
- page_id (FK -> pages.id)
- block_no
- bbox_x0, bbox_y0, bbox_x1, bbox_y1
- text_raw
- kind (MVP: BODY)
- UNIQUE(page_id, block_no)

### 4.4 sentence_units (logical reading/translation stream)
- id (PK)
- doc_id (FK -> documents.id)
- seq (doc内通し番号)
- src_text
- dst_text
- status (PENDING/DONE/ERROR)
- UNIQUE(doc_id, seq)

### 4.5 sentence_spans (unit -> blocks mapping)
- unit_id (FK -> sentence_units.id)
- block_id (FK -> blocks.id)
- span_no (順序)
- PRIMARY KEY(unit_id, span_no)

MVPではchar_start/char_endは持たない（必要になれば追加）。

### 4.6 illustrations (FIG/TABLE assets)
- id (PK)
- doc_id (FK -> documents.id)
- page_id (FK -> pages.id)
- kind (FIG/TABLE)
- num (整数)
- bbox_*
- image_path
- caption_src_text
- caption_dst_text
- caption_status (PENDING/DONE/ERROR)
- UNIQUE(doc_id, kind, num)

### 4.7 references (in-text references)
- id (PK)
- doc_id (FK -> documents.id)
- unit_id (FK -> sentence_units.id)
- kind (FIG/TABLE)
- num (整数)
- raw (元表記)
- ref_no (同一unit内の順序)

MVPは「最初の番号のみ保存」。範囲/列挙は後で拡張。

### 4.8 bookmarks
- id (PK)
- doc_id (FK -> documents.id)
- anchor_seq
- label
- created_at

## 5. Workflow / State
1) Upload -> documents.status=NEW
2) Extract -> pages/blocks/sentence_units/sentence_spans/references を生成
   -> documents.status=EXTRACTED
3) Translate -> sentence_units を seq順に更新（PENDING->DONE）
   -> documents.status=TRANSLATING/DONE
4) View -> 左ペインは sentence_units.seq順で表示
   -> 中央線基準で current_seq を決定し FIG追従

## 6. Module Boundaries
- routes: 入出力のみ（SQL禁止、fitz禁止）
- services: PDF抽出/分割/翻訳/参照抽出/プレビュー生成（Flask依存禁止）
- db: SQLとトランザクションのみ（fitz/DeepL等のドメイン処理禁止）

## 7. Real-time Display (MVP)
- 翻訳はバックグラウンドで進め、クライアントはポーリングで差分更新
- GET /api/doc/<id>/units?after_seq=... で DONE行を取得し差し替える