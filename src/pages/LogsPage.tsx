import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const API = 'https://wakalab-media-worker.crabs-ai.workers.dev'

interface ChannelMessage {
  id: number
  channel_id: string
  channel_name: string
  author: string
  author_id: string
  role: string
  content: string
  ts: number
  created_at: string
}

interface SystemLog {
  id: number
  level: string
  source: string
  message: string
  detail: string | null
  ts: number
  created_at: string
}

const CHANNELS = [
  { id: '1486194979545284638', name: '#ceo', color: 'bg-blue-500' },
  { id: '1486231824014245939', name: '#cto', color: 'bg-green-500' },
  { id: '1486210886740738069', name: '#cmo', color: 'bg-purple-500' },
  { id: '1486540773490163906', name: '#원탁회의', color: 'bg-orange-500' },
]

function fmtTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${min}`
}

function levelBadge(level: string) {
  const variants: Record<string, string> = {
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return variants[level] || variants.info
}

export function LogsPage() {
  const [tab, setTab] = useState<'channels' | 'system'>('channels')
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msgTotal, setMsgTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    if (tab === 'channels') {
      const params = new URLSearchParams({ limit: '200' })
      if (selectedChannel) params.set('channel', selectedChannel)
      fetch(`${API}/api/logs/channels?${params}`)
        .then(r => r.json())
        .then(d => {
          setMessages(d.messages ?? [])
          setMsgTotal(d.total ?? 0)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      fetch(`${API}/api/logs/system?limit=200`)
        .then(r => r.json())
        .then(d => setSystemLogs(d.logs ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [tab, selectedChannel])

  // channel counts reserved for future filter badges

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logs</h1>
        <div className="flex gap-2">
          <Button
            variant={tab === 'channels' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('channels')}
          >
            채널 메시지
          </Button>
          <Button
            variant={tab === 'system' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('system')}
          >
            시스템 로그
          </Button>
        </div>
      </div>

      {tab === 'channels' && (
        <>
          {/* Channel Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedChannel === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedChannel(null)}
            >
              전체 ({msgTotal})
            </Button>
            {CHANNELS.map(ch => (
              <Button
                key={ch.id}
                variant={selectedChannel === ch.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedChannel(ch.id)}
              >
                {ch.name}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <span className="animate-pulse">로딩 중...</span>
            </div>
          ) : messages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                메시지가 없다.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">시간</TableHead>
                      <TableHead className="w-[80px]">채널</TableHead>
                      <TableHead className="w-[100px]">발신자</TableHead>
                      <TableHead>내용</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtTime(m.ts)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {m.channel_name || m.channel_id.slice(-4)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {m.role === 'bot' ? '🤖 ' : ''}{m.author}
                        </TableCell>
                        <TableCell className="text-sm max-w-[500px] truncate">
                          {m.content}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'system' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <span className="animate-pulse">로딩 중...</span>
            </div>
          ) : systemLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                시스템 로그가 없다. 크론 실행 / 게이트웨이 에러 발생 시 기록된다.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">시간</TableHead>
                      <TableHead className="w-[60px]">레벨</TableHead>
                      <TableHead className="w-[100px]">소스</TableHead>
                      <TableHead>메시지</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtTime(l.ts)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${levelBadge(l.level)}`}>
                            {l.level}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{l.source}</TableCell>
                        <TableCell className="text-sm max-w-[500px] truncate">
                          {l.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
