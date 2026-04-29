export type UserRole = 'admin' | 'client'

export type TenantStatus = 'active' | 'deactivated'

export type CampaignStatus = 'generated' | 'reviewing' | 'published' | 'failed'

export type ContentType = 'blog' | 'shoppable' | 'listicle' | 'faq_guide' | 'llm' | 'collection_refresh' | 'location_page' | 'landing_page' | 'knowledge_center' | 'service_page' | 'blog_refresh'

export interface Tenant {
  id: string
  name: string
  slug: string
  domain: string | null
  owner_email: string
  ahrefs_target: string | null
  sitemap_url: string | null
  brand_voice: string | null
  google_sheet_id: string | null
  google_docs_folder_id: string | null
  slack_channel_id: string | null
  competitor_domains: string[] | null
  status: TenantStatus
  created_at: string
}

export interface User {
  id: string
  tenant_id: string | null
  email: string
  role: UserRole
  needs_password_change: boolean
  created_at: string
}

export interface SEOMetric {
  id: string
  tenant_id: string
  snapshot_date: string
  domain_rating: number
  organic_keywords: number
  backlinks: number
  est_monthly_traffic: number
  created_at: string
}

export interface Competitor {
  id: string
  tenant_id: string
  name: string
  domain: string
  domain_rating: number | null
  traffic: number | null
  backlinks: number | null
  last_fetched: string | null
  created_at: string
}

export interface Campaign {
  id: string
  tenant_id: string
  title: string
  content_type: ContentType
  primary_keyword: string
  status: CampaignStatus
  google_doc_url: string | null
  live_url: string | null
  generated_content: string | null
  created_at: string
  updated_at: string
}

export interface GuardrailTemplate {
  id: string
  content_type: ContentType
  field_name: string
  template_content: string
  created_at: string
}

export interface GuardrailValue {
  id: string
  tenant_id: string
  content_type: ContentType
  field_name: string
  value: string
  source: 'bot' | 'client'
  needs_review: boolean
  updated_at: string
}

export interface ChatMessage {
  id: string
  tenant_id: string
  role: 'user' | 'assistant'
  content: string
  action_type: 'generate_campaign' | 'revise_draft' | 'update_guardrail' | null
  action_meta: Record<string, unknown> | null
  created_at: string
}
