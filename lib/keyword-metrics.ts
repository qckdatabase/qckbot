import type { SupabaseClient } from '@supabase/supabase-js'

export interface SeoSnapshotKeyword {
  keyword: string
  position?: number
  volume?: number
  difficulty?: number
  url?: string
}

export interface KeywordMetric {
  kd: number | null
  volume: number | null
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normKey(s)
      .split(/\s+/)
      .filter((t) => t.length > 2)
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function toIntOrNull(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.round(n)
}

export function matchKeywordMetric(
  keyword: string,
  snapshot: SeoSnapshotKeyword[],
  threshold = 0.5
): KeywordMetric {
  if (!keyword || snapshot.length === 0) return { kd: null, volume: null }
  const target = normKey(keyword)
  const exact = snapshot.find((k) => k.keyword && normKey(k.keyword) === target)
  if (exact) {
    return { kd: toIntOrNull(exact.difficulty), volume: toIntOrNull(exact.volume) }
  }
  const targetTokens = tokenSet(keyword)
  let bestScore = 0
  let best: SeoSnapshotKeyword | null = null
  for (const sk of snapshot) {
    if (!sk.keyword) continue
    const score = jaccard(targetTokens, tokenSet(sk.keyword))
    if (score > bestScore) {
      bestScore = score
      best = sk
    }
  }
  if (best && bestScore >= threshold) {
    return { kd: toIntOrNull(best.difficulty), volume: toIntOrNull(best.volume) }
  }
  return { kd: null, volume: null }
}

export async function getLatestSeoSnapshot(
  db: SupabaseClient,
  tenantId: string
): Promise<SeoSnapshotKeyword[]> {
  const { data } = await db
    .from('seo_metrics')
    .select('payload')
    .eq('tenant_id', tenantId)
    .not('payload', 'is', null)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: { payload: { keywords?: SeoSnapshotKeyword[] } | null } | null
    }
  return data?.payload?.keywords || []
}
