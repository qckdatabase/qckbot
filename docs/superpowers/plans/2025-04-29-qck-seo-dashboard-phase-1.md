# QCK SEO Dashboard — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational multi-tenant architecture — Supabase schema with RLS, Supabase Auth (email/password), admin client management (add/deactivate/onboard), and the client dashboard shell with sidebar navigation.

**Architecture:** Next.js 14 App Router with Route Groups for auth/admin/client separation. Supabase for database, auth, and RLS. Middleware-based auth guards. CSS variables for QCK brand colors/fonts.

**Tech Stack:** Next.js 14, Supabase (Postgres + Auth + RLS), CSS Modules, Lucide React icons

---

## File Structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx           # Auth layout (clean, centered card)
│   │   └── login/page.tsx       # Shared login (redirects by role)
│   ├── (admin)/
│   │   ├── layout.tsx           # Admin layout
│   │   ├── clients/page.tsx     # Client management table
│   │   └── onboard/[id]/page.tsx # Full onboarding form
│   ├── (client)/
│   │   ├── layout.tsx           # Client layout with sidebar
│   │   ├── dashboard/page.tsx   # Client dashboard home (placeholder)
│   │   ├── seo/page.tsx         # SEO metrics (stub)
│   │   ├── ranking/page.tsx      # Ranking (stub)
│   │   ├── competitors/page.tsx  # Competitors (stub)
│   │   ├── campaigns/
│   │   │   ├── page.tsx         # Campaigns list (stub)
│   │   │   └── [id]/page.tsx    # Campaign detail (stub)
│   │   ├── guardrails/
│   │   │   ├── page.tsx         # Guardrails grid (stub)
│   │   │   └── [type]/page.tsx  # Guardrail editor (stub)
│   │   └── chat/page.tsx        # Chat interface (stub)
│   ├── api/
│   │   └── auth/[...supabase]/route.ts  # Supabase auth handler
│   ├── layout.tsx               # Root layout with fonts
│   └── globals.css              # CSS variables + QCK brand
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── modal.tsx
│   │   └── sidebar.tsx
│   └── admin/
│       ├── client-table.tsx
│       ├── add-client-modal.tsx
│       └── onboard-modal.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts       # Auth middleware
│   └── types.ts                 # TypeScript types
├── middleware.ts                 # Next.js middleware for auth
└── docs/superpowers/
    └── specs/2025-04-29-qck-seo-dashboard-design.md
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `lib/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "qck-seo-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "14.2.0"
  }
}
```

- [ ] **Step 2: Create next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
}

module.exports = nextConfig
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create lib/types.ts**

```typescript
export type UserRole = 'admin' | 'client'

export type TenantStatus = 'active' | 'deactivated'

export type CampaignStatus = 'generating' | 'generated' | 'revising' | 'approved' | 'posted' | 'failed'

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
```

- [ ] **Step 5: Create app/globals.css with QCK brand**

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Poppins:wght@500;600;700&display=swap');

:root {
  /* QCK Brand Colors */
  --color-bg: #ffffff;
  --color-surface: #f7f8f8;
  --color-border: #e5e7eb;
  --color-text: #011624;
  --color-text-muted: #67737c;
  --color-accent: #06f9fa;
  --color-accent-secondary: #ffeb65;
  --color-accent-dark: #0f333f;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography */
  --font-heading: 'Poppins', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: 600;
  line-height: 1.2;
}

h1 { font-size: 48px; }
h2 { font-size: 36px; }
h3 { font-size: 18px; }

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: var(--font-body);
  cursor: pointer;
}

input, textarea, select {
  font-family: var(--font-body);
  font-size: 14px;
}

/* Utility classes */
.text-muted { color: var(--color-text-muted); }
.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-error { color: var(--color-error); }
```

- [ ] **Step 6: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Qckbot SEO Dashboard',
  description: 'Client SEO management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git init
git add package.json next.config.js tsconfig.json app/layout.tsx app/globals.css lib/types.ts
git commit -m "feat: bootstrap Next.js 14 project with QCK brand colors/fonts"
```

---

## Task 2: Supabase Schema + RLS

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create supabase/schema.sql**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (client accounts)
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

-- Users (auth users per tenant)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  needs_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Metrics snapshots
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

-- Competitors
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

-- Campaigns
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

-- Guardrail Templates (global per content type)
CREATE TABLE guardrail_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_type, field_name)
);

-- Guardrail Values (per tenant per content type)
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

-- Chat Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('generate_campaign', 'revise_draft', 'update_guardrail')),
  action_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Tenants: admins see all, clients see only their own
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

-- Users: admins see all, users see own row
CREATE POLICY "Users see own data" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins see all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u2 WHERE u2.id = auth.uid() AND u2.role = 'admin')
  );

-- SEO Metrics: tenant isolation
CREATE POLICY "Users see own tenant metrics" ON seo_metrics
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

-- Competitors: tenant isolation
CREATE POLICY "Users see own competitors" ON competitors
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

-- Campaigns: tenant isolation
CREATE POLICY "Users see own campaigns" ON campaigns
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

-- Guardrail Templates: read for all authenticated
CREATE POLICY "All read guardrail templates" ON guardrail_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage templates" ON guardrail_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Guardrail Values: tenant isolation
CREATE POLICY "Users see own guardrails" ON guardrail_values
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

-- Chat Messages: tenant isolation
CREATE POLICY "Users see own messages" ON chat_messages
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE users.id = auth.uid())
  );

-- Functions

-- Function to get user's tenant_id from auth
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Trigger to update updated_at
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

-- Seed initial guardrail templates for blog and shoppable
INSERT INTO guardrail_templates (content_type, field_name, template_content) VALUES
('blog', 'structure', E'## [H1 Topic]\n\n[Opening paragraph - pain point focused]\n\n## [Major Section]\n\n[Content...]\n\n### [Subsection if needed]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'),
('blog', 'metadata', E'Title: [Title]\nProposed URL: /[slug]\nTitle Tag: [Title]\nMeta Description: [170 char description with keyword]\nContent Intent: [What searcher intent does this serve]\nTarget Keyword: [primary keyword]'),
('shoppable', 'structure', E'## [H1 Topic]\n\n[Opening paragraph - pain point focused, bottom of funnel]\n\n## [Major Section]\n\n[Content with embedded product mentions]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'),
('shoppable', 'metadata', E'Title: [Title]\nProposed URL: /[slug]\nTitle Tag: [Title]\nMeta Description: [170 char description]\nContent Intent: [Bottom of funnel, product-focused]\nTarget Keyword: [primary keyword]');
```

- [ ] **Step 2: Create lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add Supabase schema with RLS and client/server helpers"
```

---

## Task 3: Auth System

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/api/auth/callback/route.ts`
- Create: `middleware.ts`
- Create: `lib/supabase/middleware.ts`

- [ ] **Step 1: Create app/(auth)/layout.tsx**

```tsx
import styles from './layout.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Qckbot</span>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create app/(auth)/layout.module.css**

```css
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface);
  padding: var(--space-4);
}

.card {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-8);
  width: 100%;
  max-width: 400px;
}

.logo {
  text-align: center;
  margin-bottom: var(--space-6);
}

.logoText {
  font-family: var(--font-heading);
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
}
```

- [ ] **Step 3: Create app/(auth)/login/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        // Check if user needs password change
        const { data: userData } = await supabase
          .from('users')
          .select('needs_password_change, role')
          .eq('id', data.user.id)
          .single()

        if (userData?.needs_password_change) {
          router.push('/change-password')
        } else if (userData?.role === 'admin') {
          router.push('/admin/clients')
        } else {
          router.push('/dashboard')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1 className={styles.title}>Sign in</h1>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
        />
      </div>

      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create app/(auth)/login/page.module.css**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  font-size: 20px;
  text-align: center;
  margin-bottom: var(--space-2);
}

.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-weight: 500;
  font-size: 14px;
}

.field input {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 150ms ease;
}

.field input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.button {
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-accent-dark);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.button:hover:not(:disabled) {
  opacity: 0.9;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Create lib/supabase/middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A workaround is to read the
  // session manually before running any server code.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isClientRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                        request.nextUrl.pathname.startsWith('/seo') ||
                        request.nextUrl.pathname.startsWith('/ranking') ||
                        request.nextUrl.pathname.startsWith('/competitors') ||
                        request.nextUrl.pathname.startsWith('/campaigns') ||
                        request.nextUrl.pathname.startsWith('/guardrails') ||
                        request.nextUrl.pathname.startsWith('/chat')

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/change-password')

  if (!user && (isAdminRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    // Check role and redirect
    const { data: userData } = await supabase
      .from('users')
      .select('role, needs_password_change')
      .eq('id', user.id)
      .single()

    if (userData?.needs_password_change) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }

    if (userData?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/clients', request.url))
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

- [ ] **Step 6: Create middleware.ts**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 7: Commit**

```bash
git add app/(auth)/ middleware.ts lib/supabase/middleware.ts
git commit -m "feat: add auth system with Supabase and role-based routing"
```

---

## Task 4: UI Components

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/table.tsx`
- Create: `components/ui/modal.tsx`

- [ ] **Step 1: Create components/ui/button.tsx**

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'
import styles from './button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${styles[size]} ${className || ''}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? 'Loading...' : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

- [ ] **Step 2: Create components/ui/button.module.css**

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Variants */
.primary {
  background: var(--color-accent-dark);
  color: white;
}

.primary:hover:not(:disabled) {
  background: #0a2a35;
}

.secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.secondary:hover:not(:disabled) {
  background: var(--color-border);
}

.danger {
  background: var(--color-error);
  color: white;
}

.danger:hover:not(:disabled) {
  background: #dc2626;
}

.ghost {
  background: transparent;
  color: var(--color-text);
}

.ghost:hover:not(:disabled) {
  background: var(--color-surface);
}

/* Sizes */
.sm {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
}

.md {
  padding: var(--space-2) var(--space-4);
  font-size: 14px;
}

.lg {
  padding: var(--space-3) var(--space-6);
  font-size: 16px;
}
```

- [ ] **Step 3: Create components/ui/input.tsx**

```tsx
import { InputHTMLAttributes, forwardRef } from 'react'
import styles from './input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label}>{label}</label>}
        <input
          ref={ref}
          className={`${styles.input} ${error ? styles.error : ''} ${className || ''}`}
          {...props}
        />
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

- [ ] **Step 4: Create components/ui/input.module.css**

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-weight: 500;
  font-size: 14px;
}

.input {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 150ms ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.input.error {
  border-color: var(--color-error);
}

.errorText {
  font-size: 12px;
  color: var(--color-error);
}
```

- [ ] **Step 5: Create components/ui/badge.tsx**

```tsx
import { ReactNode } from 'react'
import styles from './badge.module.css'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'new'
  children: ReactNode
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 6: Create components/ui/badge.module.css**

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.default {
  background: var(--color-surface);
  color: var(--color-text);
}

.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.new {
  background: var(--color-error);
  color: white;
}
```

- [ ] **Step 7: Create components/ui/card.tsx**

```tsx
import { ReactNode } from 'react'
import styles from './card.module.css'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return <div className={`${styles.card} ${className || ''}`}>{children}</div>
}
```

- [ ] **Step 8: Create components/ui/card.module.css**

```css
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

- [ ] **Step 9: Create components/ui/table.tsx**

```tsx
import { ReactNode } from 'react'
import styles from './table.module.css'

interface TableProps {
  headers: string[]
  children: ReactNode
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 10: Create components/ui/table.module.css**

```css
.wrapper {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.table th {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.table td {
  font-size: 14px;
}

.table tbody tr:hover {
  background: var(--color-surface);
}
```

- [ ] **Step 11: Create components/ui/modal.tsx**

```tsx
'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import styles from './modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 12: Create components/ui/modal.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-4);
}

.modal {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.close {
  background: none;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}

.close:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.content {
  padding: var(--space-4);
}
```

- [ ] **Step 13: Commit**

```bash
git add components/ui/
git commit -m "feat: add UI component library (button, input, badge, card, table, modal)"
```

---

## Task 5: Admin Client Management

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/layout.module.css`
- Create: `app/(admin)/clients/page.tsx`
- Create: `app/(admin)/clients/page.module.css`
- Create: `components/admin/client-table.tsx`
- Create: `components/admin/add-client-modal.tsx`

- [ ] **Step 1: Create app/(admin)/layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './layout.module.css'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <div className={styles.layout}>{children}</div>
}
```

- [ ] **Step 2: Create app/(admin)/layout.module.css**

```css
.layout {
  min-height: 100vh;
  background: var(--color-surface);
  padding: var(--space-6);
}
```

- [ ] **Step 3: Create app/(admin)/clients/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { ClientTable } from '@/components/admin/client-table'
import { AddClientModal } from '@/components/admin/add-client-modal'
import styles from './page.module.css'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Clients</h1>
        <AddClientModal />
      </div>

      <ClientTable tenants={tenants || []} />
    </div>
  )
}
```

- [ ] **Step 4: Create app/(admin)/clients/page.module.css**

```css
.page {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header h1 {
  font-size: 24px;
}
```

- [ ] **Step 5: Create components/admin/client-table.tsx**

```tsx
'use client'

import { Tenant } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import styles from './client-table.module.css'

interface ClientTableProps {
  tenants: Tenant[]
}

export function ClientTable({ tenants }: ClientTableProps) {
  if (tenants.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No clients yet. Add your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Client</th>
            <th>Slug</th>
            <th>Owner Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td className={styles.name}>{tenant.name}</td>
              <td>{tenant.slug}</td>
              <td>{tenant.owner_email}</td>
              <td>
                <Badge variant={tenant.status === 'active' ? 'success' : 'error'}>
                  {tenant.status === 'active' ? 'Active' : 'Deactivated'}
                </Badge>
              </td>
              <td className={styles.actions}>
                {tenant.status === 'active' ? (
                  <Button variant="ghost" size="sm">
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm">
                    Reactivate
                  </Button>
                )}
                <Button variant="secondary" size="sm">
                  Onboard
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Create components/admin/client-table.module.css**

```css
.wrapper {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.table th {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: var(--color-surface);
}

.table td {
  font-size: 14px;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover {
  background: var(--color-surface);
}

.name {
  font-weight: 500;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.empty {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-10);
  text-align: center;
  color: var(--color-text-muted);
}
```

- [ ] **Step 7: Create components/admin/add-client-modal.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import styles from './add-client-modal.module.css'

export function AddClientModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Create tenant
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name, slug, owner_email: email })
        .select()
        .single()

      if (tenantError) {
        setError(tenantError.message)
        return
      }

      // Link user to tenant and set role
      await supabase.from('users').insert({
        id: authUser.user!.id,
        tenant_id: tenant.id,
        email,
        role: 'client',
        needs_password_change: true,
      })

      // Generate temp password (in real app, send via email)
      const tempPw = Math.random().toString(36).slice(-8)
      await supabase.auth.admin.updateUserById(authUser.user!.id, {
        password: tempPw,
      })

      setTempPassword(tempPw)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setName('')
    setEmail('')
    setTempPassword(null)
    setError('')
    router.refresh()
  }

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Add Client</Button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Add Client">
        {!tempPassword ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <Input
              label="Tenant Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Store"
              required
            />

            <Input
              label="Owner Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@acme.com"
              required
            />

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Client
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.tempPassword}>
            <p className={styles.tempLabel}>Temporary Password (send to client):</p>
            <div className={styles.passwordBox}>
              <code>{tempPassword}</code>
              <Button variant="secondary" size="sm" onClick={copyPassword}>
                Copy
              </Button>
            </div>
            <p className={styles.note}>
              Client will be asked to change password on first login.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </Modal>
    </>
  )
}
```

- [ ] **Step 8: Create components/admin/add-client-modal.module.css**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
}

.tempPassword {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.tempLabel {
  font-weight: 500;
  color: var(--color-text-muted);
}

.passwordBox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  padding: var(--space-3);
  border-radius: var(--radius-md);
}

.passwordBox code {
  font-family: monospace;
  font-size: 16px;
}

.note {
  font-size: 12px;
  color: var(--color-text-muted);
}
```

- [ ] **Step 9: Commit**

```bash
git add app/(admin)/ components/admin/
git commit -m "feat: add admin client management with add/deactivate/onboard"
```

---

## Task 6: Client Layout + Dashboard Shell

**Files:**
- Create: `app/(client)/layout.tsx`
- Create: `app/(client)/layout.module.css`
- Create: `components/ui/sidebar.tsx`
- Create: `app/(client)/dashboard/page.tsx`
- Create: `app/(client)/seo/page.tsx`
- Create: `app/(client)/ranking/page.tsx`
- Create: `app/(client)/competitors/page.tsx`
- Create: `app/(client)/campaigns/page.tsx`
- Create: `app/(client)/campaigns/[id]/page.tsx`
- Create: `app/(client)/guardrails/page.tsx`
- Create: `app/(client)/guardrails/[type]/page.tsx`
- Create: `app/(client)/chat/page.tsx`

- [ ] **Step 1: Create app/(client)/layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/ui/sidebar'
import styles from './layout.module.css'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'admin') {
    redirect('/admin/clients')
  }

  // Get tenant name for sidebar
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', userData?.tenant_id)
    .single()

  return (
    <div className={styles.layout}>
      <Sidebar tenantName={tenantData?.name || 'Client'} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create app/(client)/layout.module.css**

```css
.layout {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  background: var(--color-surface);
  padding: var(--space-6);
  overflow-y: auto;
}
```

- [ ] **Step 3: Create components/ui/sidebar.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, Users, FileText, Shield, MessageSquare, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './sidebar.module.css'

interface SidebarProps {
  tenantName: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seo', label: 'SEO Metrics', icon: BarChart3 },
  { href: '/ranking', label: 'Ranking', icon: BarChart3 },
  { href: '/competitors', label: 'Competitors', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: FileText },
  { href: '/guardrails', label: 'Guardrails', icon: Shield },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

export function Sidebar({ tenantName }: SidebarProps) {
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.logo}>Qckbot</span>
        <span className={styles.tenant}>{tenantName}</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create components/ui/sidebar.module.css**

```css
.sidebar {
  width: 240px;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.logo {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.tenant {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.nav {
  flex: 1;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.navItem {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-muted);
  transition: all 150ms ease;
}

.navItem:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.navItem.active {
  background: var(--color-accent-dark);
  color: white;
}

.footer {
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.logout {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  transition: all 150ms ease;
}

.logout:hover {
  background: var(--color-surface);
  color: var(--color-text);
}
```

- [ ] **Step 5: Create app/(client)/dashboard/page.tsx (placeholder)**

```tsx
import { Card } from '@/components/ui/card'
import styles from './page.module.css'

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <h1>Dashboard</h1>
      <p className={styles.subtitle}>Welcome to your SEO dashboard.</p>

      <div className={styles.grid}>
        <Card>SEO Metrics</Card>
        <Card>Ranking</Card>
        <Card>Competitors</Card>
        <Card>Campaigns</Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create stub pages for seo, ranking, competitors, campaigns, guardrails, chat**

Each stub page should:
- Export default function with page title
- Import Card component
- Show placeholder content

Example for `/app/(client)/seo/page.tsx`:
```tsx
import { Card } from '@/components/ui/card'

export default function SEOPage() {
  return (
    <div>
      <h1>SEO Metrics</h1>
      <Card>SEO metrics coming soon...</Card>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/(client)/ components/ui/sidebar.tsx components/ui/sidebar.module.css
git commit -m "feat: add client layout with sidebar navigation and stub pages"
```

---

## Task 7: Change Password Flow

**Files:**
- Create: `app/(auth)/change-password/page.tsx`
- Create: `app/(auth)/change-password/page.module.css`

- [ ] **Step 1: Create app/(auth)/change-password/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { data: { user }, error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      if (user) {
        // Update needs_password_change flag
        await supabase
          .from('users')
          .update({ needs_password_change: false })
          .eq('id', user.id)

        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1 className={styles.title}>Change Password</h1>
      <p className={styles.subtitle}>You must change your password before continuing.</p>

      {error && <div className={styles.error}>{error}</div>}

      <Input
        label="New Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Min 8 characters"
        required
      />

      <Input
        label="Confirm Password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        required
      />

      <Button type="submit" loading={loading}>
        Update Password
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create app/(auth)/change-password/page.module.css**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  font-size: 20px;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
  margin-top: calc(var(--space-2) * -1);
}

.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/change-password/
git commit -m "feat: add forced password change flow"
```

---

## Summary

Phase 1 builds:
1. Project bootstrap with QCK brand fonts/colors
2. Supabase schema with RLS for multi-tenancy
3. Auth system (login, role-based routing, password change)
4. Reusable UI component library
5. Admin client management (add/deactivate/onboard)
6. Client layout with sidebar and stub pages

**Total: 7 tasks, ~35 steps**

---

## Next: Phase 2 (SEO Data)
After Phase 1 ships:
- Ahrefs API integration
- SEO Metrics page with charts
- Ranking leaderboard
- Competitors page + refresh

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
