-- Persist KD/Volume on each campaign at insert time.
-- Snapshot drifts; freezing per-row keeps history accurate.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS keyword_difficulty INTEGER,
  ADD COLUMN IF NOT EXISTS keyword_volume INTEGER;

COMMENT ON COLUMN campaigns.keyword_difficulty IS
  'Ahrefs KD captured at planning time via fuzzy match against latest seo_metrics snapshot. Frozen — does not update when snapshot refreshes.';
COMMENT ON COLUMN campaigns.keyword_volume IS
  'Ahrefs monthly search volume captured at planning time. Frozen.';

-- Backfill existing rows once. For each campaign without metrics, take the
-- latest seo_metrics.payload for the same tenant and try an exact lowercased
-- match on keyword. Fuzzy/Jaccard match stays in app code; SQL only handles
-- exact case-insensitive match here to keep the migration deterministic.
WITH latest_snapshot AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, payload
  FROM seo_metrics
  WHERE payload IS NOT NULL
  ORDER BY tenant_id, snapshot_date DESC
),
keyword_metrics AS (
  SELECT
    ls.tenant_id,
    LOWER(TRIM(kw->>'keyword')) AS keyword_norm,
    NULLIF((kw->>'difficulty')::TEXT, '')::NUMERIC::INTEGER AS difficulty,
    NULLIF((kw->>'volume')::TEXT, '')::NUMERIC::INTEGER AS volume
  FROM latest_snapshot ls
  CROSS JOIN LATERAL jsonb_array_elements(ls.payload->'keywords') kw
)
UPDATE campaigns c
SET
  keyword_difficulty = km.difficulty,
  keyword_volume = km.volume
FROM keyword_metrics km
WHERE c.tenant_id = km.tenant_id
  AND LOWER(TRIM(c.primary_keyword)) = km.keyword_norm
  AND c.keyword_difficulty IS NULL
  AND c.keyword_volume IS NULL
  AND c.primary_keyword IS NOT NULL;
