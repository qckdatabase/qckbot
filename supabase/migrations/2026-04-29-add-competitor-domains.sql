-- Add manually curated competitor list per tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS competitor_domains TEXT[] DEFAULT '{}';

-- Update Tenant type in lib/types.ts after applying.
