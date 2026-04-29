-- Cache full SEO snapshot payload (keywords, backlinks, metrics) to avoid
-- hitting Ahrefs on every navigation.
ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS payload JSONB;

-- Cache AI ranking results to avoid re-running 30-90s OpenAI websearch on
-- every navigation.
CREATE TABLE IF NOT EXISTS ai_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rankings_tenant_generated
  ON ai_rankings(tenant_id, generated_at DESC);

ALTER TABLE ai_rankings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_rankings' AND policyname = 'ai_rankings_all'
  ) THEN
    CREATE POLICY "ai_rankings_all" ON ai_rankings FOR ALL USING (true);
  END IF;
END $$;
