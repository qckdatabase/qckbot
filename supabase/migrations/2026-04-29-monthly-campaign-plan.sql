-- Add scheduled_for to campaigns + 'pending' status for queued-but-not-yet-generated drafts.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_for DATE;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('pending', 'generating', 'generated', 'reviewing', 'published', 'failed'));

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_scheduled
  ON campaigns(tenant_id, scheduled_for);
