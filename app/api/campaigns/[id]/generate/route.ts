import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { generateCounterCampaign } from '@/lib/ai-campaign'
import { getInternalLinkPool } from '@/lib/sitemap'

export const maxDuration = 180

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()

  const { data: campaign, error: fetchErr } = await db
    .from('campaigns')
    .select('id, tenant_id, title, content_type, primary_keyword, status')
    .eq('id', params.id)
    .eq('tenant_id', auth.tenantId)
    .single() as {
      data:
        | { id: string; tenant_id: string; title: string; content_type: string; primary_keyword: string | null; status: string }
        | null
      error: { message: string } | null
    }

  if (fetchErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (!campaign.primary_keyword) {
    return NextResponse.json({ error: 'Campaign has no primary_keyword' }, { status: 400 })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('domain, ahrefs_target, brand_voice, competitor_domains, sitemap_url')
    .eq('id', auth.tenantId)
    .single() as {
      data:
        | {
            domain: string | null
            ahrefs_target: string | null
            brand_voice: string | null
            competitor_domains: string[] | null
            sitemap_url: string | null
          }
        | null
    }

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const domain = tenant.domain || tenant.ahrefs_target || ''

  const { data: structureTemplate } = await db
    .from('guardrail_templates')
    .select('template_content')
    .eq('content_type', campaign.content_type)
    .eq('field_name', 'structure')
    .maybeSingle() as { data: { template_content: string } | null }

  await db
    .from('campaigns')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', campaign.id)

  try {
    const internalLinks = await getInternalLinkPool(tenant.sitemap_url)

    const result = await generateCounterCampaign({
      tenant: {
        domain,
        brand_voice: tenant.brand_voice || null,
        competitor_domains: tenant.competitor_domains || [],
      },
      contentType: campaign.content_type,
      primaryKeyword: campaign.primary_keyword,
      title: campaign.title,
      guardrailTemplate: structureTemplate?.template_content || '',
      internalLinks,
    })

    const { error: updateErr } = await db
      .from('campaigns')
      .update({
        generated_content: result.content,
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaign.id,
      competitor_reference: result.competitor_reference,
    })
  } catch (err) {
    await db
      .from('campaigns')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)

    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
