PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY,
  filename        TEXT NOT NULL,
  pdf_path        TEXT NOT NULL,
  title           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER NOT NULL,
  page_no INTEGER NOT NULL,
  page_width REAL NOT NULL,
  page_height REAL NOT NULL,
  preview_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (doc_id, page_no)
);

CREATE INDEX IF NOT EXISTS idx_pages_doc_page
ON pages(doc_id, page_no);

CREATE TABLE IF NOT EXISTS lines (
  id              INTEGER PRIMARY KEY,
  doc_id          INTEGER NOT NULL,
  page_no         INTEGER NOT NULL,
  line_no         INTEGER NOT NULL,
  text            TEXT NOT NULL,
  x0              REAL NOT NULL,
  y0              REAL NOT NULL,
  x1              REAL NOT NULL,
  y1              REAL NOT NULL,
  usage_type      TEXT,
  usage_ref_id    INTEGER,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (doc_id, page_no, line_no)
);

CREATE INDEX IF NOT EXISTS idx_lines_doc_page
ON lines(doc_id, page_no, line_no);

CREATE INDEX IF NOT EXISTS idx_lines_usage
ON lines(doc_id, usage_type, usage_ref_id);

CREATE TABLE IF NOT EXISTS paragraphs (
  id              INTEGER PRIMARY KEY,
  doc_id          INTEGER NOT NULL,
  order_index     INTEGER NOT NULL,
  unit_type       TEXT NOT NULL,
  page_no         INTEGER NOT NULL,
  end_page_no     INTEGER NOT NULL,
  start_line_id   INTEGER,
  end_line_id     INTEGER,
  heading_text    TEXT,
  raw_text        TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (start_line_id) REFERENCES lines(id) ON DELETE SET NULL,
  FOREIGN KEY (end_line_id) REFERENCES lines(id) ON DELETE SET NULL,
  UNIQUE (doc_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_paragraphs_doc_order
ON paragraphs(doc_id, order_index);

CREATE TABLE IF NOT EXISTS sentences (
  id              INTEGER PRIMARY KEY,
  paragraph_id    INTEGER NOT NULL,
  sentence_index  INTEGER NOT NULL,
  source_text     TEXT NOT NULL,
  translated_text TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (paragraph_id) REFERENCES paragraphs(id) ON DELETE CASCADE,
  UNIQUE (paragraph_id, sentence_index)
);

CREATE INDEX IF NOT EXISTS idx_sentences_paragraph
ON sentences(paragraph_id, sentence_index);

CREATE TABLE IF NOT EXISTS figures (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER NOT NULL,
    fig_no TEXT NOT NULL,
    page_no INTEGER NOT NULL,
    image_bbox TEXT NOT NULL,
    caption_text TEXT,
    caption_normalized_text TEXT,
    caption_translated_text TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_figures_doc_page
ON figures(doc_id, page_no);

CREATE TABLE IF NOT EXISTS sentence_figure_refs (
  id              INTEGER PRIMARY KEY,
  sentence_id     INTEGER NOT NULL,
  figure_id       INTEGER NOT NULL,
  ref_label       TEXT,
  ref_text        TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE,
  FOREIGN KEY (figure_id) REFERENCES figures(id) ON DELETE CASCADE,
  UNIQUE (sentence_id, figure_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_sentence_figure_refs_sentence
ON sentence_figure_refs(sentence_id, order_index);
