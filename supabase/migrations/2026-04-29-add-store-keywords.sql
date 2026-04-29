-- Cache store-keyword discovery results per tenant. Lists keywords the
-- target site uses/targets on its own pages, found via websearch.
CREATE TABLE IF NOT EXISTS store_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_keywords_tenant_generated
  ON store_keywords(tenant_id, generated_at DESC);

ALTER TABLE store_keywords ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_keywords' AND policyname = 'store_keywords_all'
  ) THEN
    CREATE POLICY "store_keywords_all" ON store_keywords FOR ALL USING (true);
  END IF;
END $$;
