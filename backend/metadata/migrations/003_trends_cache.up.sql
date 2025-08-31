-- Trends: stores trending content data
CREATE TABLE IF NOT EXISTS trends (
  key TEXT PRIMARY KEY,
  run_at TIMESTAMP NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trends_run_at ON trends (run_at);

CREATE TRIGGER update_trends_updated_at
BEFORE UPDATE ON trends
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();