import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateContent, generateImagePrompt, fetchContentHistory } from '@/lib/api'
import type { ContentRequest, ContentResult } from '@/types'

const CHANNELS = ['instagram', 'facebook', 'blog', 'email', 'landing'] as const
const OBJECTIVES = ['awareness', 'consideration', 'conversion', 'retention'] as const
const TONES = ['friendly', 'professional', 'urgent', 'playful'] as const

export function ContentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">콘텐츠 생성</h1>
      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">생성</TabsTrigger>
          <TabsTrigger value="history">이력</TabsTrigger>
        </TabsList>
        <TabsContent value="generate"><GeneratePanel /></TabsContent>
        <TabsContent value="history"><HistoryPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

function GeneratePanel() {
  const [req, setReq] = useState<ContentRequest>({ channel: 'instagram', objective: 'conversion', tone: 'friendly', variations: 3, theme: '', keywords: '' })
  const [result, setResult] = useState<ContentResult | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)

  const handleGenerate = async () => {
    if (!req.theme) return
    setLoading(true)
    const res = await generateContent(req)
    setResult(res)
    setLoading(false)
  }

  const handleImagePrompt = async () => {
    if (!req.theme) return
    setImgLoading(true)
    const prompt = await generateImagePrompt(req)
    setImagePrompt(prompt)
    setImgLoading(false)
  }

  const update = <K extends keyof ContentRequest>(key: K, value: ContentRequest[K]) => setReq(p => ({ ...p, [key]: value }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader><CardTitle>입력</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>채널</Label>
              <Select value={req.channel} onValueChange={v => update('channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>목표</Label>
              <Select value={req.objective} onValueChange={v => update('objective', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OBJECTIVES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>톤</Label>
              <Select value={req.tone} onValueChange={v => update('tone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>변형 수</Label>
              <Select value={String(req.variations)} onValueChange={v => update('variations', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>테마 / 키워드 *</Label>
            <Input value={req.theme} onChange={e => update('theme', e.target.value)} placeholder="예: 봄 세일, 신제품 출시" />
          </div>
          <div>
            <Label>추가 키워드</Label>
            <Input value={req.keywords ?? ''} onChange={e => update('keywords', e.target.value)} placeholder="쉼표로 구분" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={loading || !req.theme}>{loading ? '생성 중...' : '카피 생성'}</Button>
            <Button variant="outline" onClick={handleImagePrompt} disabled={imgLoading || !req.theme}>{imgLoading ? '생성 중...' : '이미지 프롬프트'}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <Card>
            <CardHeader><CardTitle>생성 결과</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {result.copies.map((copy, i) => (
                <div key={i} className="p-3 bg-muted rounded">
                  <Badge variant="outline" className="mb-1">변형 {i + 1}</Badge>
                  <p className="text-sm mt-1">{copy}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {imagePrompt && (
          <Card>
            <CardHeader><CardTitle>이미지 프롬프트</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={imagePrompt} readOnly className="min-h-[100px]" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function HistoryPanel() {
  const [history, setHistory] = useState<ContentResult[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetchContentHistory().then(setHistory).finally(() => setLoading(false)) }, [])
  if (loading) return <p className="text-muted-foreground py-4">로딩 중...</p>
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>생성 이력</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>채널</TableHead>
              <TableHead>테마</TableHead>
              <TableHead>톤</TableHead>
              <TableHead className="text-right">변형 수</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map(h => (
              <TableRow key={h.id}>
                <TableCell>{new Date(h.created_at).toLocaleDateString('ko-KR')}</TableCell>
                <TableCell><Badge variant="outline">{h.request.channel}</Badge></TableCell>
                <TableCell>{h.request.theme}</TableCell>
                <TableCell>{h.request.tone}</TableCell>
                <TableCell className="text-right">{h.copies.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
