-- SERP rank tracker. Tenants add keywords; each check stores tenant-domain
-- position from a websearch run.
CREATE TABLE IF NOT EXISTS serp_tracked_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_serp_keywords_tenant
  ON serp_tracked_keywords(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS serp_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword_id UUID NOT NULL REFERENCES serp_tracked_keywords(id) ON DELETE CASCADE,
  position INTEGER,
  top_url TEXT,
  results JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serp_checks_keyword_checked
  ON serp_checks(keyword_id, checked_at DESC);

ALTER TABLE serp_tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'serp_tracked_keywords' AND policyname = 'serp_tracked_keywords_all'
  ) THEN
    CREATE POLICY "serp_tracked_keywords_all" ON serp_tracked_keywords FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'serp_checks' AND policyname = 'serp_checks_all'
  ) THEN
    CREATE POLICY "serp_checks_all" ON serp_checks FOR ALL USING (true);
  END IF;
END $$;
