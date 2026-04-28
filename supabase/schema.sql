CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  needs_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  status TEXT DEFAULT 'generating' CHECK (status IN (
    'generating', 'generated', 'revising', 'approved', 'posted', 'failed'
  )),
  google_doc_url TEXT,
  live_url TEXT,
  generated_content TEXT,
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
  action_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see all tenants" ON tenants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Clients see own tenant" ON tenants
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "Admins insert tenants" ON tenants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins update tenants" ON tenants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users see own data" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins see all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u2 WHERE u2.id = auth.uid() AND u2.role = 'admin')
  );

CREATE POLICY "Users see own tenant metrics" ON seo_metrics
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "Users see own competitors" ON competitors
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "Users see own campaigns" ON campaigns
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "All read guardrail templates" ON guardrail_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage templates" ON guardrail_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users see own guardrails" ON guardrail_values
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "Users see own messages" ON chat_messages
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

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

INSERT INTO guardrail_templates (content_type, field_name, template_content) VALUES
('blog', 'structure', E'## [H1 Topic]\n\n[Opening paragraph - pain point focused]\n\n## [Major Section]\n\n[Content...]\n\n### [Subsection if needed]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'),
('blog', 'metadata', E'Title: [Title]\nProposed URL: /[slug]\nTitle Tag: [Title]\nMeta Description: [170 char description with keyword]\nContent Intent: [What searcher intent does this serve]\nTarget Keyword: [primary keyword]'),
('shoppable', 'structure', E'## [H1 Topic]\n\n[Opening paragraph - pain point focused, bottom of funnel]\n\n## [Major Section]\n\n[Content with embedded product mentions]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'),
('shoppable', 'metadata', E'Title: [Title]\nProposed URL: /[slug]\nTitle Tag: [Title]\nMeta Description: [170 char description]\nContent Intent: [Bottom of funnel, product-focused]\nTarget Keyword: [primary keyword]');
