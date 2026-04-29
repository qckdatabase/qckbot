-- Track tenant-wide data refresh state for cron + first-login auto-generation.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS refresh_in_flight BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS initial_refresh_done BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenants.refresh_in_flight IS
  'TRUE while a full data refresh (seo, ranking, competitors, keywords) is running. UI disables refresh buttons while TRUE.';
COMMENT ON COLUMN tenants.last_refreshed_at IS
  'Timestamp of last successful full refresh.';
COMMENT ON COLUMN tenants.initial_refresh_done IS
  'TRUE once the first full refresh has completed for this tenant. First-login auto-generation triggers when FALSE.';

-- Backfill: any tenant with existing data is considered initialized.
UPDATE tenants t
SET initial_refresh_done = TRUE
WHERE EXISTS (SELECT 1 FROM seo_metrics s WHERE s.tenant_id = t.id AND s.payload IS NOT NULL)
   OR EXISTS (SELECT 1 FROM ai_rankings a WHERE a.tenant_id = t.id)
   OR EXISTS (SELECT 1 FROM organic_competitors o WHERE o.tenant_id = t.id)
   OR EXISTS (SELECT 1 FROM store_keywords k WHERE k.tenant_id = t.id);
