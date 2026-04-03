import { Task, SystemStatus, Epic, Story, TaskDetailResponse } from '@/types'

const API = 'https://wakalab-media-worker.kimbang0105.workers.dev'

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API}/api/tasks`)
  if (!res.ok) throw new Error(`Tasks fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.tasks ?? [])
}

export async function fetchEpics(): Promise<Epic[]> {
  const res = await fetch(`${API}/api/epics`)
  if (!res.ok) throw new Error(`Epics fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.epics ?? [])
}

export async function fetchStories(): Promise<Story[]> {
  const res = await fetch(`${API}/api/stories`)
  if (!res.ok) throw new Error(`Stories fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.stories ?? [])
}

export async function fetchTaskDetail(id: string): Promise<TaskDetailResponse> {
  const res = await fetch(`${API}/api/tasks/${id}`)
  if (!res.ok) throw new Error(`Task detail fetch failed: ${res.status}`)
  const data = await res.json()
  const history = (data.history ?? []).map((e: Record<string, string>) => ({
    date: e.created_at ?? e.date ?? '',
    author: e.author ?? '',
    type: e.action ?? e.type ?? 'commented',
    note: e.note ?? '',
  }))
  return { task: data.task, history, story: data.story, epic: data.epic }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API}/api/system-status`)
  if (!res.ok) throw new Error(`System status fetch failed: ${res.status}`)
  const data = await res.json()
  return data.data ?? data
}

import type { AdMetric, Campaign, Creative, UtmParams, Lead, ContentRequest, ContentResult } from '@/types'

export async function fetchAdMetrics(): Promise<AdMetric[]> {
  try {
    const res = await fetch(`${API}/api/metrics`)
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    const metrics = Array.isArray(data) ? data : (data.metrics ?? [])
    // Aggregate metrics by date
    const byDate: Record<string, AdMetric> = {}
    for (const m of metrics) {
      const d = m.date ?? 'unknown'
      if (!byDate[d]) byDate[d] = { date: d, impressions: 0, clicks: 0, ctr: 0, conversions: 0, spend: 0, roas: 0 }
      byDate[d].impressions += m.impressions ?? 0
      byDate[d].clicks += m.clicks ?? 0
      byDate[d].spend += m.spend ?? 0
      byDate[d].conversions += m.conversions ?? 0
    }
    return Object.values(byDate).map(m => ({
      ...m,
      ctr: m.impressions ? (m.clicks / m.impressions * 100) : 0,
      roas: m.spend ? (m.conversions * 10000 / m.spend) : 0,
    })).sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return MOCK_AD_METRICS
  }
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const res = await fetch(`${API}/api/campaigns`)
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.campaigns ?? [])
  } catch {
    return MOCK_CAMPAIGNS
  }
}

export async function fetchCreatives(): Promise<Creative[]> {
  try {
    const res = await fetch(`${API}/api/creatives`)
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.creatives ?? [])
  } catch {
    return MOCK_CREATIVES
  }
}

export async function saveUtm(params: UtmParams): Promise<void> {
  try {
    await fetch(`${API}/api/utm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch { /* ignore */ }
}

export async function fetchLeads(): Promise<Lead[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}leads.json`)
    if (!res.ok) throw new Error('fail')
    const data: Array<{ id: number; name: string; domain?: string; primary_email?: string; location?: string; size?: string; source?: string; profile?: string; website?: string; emails?: string[] }> = await res.json()
    return data.map(d => ({
      id: String(d.id),
      agency: d.name,
      domain: d.domain ?? '',
      email: d.primary_email ?? '',
      region: d.location ?? '',
      size: d.size ?? '',
      clutch_score: 0,
      profile: d.profile ?? '',
      website: d.website ?? '',
      emails: d.emails ?? [],
    }))
  } catch {
    return MOCK_LEADS
  }
}

export async function generateContent(req: ContentRequest): Promise<ContentResult> {
  try {
    const res = await fetch(`${API}/api/content/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error('fail')
    return await res.json()
  } catch {
    return MOCK_CONTENT_RESULT(req)
  }
}

export async function generateImagePrompt(req: ContentRequest): Promise<string> {
  try {
    const res = await fetch(`${API}/api/content/image-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return data.prompt ?? ''
  } catch {
    return `A vibrant ${req.channel} visual for ${req.theme}, ${req.tone} tone, targeting ${req.objective}`
  }
}

export async function fetchContentHistory(): Promise<ContentResult[]> {
  try {
    const res = await fetch(`${API}/api/content/history`)
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.history ?? [])
  } catch {
    return MOCK_CONTENT_HISTORY
  }
}

// Mock data
const MOCK_AD_METRICS: AdMetric[] = [
  { date: '2026-04-01', impressions: 12500, clicks: 380, ctr: 3.04, conversions: 22, spend: 45000, roas: 3.2 },
  { date: '2026-04-02', impressions: 14200, clicks: 420, ctr: 2.96, conversions: 28, spend: 52000, roas: 3.5 },
  { date: '2026-04-03', impressions: 11800, clicks: 350, ctr: 2.97, conversions: 19, spend: 41000, roas: 2.9 },
]

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: '봄 프로모션', status: 'active', objective: 'conversions', start_date: '2026-03-15', end_date: '2026-04-15', spend: 150000, impressions: 45000, clicks: 1200, ctr: 2.67, conversions: 85, roas: 3.8 },
  { id: 'c2', name: '브랜드 인지도', status: 'paused', objective: 'awareness', start_date: '2026-03-01', end_date: '2026-03-31', spend: 80000, impressions: 120000, clicks: 2400, ctr: 2.0, conversions: 30, roas: 1.5 },
]

const MOCK_CREATIVES: Creative[] = [
  { id: 'cr1', name: '봄 배너 A', status: 'active', ctr: 3.2, conversions: 45 },
  { id: 'cr2', name: '봄 배너 B', status: 'active', ctr: 2.8, conversions: 38 },
  { id: 'cr3', name: '동영상 광고 1', status: 'paused', ctr: 4.1, conversions: 52 },
]

const MOCK_LEADS: Lead[] = [
  { id: 'l1', agency: 'ABC Agency', domain: 'abc.com', email: 'contact@abc.com', region: '서울', size: '50-100', clutch_score: 4.8 },
  { id: 'l2', agency: 'XYZ Digital', domain: 'xyz.io', email: '', region: '부산', size: '10-50', clutch_score: 4.2 },
  { id: 'l3', agency: 'Creative Labs', domain: 'clabs.kr', email: 'hello@clabs.kr', region: '서울', size: '100+', clutch_score: 4.9 },
  { id: 'l4', agency: 'Digital Farm', domain: 'dfarm.co', region: '대전', size: '10-50', clutch_score: 3.8 },
  { id: 'l5', agency: 'Growth Co', domain: 'growth.kr', email: 'biz@growth.kr', region: '서울', size: '50-100', clutch_score: 4.5 },
]

const MOCK_CONTENT_RESULT = (req: ContentRequest): ContentResult => ({
  id: `cr-${Date.now()}`,
  copies: [
    `[${req.channel}] ${req.theme} - ${req.tone} 톤 변형 1: 지금 바로 시작하세요!`,
    `[${req.channel}] ${req.theme} - ${req.tone} 톤 변형 2: 놓치지 마세요!`,
    `[${req.channel}] ${req.theme} - ${req.tone} 톤 변형 3: 특별한 기회입니다!`,
  ],
  created_at: new Date().toISOString(),
  request: req,
})

const MOCK_CONTENT_HISTORY: ContentResult[] = [
  { id: 'ch1', copies: ['봄 세일 카피 1', '봄 세일 카피 2'], created_at: '2026-04-01T10:00:00Z', request: { channel: 'instagram', objective: 'conversion', tone: 'friendly', variations: 2, theme: '봄 세일' } },
  { id: 'ch2', copies: ['브랜드 소개 1', '브랜드 소개 2', '브랜드 소개 3'], created_at: '2026-04-02T14:00:00Z', request: { channel: 'blog', objective: 'awareness', tone: 'professional', variations: 3, theme: '브랜드 스토리' } },
]
