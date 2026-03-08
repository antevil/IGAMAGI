PRAGMA foreign_keys = ON;

-- ----------------------------------------
-- documents
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY,
  filename        TEXT NOT NULL,
  title           TEXT,
  source_sha256   TEXT,
  char_count_src  INTEGER,
  status          TEXT NOT NULL DEFAULT 'NEW',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_status
ON documents(status);

-- ----------------------------------------
-- pages (debug/geometry)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS pages (
  id           INTEGER PRIMARY KEY,
  doc_id       INTEGER NOT NULL,
  page_no      INTEGER NOT NULL,
  width        REAL,
  height       REAL,
  preview_path TEXT,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (doc_id, page_no)
);

CREATE INDEX IF NOT EXISTS idx_pages_doc
ON pages(doc_id);

-- ----------------------------------------
-- blocks (physical blocks)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
  id        INTEGER PRIMARY KEY,
  page_id   INTEGER NOT NULL,
  block_no  INTEGER NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'BODY', -- MVP: BODY only
  bbox_x0   REAL NOT NULL,
  bbox_y0   REAL NOT NULL,
  bbox_x1   REAL NOT NULL,
  bbox_y1   REAL NOT NULL,
  text_raw  TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE (page_id, block_no)
);

CREATE INDEX IF NOT EXISTS idx_blocks_page
ON blocks(page_id);

-- ----------------------------------------
-- sentence_units (logical stream)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS sentence_units (
  id       INTEGER PRIMARY KEY,
  doc_id   INTEGER NOT NULL,
  seq      INTEGER NOT NULL,              -- continuous reading order
  src_text TEXT NOT NULL DEFAULT '',
  dst_text TEXT,
  status   TEXT NOT NULL DEFAULT 'PENDING', -- PENDING/DONE/ERROR
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (doc_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_units_doc_seq
ON sentence_units(doc_id, seq);

CREATE INDEX IF NOT EXISTS idx_units_status
ON sentence_units(doc_id, status);

-- ----------------------------------------
-- sentence_spans (unit -> block mapping)
-- MVP: only block_id mapping is required
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS sentence_spans (
  unit_id  INTEGER NOT NULL,
  span_no  INTEGER NOT NULL,
  block_id INTEGER NOT NULL,
  PRIMARY KEY (unit_id, span_no),
  FOREIGN KEY (unit_id) REFERENCES sentence_units(id) ON DELETE CASCADE,
  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spans_block
ON sentence_spans(block_id);

-- ----------------------------------------
-- illustrations (FIG/TABLE)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS illustrations (
  id                INTEGER PRIMARY KEY,
  doc_id            INTEGER NOT NULL,
  page_id           INTEGER NOT NULL,
  kind              TEXT NOT NULL,          -- FIG / TABLE
  num               INTEGER NOT NULL,       -- 1,2,3...
  bbox_x0           REAL NOT NULL,
  bbox_y0           REAL NOT NULL,
  bbox_x1           REAL NOT NULL,
  bbox_y1           REAL NOT NULL,
  image_path        TEXT,
  caption_src_text  TEXT,
  caption_dst_text  TEXT,
  caption_status    TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE (doc_id, kind, num)
);

CREATE INDEX IF NOT EXISTS idx_illus_doc_kind_num
ON illustrations(doc_id, kind, num);

CREATE INDEX IF NOT EXISTS idx_illus_page
ON illustrations(page_id);

-- ----------------------------------------
-- xref_references (in-text references)
-- unit -> (FIG/TABLE, num)
-- MVP: store only the first number extracted from ranges.
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS xref_references (
  id       INTEGER PRIMARY KEY,
  doc_id   INTEGER NOT NULL,
  unit_id  INTEGER NOT NULL,
  ref_no   INTEGER NOT NULL DEFAULT 1, -- order within the unit
  kind     TEXT NOT NULL,              -- FIG / TABLE
  num      INTEGER NOT NULL,
  raw      TEXT,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES sentence_units(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_xref_refs_unit
ON xref_references(unit_id);

CREATE INDEX IF NOT EXISTS idx_xref_refs_doc_kind_num
ON xref_references(doc_id, kind, num);

-- ----------------------------------------
-- bookmarks (anchor by seq for seamless UI)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
  id          INTEGER PRIMARY KEY,
  doc_id      INTEGER NOT NULL,
  anchor_seq  INTEGER NOT NULL,
  label       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_doc
ON bookmarks(doc_id, created_at);