import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchLeads } from '@/lib/api'
import type { Lead } from '@/types'

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'has-email' | 'no-email'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchLeads().then(setLeads).finally(() => setLoading(false)) }, [])

  const filtered = useMemo(() => {
    let result = leads
    if (filter === 'has-email') result = result.filter(l => l.email)
    if (filter === 'no-email') result = result.filter(l => !l.email)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l => l.agency.toLowerCase().includes(q) || l.domain?.toLowerCase().includes(q) || l.region?.toLowerCase().includes(q))
    }
    return result
  }, [leads, filter, search])

  const totalCount = leads.length
  const hasEmail = leads.filter(l => l.email).length
  const noEmail = totalCount - hasEmail

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">리드 관리</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">전체 리드</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{totalCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">이메일 있음</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">{hasEmail}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">이메일 없음</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-orange-500">{noEmail}</p></CardContent></Card>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Input placeholder="검색 (업체명, 도메인, 지역)" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="has-email">이메일 있음</TabsTrigger>
            <TabsTrigger value="no-email">이메일 없음</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {loading ? <p className="text-muted-foreground">로딩 중...</p> : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>도메인</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>규모</TableHead>
                  <TableHead className="text-right">Clutch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.agency}</TableCell>
                    <TableCell>{l.domain ?? '-'}</TableCell>
                    <TableCell>{l.email || <span className="text-muted-foreground">없음</span>}</TableCell>
                    <TableCell>{l.region ?? '-'}</TableCell>
                    <TableCell>{l.size ?? '-'}</TableCell>
                    <TableCell className="text-right">{l.clutch_score?.toFixed(1) ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
