-- ContentHosting.org D1 Database Schema
-- Run: wrangler d1 execute contenthosting-db --file=schema.sql

-- Files table: stores metadata for all uploaded files
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    upload_date TEXT NOT NULL,
    b2_key TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT
);

-- Index for faster listing (sorted by upload date)
CREATE INDEX IF NOT EXISTS idx_files_upload_date ON files(upload_date DESC);

-- Index for search by filename
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
