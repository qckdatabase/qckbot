# QCK SEO Dashboard — Design Specification

## 1. Concept & Vision

QCK is a multi-tenant SEO content platform for agencies managing client stores. The agency creates client accounts and configures their SEO data sources; clients log in to view their SEO metrics, competitor analysis, and AI-generated content campaigns. The AI acts as an SEO strategist — analyzing rankings and competitors to decide what content to generate, then producing structured drafts following universal format templates.

The product feels like a professional SaaS dashboard: data-dense but scannable, with clear hierarchy between admin operations and client-facing insights. The chatbot is the primary action surface — clients ask it to generate campaigns and it delivers.

---

## 2. Design Language

**Aesthetic:** Clean SaaS dashboard — light backgrounds, clear typography, status badges, data tables. Not minimal, but organized. Think Linear meets Stripe Dashboard.

**Color Palette:**
Adapted from qck.co brand colors — cyan and yellow accents on clean white backgrounds.

- Background: `#ffffff` (white)
- Surface Background: `#f7f8f8` (light gray — cards, sidebar)
- Border: `#e5e7eb` (subtle dividers)
- Text Primary: `#011624` (near black — from qck.co)
- Text Secondary: `#67737c` (muted gray — from qck.co)
- Accent Primary: `#06f9fa` (bright cyan — qck.co accent)
- Accent Secondary: `#ffeb65` (yellow/gold — qck.co CTAs)
- Accent Tertiary: `#0f333f` (dark teal — qck.co footer)
- Success: `#10b981` (green — approved, active)
- Warning: `#f59e0b` (amber — queued, generating)
- Error/Danger: `#ef4444` (red — failed, deactivated)
- New Badge: `#ef4444` (red badge count for unread bot changes)

Note: QCK brand uses cyan `#06f9fa` as primary accent and yellow `#ffeb65` for CTAs. The dashboard should feel clean and professional while incorporating these brand colors in accents, buttons, and active states.

**Typography:**
Adapted from qck.co brand — Poppins for headings, DM Sans for body text.

- Headings: **Poppins** (Google Fonts) — weights 500, 600, 700
  - H1: 48px / weight 600
  - H2: 36px / weight 600
  - H3: 18px / weight 600
- Body/UI: **DM Sans** (Google Fonts) — weights 400, 500, 700
  - Body: 14px–16px / weight 400
  - Labels: 14px / weight 500
  - Links/Buttons: 16px / weight 700
- Fallback: system-ui, sans-serif

Note: Keep body text readable (14px minimum). Dashboard should feel clean and professional using these brand fonts.

**Spatial System:**
- Base unit: 4px
- Component padding: 12px–16px
- Section gaps: 24px–32px
- Card border-radius: 8px

**Motion:**
- Minimal — 150ms ease for hover states, button loading spinners
- No decorative animations

**Icons:** Lucide React (consistent, clean line icons)

---

## 3. Architecture

### Stack
- **Frontend:** Next.js (App Router) deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password only)
- **AI:** OpenAI (GPT-4o) for chat and content generation
- **Background Jobs:** Vercel Cron + Supabase Edge Functions (fastest path)
- **External Integrations:** Ahrefs API, Google Docs API

### Multi-Tenancy Model
- **Agency Admin:** Single admin account, sees/manages all client tenants
- **Client Users:** Each tenant has one or more client users; each user only sees their own tenant's data
- **Data Isolation:** Row-Level Security (RLS) on all Supabase tables — tenant_id is the isolation key

### Data Flow
```
Client Chat → API Route → Supabase Edge Function (OpenAI) → Store Message → Return Response
Campaign Request → Chat → AI Analyzes SEO Data → Generates Content → Stores Draft → Links Google Doc
```

---

## 4. Database Schema

### Tables

#### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Client store name |
| slug | text | URL-safe identifier, unique |
| domain | text | Client's website URL |
| owner_email | text | Primary contact |
| ahrefs_target | text | Domain tracked in Ahrefs |
| sitemap_url | text | Optional |
| brand_voice | text | Optional notes on tone |
| google_sheet_id | text | Optional |
| google_docs_folder_id | text | Optional |
| slack_channel_id | text | Optional |
| status | text | 'active' or 'deactivated' |
| created_at | timestamptz | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| email | text | Unique |
| password_hash | text | Supabase Auth |
| role | text | 'admin' (agency) or 'client' |
| needs_password_change | boolean | True on first login / temp password |
| created_at | timestamptz | |

#### `seo_metrics`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| snapshot_date | date | |
| domain_rating | numeric | |
| organic_keywords | integer | |
| backlinks | integer | |
| est_monthly_traffic | integer | |
| created_at | timestamptz | |

#### `competitors`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| name | text | |
| domain | text | |
| domain_rating | numeric | |
| traffic | integer | |
| backlinks | integer | |
| last_fetched | timestamptz | |
| created_at | timestamptz | |

#### `campaigns`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| title | text | |
| content_type | text | blog, shoppable, listicle, faq_guide, etc. |
| primary_keyword | text | |
| status | text | generating, generated, revising, approved, posted, failed |
| google_doc_url | text | |
| live_url | text | Optional |
| generated_content | text | Plain text with H1/H2/H3 markup |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `guardrail_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| content_type | text | blog, shoppable, listicle, faq_guide, etc. |
| field_name | text | e.g., "structure", "tone", "sections" |
| template_content | text | Markdown template for this field |
| created_at | timestamptz | |

#### `guardrail_values`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| content_type | text | |
| field_name | text | |
| value | text | Tenant-specific value |
| source | text | 'bot' or 'client' |
| needs_review | boolean | True when bot edits need acknowledgment |
| updated_at | timestamptz | |

#### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| role | text | 'user' or 'assistant' |
| content | text | |
| action_type | text | Optional: 'generate_campaign', 'revise_draft', 'update_guardrail' |
| action_meta | jsonb | Optional: { campaign_id, guardrail_id, etc. } |
| created_at | timestamptz | |

### Row-Level Security
All tenant-scoped tables enforce: `tenant_id = auth.jwt() ->> 'tenant_id'`

---

## 5. Content Format

### Metadata Header (all content types)
```
[Title as H1]
Proposed URL: [url]
Title Tag: [title]
Meta Description: [meta_desc]
Content Intent: [intent statement]
Target Keyword: [keyword]
```

### Body Structure
- H1: Main topic (appears once, after header)
- H2: Major sections (`## Section Name`)
- H3: Subsections (`### Subsection Name`)
- Bold: `**bold text**`
- Lists: `- List item`
- FAQ sections: H2 + H3 Q&A pattern

### Example (Blog Post)
```
## What Makes Exterior Signage Different

Content paragraph...

### Constant Weather Exposure

Content paragraph...

- Use High-Contrast Typography
- Prioritize a Clear Visual Hierarchy
```

---

## 6. Content Types (Phase 1)

1. **Blog Post** — Long-form educational article
2. **Shoppable Article** — Bottom-of-funnel product-focused content

Additional types to add later: listicle, FAQ guide, LLM page, collection page refresh, location page, new landing page, knowledge center, service page, blog post refresh.

---

## 7. Guardrail Templates (Universal)

Each content type has a markdown template defining its structure. Templates are global — the AI follows them for all clients. Example for Shoppable:

```markdown
## [H1 Topic]

[Opening paragraph — pain point focused]

## [Major Section]

[Content...]

### [Subsection if needed]

[Content...]

## [Next Major Section]

## [FAQ Section]

### [Question 1]

[Answer...]

### [Question 2]

[Answer...]
```

---

## 8. Page Structure

### Admin Pages

#### `/login`
- Email + password fields
- Sign in button
- Error message area

#### `/admin/clients`
- Page title: "Clients"
- Primary button: "Add Client"
- Table: Client name, Slug, Owner email, Status (Active/Deactivated), Actions
- Actions: Deactivate / Reactivate / Onboard

**Add Client Modal:**
- Fields: Tenant name, Owner email
- Creates tenant + sends temp password
- Shows temp password once in modal with "Copy" button

**Onboard Modal:**
- Fields: Tenant name, Slug, Owner email, Domain, Sitemap URL, Ahrefs target, Brand voice, Google Sheet ID, Google Docs folder ID, Slack channel ID

#### `/admin/onboard/:tenant_id`
- Full onboarding form (pre-filled from Add Client)
- Submit starts background jobs

---

### Client Pages

#### `/login` (shared, redirects by role)
- Email + password fields
- Error message area
- If deactivated: "Account deactivated" message

#### `/change-password`
- New password + confirm password fields
- No back/skip option
- Forced on first login / temp password

#### Client Layout
- Left sidebar (fixed 240px)
- Sidebar items: SEO Metrics, Ranking, Competitors, Campaigns, Guardrails, Chat
- Badge count on Guardrails when `needs_review = true`
- Top: Tenant name + Logout button

#### `/seo`
- Header: "SEO Metrics"
- 4 KPI cards: Domain Rating, Organic Keywords, Backlinks, Est. Monthly Traffic
- 12-month trend chart
- Top Keywords table
- Top Backlinks table

#### `/ranking`
- Header: "Ranking"
- Metric toggle: DR / Traffic / Backlinks / Overlap
- Top 10 leaderboard (client distinguished visually)
- Active toggle highlighted

#### `/competitors`
- Header: "Competitors"
- "Refresh competitors" button → queued state + toast
- Cards/table: Name, Domain, DR, Traffic, Backlinks, Last fetched

#### `/campaigns`
- Header: "Campaigns"
- Filter by content type
- Table: Title, Type, Keyword, Status, Google Doc link, Live URL, Updated
- Status badges: Generating (amber), Generated (blue), Revising (amber), Approved (green), Posted (gray), Failed (red)
- Click row → `/campaigns/:id`

#### `/campaigns/:id`
- Draft title + status badge
- Primary keyword + content type
- Google Doc link + Live URL
- Chat/revision panel
- "Approve" button (when status = generated)
- Status flow: Generating → Generated → (Revising) → Approved → Posted

#### `/guardrails`
- Header: "Guardrails"
- 12 cards grid (content types)
- Each card: Type name, preview, updated date
- Red "NEW" badge when `needs_review = true`
- Click card → `/guardrails/:content_type`

#### `/guardrails/:content_type`
- Two-column layout
- Left: Markdown editor with Edit/Preview tabs, change summary input, Save revision button
- Right: Revision history (bot/client label, timestamp, summary, diff preview, Acknowledge button)
- Acknowledge: Marks bot edit as reviewed, clears needs_review flag

#### `/chat`
- Full-height chat interface
- Message history (user/assistant styling)
- Input + Send button
- Action status messages: "Creating draft…", "Updating guardrail…"
- Context-aware: has access to tenant's SEO data, competitors, campaigns, guardrails

---

## 9. Chatbot Behavior

### Scope (RAG-powered)
The chatbot ONLY answers questions related to:
- The client's own SEO data and metrics
- Their competitors
- Their campaigns and content
- Their guardrails
- Generating new content campaigns

If asked anything else, it responds: "I can only help with your SEO and content campaigns. Ask me about your rankings, competitors, or to generate a new campaign."

### Campaign Generation Flow
1. Client asks: "Generate a campaign for [month]"
2. Bot analyzes: SEO gaps, competitor content, guardrail formats
3. Bot decides: Content mix (e.g., 2 blogs, 2 shoppables, 1 FAQ)
4. Bot generates: 20 content drafts (5/week × 4 weeks)
5. Bot stores: Each as `campaign` with status = "generated"
6. Bot responds: "Created 20 drafts for June. Here's the breakdown: [list]"

### On-boarding Questions
- "What keywords should I target?" → Uses Ahrefs data + competitor analysis
- "What content types should I create?" → AI decides based on gaps

---

## 10. Component States

| Component | States |
|-----------|--------|
| Buttons | default, hover, active, disabled, loading |
| Status badges | Generating (amber), Generated (blue), Revising (amber), Approved (green), Posted (gray), Failed (red), Active (green), Deactivated (red) |
| Tables | loading skeleton, empty state, populated |
| Chat messages | user, assistant, action status |
| Input fields | default, focus, error, disabled |
| Modals | open, loading, success |
| Toasts | success, error, info |

---

## 11. Technical Approach

### Auth Flow
1. Supabase Auth with email/password
2. Custom claims: `{ tenant_id, role: 'admin' | 'client' }`
3. RLS enforces tenant isolation
4. Middleware checks session + role

### API Routes
- `/api/auth/*` — Login, logout, password change
- `/api/tenants/*` — CRUD for admin
- `/api/seo/*` — Metrics, refresh from Ahrefs
- `/api/competitors/*` — List, refresh
- `/api/campaigns/*` — List, create, update status
- `/api/guardrails/*` — Get templates, get/set values
- `/api/chat/*` — Send message, get history

### Background Jobs
- **SEO Refresh:** Daily Vercel Cron → Edge Function → Ahrefs API → Update `seo_metrics`
- **Competitor Refresh:** On-demand via API → Edge Function → Ahrefs API → Update `competitors`
- **Campaign Generation:** Triggered via chat → Edge Function → OpenAI → Create `campaigns`

### External Integrations
- **Ahrefs:** Domain metrics, competitor discovery, keyword data
- **Google Docs API:** Create doc, write content (paste HTML or plain text with formatting)
- **OpenAI:** Chat completions with RAG context

---

## 12. Phases

### Phase 1 (Foundation)
- Supabase schema + RLS
- Auth system (admin + client login, password change)
- Admin: Client management (add, deactivate, onboard)
- Client layout + sidebar
- Basic dashboard shell

### Phase 2 (SEO Data)
- Ahrefs API integration
- SEO Metrics page with charts
- Ranking leaderboard
- Competitors page + refresh

### Phase 3 (Content + Chat)
- Guardrail templates + editor
- Campaign list + detail
- Chat interface with RAG
- Campaign generation flow
- Google Docs integration

---

## 13. File Structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── change-password/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── clients/page.tsx
│   │   └── onboard/[id]/page.tsx
│   ├── (client)/
│   │   ├── layout.tsx
│   │   ├── seo/page.tsx
│   │   ├── ranking/page.tsx
│   │   ├── competitors/page.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── guardrails/
│   │   │   ├── page.tsx
│   │   │   └── [type]/page.tsx
│   │   └── chat/page.tsx
│   ├── api/
│   │   ├── auth/[...supabase]/route.ts
│   │   ├── tenants/route.ts
│   │   ├── seo/route.ts
│   │   ├── competitors/route.ts
│   │   ├── campaigns/route.ts
│   │   ├── guardrails/route.ts
│   │   └── chat/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/ (buttons, inputs, badges, cards, tables)
│   ├── admin/ (client-table, add-client-modal, onboard-modal)
│   ├── client/ (sidebar, seo-charts, campaign-list, guardrail-editor)
│   └── chat/ (chat-interface, message-bubble)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ahrefs.ts
│   ├── openai.ts
│   └── google-docs.ts
├── types/
│   └── index.ts
└── docs/
    └── superpowers/
        └── specs/
```
