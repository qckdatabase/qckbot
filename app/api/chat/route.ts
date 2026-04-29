import type { SupabaseClient } from '@supabase/supabase-js'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { chatWithContext, detectCampaignIntent } from '@/lib/openai'
import { generateCounterCampaign, editCampaignContent } from '@/lib/ai-campaign'
import { getInternalLinkPool, getLiveKeywords } from '@/lib/sitemap'
import {
  MONTHLY_CAP_MESSAGE,
  countCampaignsInMonth,
  getMonthBounds,
  MONTHLY_CAMPAIGN_CAP,
} from '@/lib/campaign-cap'
import { getLatestSeoSnapshot, matchKeywordMetric } from '@/lib/keyword-metrics'
import { pickNextAvailableDate } from '@/lib/campaign-schedule'
import { runMonthPlan } from '@/lib/plan-month-flow'
import {
  generateCampaignDraft,
  runWithConcurrency,
} from '@/lib/generate-campaign-flow'

export const maxDuration = 300

const PLAN_NEXT_MONTH_CMD = '/plan-next-month'
const GENERATION_CONCURRENCY = 5

interface TenantRow {
  domain: string | null
  ahrefs_target: string | null
  brand_voice: string | null
  competitor_domains: string[] | null
  sitemap_url: string | null
}
interface SeoMetricRow {
  domain_rating: number | null
  organic_keywords: number | null
  backlinks: number | null
  est_monthly_traffic: number | null
}
interface CompetitorRow {
  name: string
  domain_rating: number | null
  traffic: number | null
}
interface GuardrailRow {
  content_type: string
  field_name: string
  value: string
}
interface CampaignRow {
  title: string
  content_type: string
  status: string
  primary_keyword: string | null
}
interface ChatHistoryRow {
  role: string
  content: string
}

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: messages } = await db
    .from('chat_messages')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: true }) as {
      data: Array<{
        id: string
        role: string
        content: string
        action_type: string | null
        action_meta: { campaign_id?: string } | null
        created_at: string
      }> | null
    }

  const list = messages || []
  const referencedIds = Array.from(
    new Set(
      list
        .map((m) => m.action_meta?.campaign_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  let existingIds = new Set<string>()
  if (referencedIds.length > 0) {
    const { data: existing } = await db
      .from('campaigns')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .in('id', referencedIds) as { data: Array<{ id: string }> | null }
    existingIds = new Set((existing || []).map((c) => c.id))
  }

  const enriched = list.map((m) => {
    const cid = m.action_meta?.campaign_id
    if (!cid) return m
    const deleted = !existingIds.has(cid)
    return {
      ...m,
      action_meta: { ...m.action_meta, campaign_id: cid, deleted },
    }
  })

  const BATCH_WINDOW_MS = 15 * 60 * 1000
  const batchSince = new Date(Date.now() - BATCH_WINDOW_MS).toISOString()

  const { data: recentBatch } = await db
    .from('campaigns')
    .select('status')
    .eq('tenant_id', auth.tenantId)
    .gte('created_at', batchSince) as {
      data: Array<{ status: string }> | null
    }

  const batch = recentBatch || []
  const inFlightStatuses = new Set(['pending', 'generating'])
  const total = batch.length
  const inFlight = batch.filter((c) => inFlightStatuses.has(c.status)).length
  const done = total - inFlight

  const lastMsg = list[list.length - 1]
  const STALE_MS = 10 * 60 * 1000
  const lastIsUserPending =
    lastMsg?.role === 'user' &&
    Date.now() - new Date(lastMsg.created_at).getTime() < STALE_MS

  const isGenerating = inFlight > 0 || lastIsUserPending
  const progress = total > 1 && inFlight > 0 ? { done, total } : null

  return Response.json({
    messages: enriched,
    is_generating: isGenerating,
    progress,
  })
}

export async function POST(request: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const body = await request.json()
  const { content } = body

  if (!content || typeof content !== 'string') {
    return Response.json({ error: 'content required' }, { status: 400 })
  }

  await db.from('chat_messages').insert({
    tenant_id: auth.tenantId,
    role: 'user',
    content,
  })

  if (content.trim().toLowerCase().startsWith(PLAN_NEXT_MONTH_CMD)) {
    return handlePlanNextMonth(db, auth.tenantId)
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('domain, ahrefs_target, brand_voice, competitor_domains, sitemap_url')
    .eq('id', auth.tenantId)
    .single() as { data: TenantRow | null }

  const { data: seoMetrics } = await db
    .from('seo_metrics')
    .select('domain_rating, organic_keywords, backlinks, est_monthly_traffic')
    .eq('tenant_id', auth.tenantId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single() as { data: SeoMetricRow | null }

  const { data: competitors } = await db
    .from('competitors')
    .select('name, domain_rating, traffic')
    .eq('tenant_id', auth.tenantId)
    .limit(10) as { data: CompetitorRow[] | null }

  const { data: guardrailValues } = await db
    .from('guardrail_values')
    .select('content_type, field_name, value')
    .eq('tenant_id', auth.tenantId) as { data: GuardrailRow[] | null }

  const { data: guardrailTemplates } = await db
    .from('guardrail_templates')
    .select('content_type, field_name, template_content') as {
      data: Array<{ content_type: string; field_name: string; template_content: string }> | null
    }

  const { data: campaigns } = await db
    .from('campaigns')
    .select('title, content_type, status, primary_keyword')
    .eq('tenant_id', auth.tenantId)
    .order('updated_at', { ascending: false })
    .limit(50) as { data: CampaignRow[] | null }

  const { data: aiRankingRow } = await db
    .from('ai_rankings')
    .select('payload, generated_at')
    .eq('tenant_id', auth.tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        payload: {
          keyword: string
          user_rank: number | null
          rankings: Array<{
            rank: number
            brand: string
            domain: string
            reason: string
            isUser: boolean
            domain_rating: number
            traffic: number
            backlinks: number
          }>
        }
        generated_at: string
      } | null
    }

  const { data: trackedKeywordsRow } = await db
    .from('store_keywords')
    .select('payload')
    .eq('tenant_id', auth.tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: { payload: { keywords?: Array<{ keyword: string }> } | null } | null
    }

  const trackedKeywords = (trackedKeywordsRow?.payload?.keywords || [])
    .map((k) => (k.keyword || '').trim().toLowerCase())
    .filter(Boolean)

  const { data: seoSnapshot } = await db
    .from('seo_metrics')
    .select('payload')
    .eq('tenant_id', auth.tenantId)
    .not('payload', 'is', null)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        payload: {
          keywords?: Array<{
            keyword: string
            position: number
            volume: number
            difficulty: number
            url: string
          }>
        }
      } | null
    }

  const guardrailsMap: Record<string, string> = {}
  guardrailValues?.forEach((g) => {
    if (!guardrailsMap[g.content_type]) {
      guardrailsMap[g.content_type] = ''
    }
    guardrailsMap[g.content_type] += `\n${g.field_name}: ${g.value}`
  })

  const context = {
    tenant_id: auth.tenantId,
    domain: tenant?.domain || tenant?.ahrefs_target || '',
    ahrefs_target: tenant?.ahrefs_target || '',
    seo_metrics: seoMetrics
      ? {
          domain_rating: seoMetrics.domain_rating || 0,
          organic_keywords: seoMetrics.organic_keywords || 0,
          backlinks: seoMetrics.backlinks || 0,
          est_monthly_traffic: seoMetrics.est_monthly_traffic || 0,
        }
      : { domain_rating: 0, organic_keywords: 0, backlinks: 0, est_monthly_traffic: 0 },
    competitors: (competitors || []).map((c) => ({
      name: c.name,
      domain_rating: c.domain_rating || 0,
      traffic: c.traffic || 0,
    })),
    guardrails: guardrailsMap,
    recent_campaigns: (campaigns || []).map((c) => ({
      title: c.title,
      content_type: c.content_type,
      status: c.status,
      primary_keyword: c.primary_keyword || '',
    })),
    live_keywords: await getLiveKeywords(tenant?.sitemap_url),
    ai_ranking: aiRankingRow?.payload
      ? {
          keyword: aiRankingRow.payload.keyword,
          user_rank: aiRankingRow.payload.user_rank,
          generated_at: aiRankingRow.generated_at,
          rankings: aiRankingRow.payload.rankings || [],
        }
      : null,
    top_keywords: seoSnapshot?.payload?.keywords || [],
    tracked_keywords: trackedKeywords,
  }

  let assistantReply: string
  let campaignId: string | null = null

  try {
    const intent = await detectCampaignIntent(content, context, tenant?.brand_voice)

    if (intent.type === 'campaign') {
      const scheduledFor = await pickNextAvailableDate(db, auth.tenantId)
      const targetBounds = getMonthBounds(new Date(`${scheduledFor}T00:00:00Z`))
      const monthTotal = await countCampaignsInMonth(db, auth.tenantId, targetBounds)
      if (monthTotal >= MONTHLY_CAMPAIGN_CAP) {
        assistantReply = MONTHLY_CAP_MESSAGE
        await db.from('chat_messages').insert({
          tenant_id: auth.tenantId,
          role: 'assistant',
          content: assistantReply,
        })
        return Response.json({ response: assistantReply, campaign_id: null })
      }

      const matchingTemplate =
        (guardrailTemplates || []).find(
          (t) => t.content_type === intent.content_type && t.field_name === 'structure'
        )?.template_content ||
        (guardrailTemplates || []).find((t) => t.content_type === intent.content_type)
          ?.template_content ||
        ''

      const internalLinks = await getInternalLinkPool(tenant?.sitemap_url)
      console.log('[campaign] internal link pool:', {
        sitemap_url: tenant?.sitemap_url || '(none)',
        products: internalLinks.products.length,
        collections: internalLinks.collections.length,
        blogs: internalLinks.blogs.length,
        pages: internalLinks.pages.length,
      })
      if (
        internalLinks.products.length === 0 &&
        internalLinks.collections.length === 0 &&
        internalLinks.blogs.length === 0
      ) {
        console.warn(
          `[campaign] empty internal link pool for tenant ${auth.tenantId}. sitemap_url=${tenant?.sitemap_url || '(none)'}. AI cannot insert internal links.`
        )
      }

      const counter = await generateCounterCampaign({
        tenant: {
          domain: context.domain,
          brand_voice: tenant?.brand_voice || null,
          seo_metrics: context.seo_metrics,
          competitor_domains: tenant?.competitor_domains || [],
        },
        contentType: intent.content_type,
        primaryKeyword: intent.primary_keyword,
        title: intent.title,
        guardrailTemplate: matchingTemplate,
        internalLinks,
      })

      const snapshot = await getLatestSeoSnapshot(db, auth.tenantId)
      const metric = matchKeywordMetric(intent.primary_keyword, snapshot)

      const { data: insertedCampaign, error: insertErr } = await db
        .from('campaigns')
        .insert({
          tenant_id: auth.tenantId,
          title: intent.title,
          content_type: intent.content_type,
          primary_keyword: intent.primary_keyword,
          generated_content: counter.content,
          status: 'generated',
          scheduled_for: scheduledFor,
          keyword_difficulty: metric.kd,
          keyword_volume: metric.volume,
        })
        .select()
        .single() as {
          data: { id: string } | null
          error: { message: string } | null
        }

      if (insertErr || !insertedCampaign) {
        throw new Error(insertErr?.message || 'Failed to save campaign')
      }

      campaignId = insertedCampaign.id
      const ref = counter.competitor_reference
      const linkPoolEmpty =
        internalLinks.products.length === 0 &&
        internalLinks.collections.length === 0 &&
        internalLinks.blogs.length === 0
      const scheduleDate = new Date(`${scheduledFor}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      assistantReply =
        `Counter campaign created: **${intent.title}** (${intent.content_type}, keyword: ${intent.primary_keyword}).\n\n` +
        `Scheduled for **${scheduleDate}** (next free weekday slot).\n\n` +
        (ref
          ? `Countering competitor: **${ref.domain}** — "${ref.title}" (${ref.url}).\n\n`
          : '') +
        (linkPoolEmpty
          ? `⚠️ No internal links inserted: tenant sitemap_url is empty or the sitemap returned no recognizable product/blog/collection URLs. Set sitemap_url in onboarding to enable internal linking.\n\n`
          : '') +
        `View draft at /campaigns/${campaignId}.`
    } else if (intent.type === 'edit_campaign') {
      const { data: candidates } = await db
        .from('campaigns')
        .select('id, title, content_type, primary_keyword, generated_content, status')
        .eq('tenant_id', auth.tenantId)
        .order('updated_at', { ascending: false })
        .limit(20) as {
          data: Array<{
            id: string
            title: string
            content_type: string
            primary_keyword: string
            generated_content: string | null
            status: string
          }> | null
        }

      const list = candidates || []
      if (list.length === 0) {
        assistantReply = 'No existing campaigns to edit. Generate one first.'
      } else {
        const hint = intent.campaign_hint.toLowerCase()
        let target = list[0]
        if (hint && hint !== 'latest' && hint !== 'last') {
          const match = list.find(
            (c) =>
              c.title.toLowerCase().includes(hint) ||
              c.primary_keyword.toLowerCase().includes(hint)
          )
          if (match) target = match
        }

        if (!target.generated_content) {
          assistantReply = `Campaign "${target.title}" has no content to edit.`
        } else {
          const internalLinks = await getInternalLinkPool(tenant?.sitemap_url)
          const edited = await editCampaignContent({
            tenant: {
              domain: context.domain,
              brand_voice: tenant?.brand_voice || null,
              competitor_domains: tenant?.competitor_domains || [],
            },
            contentType: target.content_type,
            primaryKeyword: target.primary_keyword,
            currentContent: target.generated_content,
            editInstruction: intent.edit_instruction,
            internalLinks,
          })

          const { error: updateErr } = await db
            .from('campaigns')
            .update({
              generated_content: edited.content,
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.id)
            .eq('tenant_id', auth.tenantId)

          if (updateErr) {
            throw new Error(updateErr.message)
          }

          campaignId = target.id
          assistantReply =
            `Edited **${target.title}**.\n\n` +
            `Changes: ${edited.summary_of_changes}\n\n` +
            `View at /campaigns/${campaignId}.`
        }
      }
    } else {
      const { data: history } = await db
        .from('chat_messages')
        .select('role, content')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: true })
        .limit(20) as { data: ChatHistoryRow[] | null }

      const messages = (history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      assistantReply = await chatWithContext(messages, context)
    }
  } catch (err) {
    console.error('Chat POST error:', err)
    const message = err instanceof Error ? err.message : 'Chat failed'
    return Response.json({ error: message }, { status: 500 })
  }

  await db.from('chat_messages').insert({
    tenant_id: auth.tenantId,
    role: 'assistant',
    content: assistantReply,
    action_type: campaignId ? 'generate_campaign' : null,
    action_meta: campaignId ? { campaign_id: campaignId } : null,
  })

  return Response.json({
    response: assistantReply,
    campaign_id: campaignId,
  })
}

async function handlePlanNextMonth(db: SupabaseClient, tenantId: string): Promise<Response> {
  const planResult = await runMonthPlan(db, { tenantId })
  if (!planResult.ok) {
    const reply =
      planResult.code === 'cap_reached'
        ? MONTHLY_CAP_MESSAGE
        : `Could not plan next month: ${planResult.error}`
    await db.from('chat_messages').insert({
      tenant_id: tenantId,
      role: 'assistant',
      content: reply,
    })
    return Response.json({ response: reply, campaign_id: null }, { status: planResult.status })
  }

  const inserted = planResult.campaigns
  if (inserted.length === 0) {
    const reply = 'No new campaigns were planned (all weekday slots already taken).'
    await db.from('chat_messages').insert({
      tenant_id: tenantId,
      role: 'assistant',
      content: reply,
    })
    return Response.json({ response: reply, campaign_id: null })
  }

  const { data: tenantRow } = await db
    .from('tenants')
    .select('domain, ahrefs_target, brand_voice, competitor_domains, sitemap_url')
    .eq('id', tenantId)
    .single() as {
      data: {
        domain: string | null
        ahrefs_target: string | null
        brand_voice: string | null
        competitor_domains: string[] | null
        sitemap_url: string | null
      } | null
    }

  const domain = tenantRow?.domain || tenantRow?.ahrefs_target || ''
  const internalLinks = await getInternalLinkPool(tenantRow?.sitemap_url)

  const { data: structureTemplates } = await db
    .from('guardrail_templates')
    .select('content_type, template_content')
    .eq('field_name', 'structure') as {
      data: Array<{ content_type: string; template_content: string }> | null
    }

  const templateMap = new Map<string, string>()
  for (const t of structureTemplates || []) {
    templateMap.set(t.content_type, t.template_content)
  }

  const generationResults = await runWithConcurrency(
    inserted,
    GENERATION_CONCURRENCY,
    async (row) =>
      generateCampaignDraft({
        db,
        tenantId,
        campaign: {
          id: row.id,
          title: row.title,
          content_type: row.content_type,
          primary_keyword: row.primary_keyword,
        },
        tenant: {
          domain,
          brand_voice: tenantRow?.brand_voice || null,
          competitor_domains: tenantRow?.competitor_domains || [],
        },
        internalLinks,
        structureTemplate: templateMap.get(row.content_type) || '',
      })
  )

  const succeeded = generationResults.filter((r) => r.ok).length
  const failed = generationResults.length - succeeded
  const monthLabel = new Date(
    Date.UTC(planResult.year, planResult.month - 1, 1)
  ).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const reply =
    `Planned ${inserted.length} campaigns for **${monthLabel}** and auto-generated drafts.\n\n` +
    `Drafts ready: **${succeeded}** / ${inserted.length}.` +
    (failed > 0 ? ` ${failed} failed — retry from the Campaigns page.` : '') +
    `\n\nView all drafts on the Campaigns page.`

  await db.from('chat_messages').insert({
    tenant_id: tenantId,
    role: 'assistant',
    content: reply,
  })

  return Response.json({ response: reply, campaign_id: null })
}
