PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  title TEXT,
  authors TEXT,
  pdf_path TEXT NOT NULL,
  tei_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paragraphs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  text_en TEXT NOT NULL,
  text_ja TEXT,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS figures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  page_no INTEGER,
  image_path TEXT,
  caption TEXT,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS references_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_paragraphs_doc_id ON paragraphs(doc_id);
CREATE INDEX IF NOT EXISTS idx_figures_doc_id ON figures(doc_id);
CREATE INDEX IF NOT EXISTS idx_references_doc_id ON references_items(doc_id);