import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const API = 'https://wakalab-media-worker.kimbang0105.workers.dev'

interface PerfRow {
  campaign_id: string; ad_set_id: string; ad_id: string; ad_name: string; date: string
  impressions: number; reach: number; clicks: number; link_clicks: number
  ctr: number; cpc: number; cpm: number; spend: number
  conversions: number; cpa: number; roas: number; frequency: number
  landing_page_views: number
  quality_ranking?: string; engagement_ranking?: string; conversion_ranking?: string
}

interface AdSet { id: string; campaign_id: string; name: string; status: string; targeting?: string; budget_daily: number }
interface Campaign { id: string; name: string; status: string; platform?: string; budget: number }

function fmt(n: number, decimals = 0): string {
  if (!n) return '0'
  return decimals > 0 ? n.toFixed(decimals) : n.toLocaleString()
}

function fmtKRW(n: number): string {
  if (!n) return '\u20a90'
  return `\u20a9${Math.round(n).toLocaleString()}`
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function aggregate(rows: PerfRow[]) {
  const t = { impressions: 0, reach: 0, clicks: 0, link_clicks: 0, spend: 0, conversions: 0, landing_page_views: 0 }
  for (const r of rows) {
    t.impressions += r.impressions; t.reach += r.reach; t.clicks += r.clicks
    t.link_clicks += r.link_clicks; t.spend += r.spend; t.conversions += r.conversions
    t.landing_page_views += r.landing_page_views
  }
  return {
    ...t,
    ctr: t.impressions ? (t.clicks / t.impressions * 100) : 0,
    cpc: t.clicks ? (t.spend / t.clicks) : 0,
    cpm: t.impressions ? (t.spend / t.impressions * 1000) : 0,
    cpa: t.conversions ? (t.spend / t.conversions) : 0,
    roas: t.spend ? (t.conversions * 10000 / t.spend) : 0,
  }
}

export function PerformancePage() {
  const [perf, setPerf] = useState<PerfRow[]>([])
  const [adSets, setAdSets] = useState<AdSet[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/ad-performance?days=${days}`)
      .then(r => r.json())
      .then(d => {
        setPerf(d.performance ?? [])
        setAdSets(d.ad_sets ?? [])
        setCampaigns((d.campaigns ?? []).filter((c: Campaign) => c.id?.includes('WakaLab') || c.name?.includes('WakaLab')))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const totals = useMemo(() => aggregate(perf), [perf])

  // Build hierarchy: campaign -> adset -> ads
  const hierarchy = useMemo(() => {
    const campMap = new Map<string, { campaign: Campaign; adSets: Map<string, { adSet: AdSet | null; ads: Map<string, PerfRow[]> }> }>()
    for (const c of campaigns) {
      campMap.set(c.id, { campaign: c, adSets: new Map() })
    }
    for (const r of perf) {
      if (!campMap.has(r.campaign_id)) {
        campMap.set(r.campaign_id, { campaign: { id: r.campaign_id, name: r.campaign_id, status: 'unknown', budget: 0 }, adSets: new Map() })
      }
      const camp = campMap.get(r.campaign_id)!
      const setId = r.ad_set_id || 'no-adset'
      if (!camp.adSets.has(setId)) {
        const adSetObj = adSets.find(s => s.id === setId) || null
        camp.adSets.set(setId, { adSet: adSetObj, ads: new Map() })
      }
      const adSetEntry = camp.adSets.get(setId)!
      if (!adSetEntry.ads.has(r.ad_id)) adSetEntry.ads.set(r.ad_id, [])
      adSetEntry.ads.get(r.ad_id)!.push(r)
    }
    return campMap
  }, [perf, campaigns, adSets])

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><span className="animate-pulse">데이터 로딩 중...</span></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">광고 퍼포먼스</h1>
          <p className="text-sm text-muted-foreground">act_1591471198924948 · WakaLab 캠페인</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
              {d}일
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard label="노출" value={fmt(totals.impressions)} />
        <MetricCard label="클릭" value={fmt(totals.clicks)} />
        <MetricCard label="CTR" value={fmt(totals.ctr, 2) + '%'} />
        <MetricCard label="CPC" value={fmtKRW(totals.cpc)} />
        <MetricCard label="지출" value={fmtKRW(totals.spend)} />
        <MetricCard label="전환" value={fmt(totals.conversions)} />
        <MetricCard label="ROAS" value={fmt(totals.roas, 1) + 'x'} />
      </div>

      {/* Hierarchy: Campaign -> AdSet -> Ad */}
      {perf.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          퍼포먼스 데이터가 없습니다. CMO가 데이터를 수집하면 여기에 표시됩니다.
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" defaultValue={Array.from(hierarchy.keys())}>
          {Array.from(hierarchy.entries()).map(([campId, { campaign, adSets: adSetMap }]) => {
            const campRows = perf.filter(r => r.campaign_id === campId)
            const campAgg = aggregate(campRows)
            return (
              <AccordionItem key={campId} value={campId}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full pr-4">
                    <span className="text-sm font-semibold">{campaign.name}</span>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="text-xs">{campaign.status}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmt(campAgg.impressions)} 노출 · {fmt(campAgg.clicks)} 클릭 · {fmtKRW(campAgg.spend)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-4 space-y-4">
                    {Array.from(adSetMap.entries()).map(([setId, { adSet, ads }]) => {
                      const setRows = perf.filter(r => r.campaign_id === campId && (r.ad_set_id || 'no-adset') === setId)
                      const setAgg = aggregate(setRows)
                      return (
                        <Card key={setId}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{adSet?.name || setId}</CardTitle>
                              {adSet && <Badge variant="outline" className="text-xs">{adSet.status}</Badge>}
                              {adSet?.budget_daily ? <span className="text-xs text-muted-foreground ml-auto">일예산: {fmtKRW(adSet.budget_daily)}</span> : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fmt(setAgg.impressions)} 노출 · CTR {fmt(setAgg.ctr, 2)}% · CPC {fmtKRW(setAgg.cpc)} · {fmtKRW(setAgg.spend)} 지출
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>광고</TableHead>
                                  <TableHead>날짜</TableHead>
                                  <TableHead className="text-right">노출</TableHead>
                                  <TableHead className="text-right">클릭</TableHead>
                                  <TableHead className="text-right">CTR</TableHead>
                                  <TableHead className="text-right">CPC</TableHead>
                                  <TableHead className="text-right">CPM</TableHead>
                                  <TableHead className="text-right">지출</TableHead>
                                  <TableHead className="text-right">전환</TableHead>
                                  <TableHead className="text-right">CPA</TableHead>
                                  <TableHead className="text-right">ROAS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Array.from(ads.entries()).flatMap(([adId, rows]) =>
                                  [...rows].sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
                                    <TableRow key={`${adId}-${i}`}>
                                      <TableCell className="font-medium text-sm">{r.ad_name || r.ad_id}</TableCell>
                                      <TableCell className="text-sm">{r.date}</TableCell>
                                      <TableCell className="text-right">{fmt(r.impressions)}</TableCell>
                                      <TableCell className="text-right">{fmt(r.clicks)}</TableCell>
                                      <TableCell className="text-right">{fmt(r.ctr, 2)}%</TableCell>
                                      <TableCell className="text-right">{fmtKRW(r.cpc)}</TableCell>
                                      <TableCell className="text-right">{fmtKRW(r.cpm)}</TableCell>
                                      <TableCell className="text-right">{fmtKRW(r.spend)}</TableCell>
                                      <TableCell className="text-right">{fmt(r.conversions)}</TableCell>
                                      <TableCell className="text-right">{fmtKRW(r.cpa)}</TableCell>
                                      <TableCell className="text-right">{fmt(r.roas, 1)}x</TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
