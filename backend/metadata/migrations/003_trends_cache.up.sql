-- Trends cache: one row per feed snapshot (small JSON array)
CREATE TABLE IF NOT EXISTS trends_cache (
  key TEXT PRIMARY KEY,
  run_at TIMESTAMP NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trends_cache_run_at ON trends_cache (run_at);

CREATE TRIGGER update_trends_cache_updated_at
BEFORE UPDATE ON trends_cache
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();