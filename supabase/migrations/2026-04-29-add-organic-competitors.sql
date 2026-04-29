-- Cache organic-competitor websearch results per tenant.
CREATE TABLE IF NOT EXISTS organic_competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organic_competitors_tenant_generated
  ON organic_competitors(tenant_id, generated_at DESC);

ALTER TABLE organic_competitors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organic_competitors' AND policyname = 'organic_competitors_all'
  ) THEN
    CREATE POLICY "organic_competitors_all" ON organic_competitors FOR ALL USING (true);
  END IF;
END $$;
