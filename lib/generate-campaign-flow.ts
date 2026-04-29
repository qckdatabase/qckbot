import type { SupabaseClient } from '@supabase/supabase-js'
import { generateCounterCampaign, type InternalLinkPool } from '@/lib/ai-campaign'

export interface GenerateCampaignArgs {
  db: SupabaseClient
  tenantId: string
  campaign: {
    id: string
    title: string
    content_type: string
    primary_keyword: string
  }
  tenant: {
    domain: string
    brand_voice: string | null
    competitor_domains: string[] | null
  }
  internalLinks: InternalLinkPool
  structureTemplate: string
}

export interface GenerateCampaignResult {
  ok: boolean
  campaignId: string
  error?: string
}

export async function generateCampaignDraft(
  args: GenerateCampaignArgs
): Promise<GenerateCampaignResult> {
  const { db, tenantId, campaign, tenant, internalLinks, structureTemplate } = args

  await db
    .from('campaigns')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', campaign.id)
    .eq('tenant_id', tenantId)

  try {
    const result = await generateCounterCampaign({
      tenant: {
        domain: tenant.domain,
        brand_voice: tenant.brand_voice,
        competitor_domains: tenant.competitor_domains || [],
      },
      contentType: campaign.content_type,
      primaryKeyword: campaign.primary_keyword,
      title: campaign.title,
      guardrailTemplate: structureTemplate,
      internalLinks,
    })

    const { error } = await db
      .from('campaigns')
      .update({
        generated_content: result.content,
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId)

    if (error) {
      return { ok: false, campaignId: campaign.id, error: error.message }
    }
    return { ok: true, campaignId: campaign.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    await db
      .from('campaigns')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId)
    return { ok: false, campaignId: campaign.id, error: message }
  }
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workerCount = Math.min(limit, items.length)
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}
