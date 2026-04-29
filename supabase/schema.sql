CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  owner_email TEXT NOT NULL,
  ahrefs_target TEXT,
  sitemap_url TEXT,
  brand_voice TEXT,
  google_sheet_id TEXT,
  google_docs_folder_id TEXT,
  slack_channel_id TEXT,
  competitor_domains TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  refresh_in_flight BOOLEAN NOT NULL DEFAULT FALSE,
  last_refreshed_at TIMESTAMPTZ,
  initial_refresh_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  needs_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seo_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  domain_rating NUMERIC(5,2),
  organic_keywords INTEGER,
  backlinks INTEGER,
  est_monthly_traffic INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_rating NUMERIC(5,2),
  traffic INTEGER,
  backlinks INTEGER,
  last_fetched TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'blog', 'shoppable', 'listicle', 'faq_guide', 'llm',
    'collection_refresh', 'location_page', 'landing_page',
    'knowledge_center', 'service_page', 'blog_refresh'
  )),
  primary_keyword TEXT,
  status TEXT DEFAULT 'generated' CHECK (status IN (
    'generated', 'reviewing', 'published', 'failed'
  )),
  google_doc_url TEXT,
  live_url TEXT,
  generated_content TEXT,
  keyword_difficulty INTEGER,
  keyword_volume INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guardrail_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_type, field_name)
);

CREATE TABLE guardrail_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT DEFAULT 'client' CHECK (source IN ('bot', 'client')),
  needs_review BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, content_type, field_name)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('generate_campaign', 'revise_draft', 'update_guardrail')),
  campaign_id UUID REFERENCES campaigns(id),
  action_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER guardrail_values_updated_at
  BEFORE UPDATE ON guardrail_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (auth enforced in app code, service role bypasses RLS)
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_all" ON tenants FOR ALL USING (true);
CREATE POLICY "users_all" ON users FOR ALL USING (true);
CREATE POLICY "seo_metrics_all" ON seo_metrics FOR ALL USING (true);
CREATE POLICY "competitors_all" ON competitors FOR ALL USING (true);
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true);
CREATE POLICY "guardrail_templates_all" ON guardrail_templates FOR ALL USING (true);
CREATE POLICY "guardrail_values_all" ON guardrail_values FOR ALL USING (true);
CREATE POLICY "chat_messages_all" ON chat_messages FOR ALL USING (true);

-- ============================================================
-- HELPERS
-- ============================================================

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_chat_messages_tenant_created ON chat_messages(tenant_id, created_at);
CREATE INDEX idx_seo_metrics_tenant_date ON seo_metrics(tenant_id, snapshot_date);
CREATE INDEX idx_campaigns_tenant_status ON campaigns(tenant_id, status);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO guardrail_templates (content_type, field_name, template_content) VALUES
('blog', 'structure', E'## Key Takeaways\n\n- **[Lead Phrase 1]**: [single explanation sentence].\n- **[Lead Phrase 2]**: [single explanation sentence].\n- **[Lead Phrase 3]**: [single explanation sentence].\n\n(EXACTLY 3 bullets. Each bullet MUST be: bold lead phrase, then colon, then one explanation sentence. Do not omit the bold or the colon.)\n\n## [H1 Topic — full title containing the primary keyword]\n\n[Paragraph 1 — Topical intro: define / describe the keyword topic, set context for the reader.]\n\n[Paragraph 2 — Brand intro: introduce the store and our offering as the trusted solution. Establish brand authority here.]\n\n[Paragraph 3 — Article preview starting with "In this blog, we''ll examine..." describing what sections follow.]\n\n(Opening section under Key Takeaways MUST be EXACTLY 3 paragraphs in this order — no more, no less)\n\n## [Major Section]\n\n[Bridge intro sentence (e.g. "Before X, understanding Y...") then content...]\n\n### [Subsection]\n\n[Content...]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n[Repeat pattern: bridge sentence + 3-6 H3 subsections]\n\n## Frequently Asked Questions About [primary keyword]\n\n### [Question 1]\n\n[Answer]\n\n### [Question 2]\n\n[Answer]\n\n### [Question 3]\n\n[Answer]\n\n### [Question 4]\n\n[Answer]\n\n### [Question 5]\n\n[Answer]\n\n(EXACTLY 5 FAQ items, heading must be "Frequently Asked Questions About {primary keyword}")'),
('blog', 'metadata', E'Title: [SEO-shaped title containing the primary keyword, <=60 chars]\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [SEO title that contains the primary keyword, <=60 chars]\nMeta Description: [<=160 chars, includes primary keyword]\nContent Intent: [middle-of-funnel, informational/commercial]\nTarget Keyword: [primary keyword]'),
('shoppable', 'structure', E'## [H1 Topic]\n\n[Opening paragraph - pain point focused, bottom of funnel]\n\n(NO "Key Takeaways" section — shoppables go straight from intro to product/feature content)\n\n## [Major Section]\n\n[Content with embedded product mentions]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n## Frequently Asked Questions About [primary keyword]\n\n### [Question 1]\n\n[Answer]\n\n### [Question 2]\n\n[Answer]\n\n### [Question 3]\n\n[Answer]\n\n### [Question 4]\n\n[Answer]\n\n### [Question 5]\n\n[Answer]\n\n(EXACTLY 5 FAQ items, heading must be "Frequently Asked Questions About {primary keyword}")'),
('shoppable', 'metadata', E'Title: [primary keyword verbatim, <=60 chars]  -- title MUST equal the primary keyword\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [primary keyword, <=60 chars]  -- mirrors the keyword; brand suffix optional\nMeta Description: [<=160 chars, includes primary keyword]\nContent Intent: [bottom-of-funnel, commercial]\nTarget Keyword: [primary keyword]');

INSERT INTO users (email, password_hash, role, tenant_id)
VALUES ('kimg@qckbot.com', '$2b$12$4QzCe111Lg7bk7iCe7czp.QGy9FS.xfuv0nUEoY1HIXtq/CY9dwye', 'admin', NULL);
