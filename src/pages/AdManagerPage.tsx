import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchAdMetrics, fetchCampaigns, fetchCreatives, saveUtm } from '@/lib/api'
import type { AdMetric, Campaign, Creative, UtmParams } from '@/types'
import { PerformancePage } from './PerformancePage'

interface AdManagerPageProps {
  subTab?: string
  onSubTabChange?: (tab: string) => void
}

export function AdManagerPage({ subTab, onSubTabChange }: AdManagerPageProps) {
  const activeTab = subTab || 'daily'
  const handleTabChange = (v: string) => onSubTabChange?.(v)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">광고 관리</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="daily">일별 성과</TabsTrigger>
          <TabsTrigger value="campaigns">캠페인</TabsTrigger>
          <TabsTrigger value="creatives">소재 비교</TabsTrigger>
          <TabsTrigger value="utm">UTM 빌더</TabsTrigger>
          <TabsTrigger value="performance">퍼포먼스</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><DailyOverview /></TabsContent>
        <TabsContent value="campaigns"><CampaignList /></TabsContent>
        <TabsContent value="creatives"><CreativeGrid /></TabsContent>
        <TabsContent value="utm"><UtmBuilder /></TabsContent>
        <TabsContent value="performance"><PerformancePage /></TabsContent>
      </Tabs>
    </div>
  )
}

function DailyOverview() {
  const [metrics, setMetrics] = useState<AdMetric[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetchAdMetrics().then(setMetrics).finally(() => setLoading(false)) }, [])
  if (loading) return <p className="text-muted-foreground py-4">로딩 중...</p>
  if (metrics.length === 0) return <p className="text-muted-foreground py-4">데이터 없음</p>
  return (
    <Card>
      <CardHeader><CardTitle>일별 광고 성과</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead className="text-right">노출</TableHead>
              <TableHead className="text-right">클릭</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">전환</TableHead>
              <TableHead className="text-right">비용</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map(m => (
              <TableRow key={m.date}>
                <TableCell>{m.date}</TableCell>
                <TableCell className="text-right">{m.impressions.toLocaleString()}</TableCell>
                <TableCell className="text-right">{m.clicks.toLocaleString()}</TableCell>
                <TableCell className="text-right">{m.ctr.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{m.conversions}</TableCell>
                <TableCell className="text-right">₩{m.spend.toLocaleString()}</TableCell>
                <TableCell className="text-right">{m.roas.toFixed(1)}x</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetchCampaigns().then(setCampaigns).finally(() => setLoading(false)) }, [])
  if (loading) return <p className="text-muted-foreground py-4">로딩 중...</p>
  if (campaigns.length === 0) return <p className="text-muted-foreground py-4">캠페인 없음</p>
  return (
    <Card>
      <CardHeader><CardTitle>캠페인 목록</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>플랫폼</TableHead>
              <TableHead className="text-right">예산</TableHead>
              <TableHead>시작일</TableHead>
              <TableHead>생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                </TableCell>
                <TableCell>{c.platform ?? '-'}</TableCell>
                <TableCell className="text-right">₩{(c.budget ?? 0).toLocaleString()}</TableCell>
                <TableCell>{c.start_date ?? '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.created_at ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CreativeGrid() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetchCreatives().then(setCreatives).finally(() => setLoading(false)) }, [])
  if (loading) return <p className="text-muted-foreground py-4">로딩 중...</p>
  if (creatives.length === 0) return <p className="text-muted-foreground py-4">소재 없음</p>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {creatives.map(c => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium leading-tight">{c.label}</CardTitle>
              <Badge variant={c.status === 'approved' || c.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">{c.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {c.image_url ? (
              <img src={c.image_url} alt={c.label} className="w-full h-40 object-cover rounded mb-3" />
            ) : (
              <div className="w-full h-40 bg-muted rounded mb-3 flex items-center justify-center text-muted-foreground text-sm">미리보기 없음</div>
            )}
            {c.headline && <p className="text-sm font-medium mb-1">{c.headline}</p>}
            {c.copy && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{c.copy}</p>}
            {c.cta && <p className="text-xs text-primary font-medium">{c.cta}</p>}
            {c.utm_url && (
              <a href={c.utm_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-2 block truncate">{c.utm_url}</a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UtmBuilder() {
  const [params, setParams] = useState<UtmParams>({ base_url: '', source: '', medium: '', campaign: '', content: '', term: '' })
  const [copied, setCopied] = useState(false)

  const utmUrl = params.base_url ? (() => {
    try {
      const url = new URL(params.base_url.startsWith('http') ? params.base_url : `https://${params.base_url}`)
      if (params.source) url.searchParams.set('utm_source', params.source)
      if (params.medium) url.searchParams.set('utm_medium', params.medium)
      if (params.campaign) url.searchParams.set('utm_campaign', params.campaign)
      if (params.content) url.searchParams.set('utm_content', params.content)
      if (params.term) url.searchParams.set('utm_term', params.term)
      return url.toString()
    } catch { return '' }
  })() : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(utmUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (params.base_url && params.source) saveUtm(params)
  }

  const update = (key: keyof UtmParams, value: string) => setParams(p => ({ ...p, [key]: value }))

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>UTM 빌더</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Base URL *</Label><Input value={params.base_url} onChange={e => update('base_url', e.target.value)} placeholder="https://example.com" /></div>
          <div><Label>Source *</Label><Input value={params.source} onChange={e => update('source', e.target.value)} placeholder="google, facebook" /></div>
          <div><Label>Medium</Label><Input value={params.medium} onChange={e => update('medium', e.target.value)} placeholder="cpc, email" /></div>
          <div><Label>Campaign</Label><Input value={params.campaign} onChange={e => update('campaign', e.target.value)} placeholder="spring_sale" /></div>
          <div><Label>Content</Label><Input value={params.content} onChange={e => update('content', e.target.value)} placeholder="banner_a" /></div>
          <div><Label>Term</Label><Input value={params.term} onChange={e => update('term', e.target.value)} placeholder="keyword" /></div>
        </div>
        {utmUrl && (
          <div className="space-y-2">
            <Label>생성된 URL</Label>
            <div className="p-3 bg-muted rounded text-sm break-all font-mono">{utmUrl}</div>
            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline" size="sm">{copied ? '✓ 복사됨' : '복사'}</Button>
              <Button onClick={handleSave} size="sm">저장</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
