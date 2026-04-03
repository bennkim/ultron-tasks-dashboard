import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { fetchTasks, fetchSystemStatus } from '@/lib/api'
import { Task, SystemStatus, KpiStats } from '@/types'

interface HomePageProps {
  onTabChange?: (tab: string) => void
}

const AGENT_META: Record<string, { label: string; emoji: string }> = {
  CEO: { label: 'CEO', emoji: '👔' },
  CTO: { label: 'CTO', emoji: '💻' },
  CMO: { label: 'CMO', emoji: '📣' },
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function truncate(s: string, n = 35): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function computeKpi(tasks: Task[]): KpiStats {
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'DONE').length
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
  const blocked = tasks.filter(t => t.status === 'BLOCKED').length
  const waiting = tasks.filter(t => t.status === 'WAITING').length
  return { total, done, inProgress, blocked, waiting, progressPct: total ? Math.round((done / total) * 100) : 0 }
}

function StatusDot({ status }: { status: 'online' | 'idle' | 'offline' }) {
  const color = status === 'online' ? 'bg-green-500' : status === 'idle' ? 'bg-yellow-400' : 'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1.5`} />
}

export function HomePage({ onTabChange }: HomePageProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchTasks()
        .then(setTasks)
        .catch(e => setTasksError(e.message)),
      fetchSystemStatus()
        .then(setSystemStatus)
        .catch(e => setStatusError(e.message)),
    ]).finally(() => setLoading(false))
  }, [])

  const kpi = computeKpi(tasks)

  const recentDone = [...tasks]
    .filter(t => t.status === 'DONE')
    .sort((a, b) => {
      const da = a.completed_date ?? a.updated_at ?? ''
      const db = b.completed_date ?? b.updated_at ?? ''
      return db.localeCompare(da)
    })
    .slice(0, 15)

  const blockers = tasks.filter(t => t.status === 'BLOCKED')

  const iceRanking = [...tasks]
    .filter(t => t.status !== 'DONE' && (t.ice_score ?? 0) > 0)
    .sort((a, b) => (b.ice_score ?? 0) - (a.ice_score ?? 0))
    .slice(0, 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <span className="animate-pulse">데이터 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">홈</h1>
        <p className="text-sm text-muted-foreground">전체 프로젝트 현황</p>
      </div>

      {/* 1. KPI 카드 */}
      {tasksError ? (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-2">태스크 로딩 실패: {tasksError}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">전체</p>
                <p className="text-2xl font-bold">{kpi.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">완료</p>
                <p className="text-2xl font-bold text-green-600">{kpi.done}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">진행중</p>
                <p className="text-2xl font-bold text-blue-600">{kpi.inProgress}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">블로커</p>
                <p className="text-2xl font-bold text-red-600">{kpi.blocked}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">대기</p>
                <p className="text-2xl font-bold text-yellow-600">{kpi.waiting}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">전체 진행률</span>
                <span className="text-sm text-muted-foreground">{kpi.done}/{kpi.total} ({kpi.progressPct}%)</span>
              </div>
              <Progress value={kpi.progressPct} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. 최근 완료 / 블로커 탭 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">태스크 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="done">
            <TabsList className="mb-3">
              <TabsTrigger value="done">✅ 최근 완료 ({recentDone.length})</TabsTrigger>
              <TabsTrigger value="blocked">🚨 블로커 ({blockers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="done">
              {recentDone.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">완료된 태스크가 없습니다.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentDone.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{t.id}</span>
                      <span className="flex-1 truncate">{truncate(t.title)}</span>
                      {t.owner && <Badge variant="outline" className="text-xs shrink-0">{t.owner}</Badge>}
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.completed_date ?? t.updated_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="blocked">
              {blockers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">블로커가 없습니다. 🎉</p>
              ) : (
                <div className="divide-y divide-border">
                  {blockers.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{t.id}</span>
                      <span className="flex-1 truncate">{truncate(t.title)}</span>
                      {t.owner && <Badge variant="outline" className="text-xs shrink-0">{t.owner}</Badge>}
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.updated_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 3. ICE 우선순위 랭킹 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🔥 ICE 우선순위 Top 10</CardTitle>
        </CardHeader>
        <CardContent>
          {iceRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">ICE 점수가 있는 태스크가 없습니다.</p>
          ) : (
            <div className="divide-y divide-border">
              {iceRanking.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="font-bold text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                  <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{t.id}</span>
                  <span className="flex-1 truncate">{truncate(t.title)}</span>
                  <Badge className="shrink-0 text-xs">{t.ice_score}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. 에이전트 상태 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">🤖 에이전트 상태</CardTitle>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full" title="30분 내 활성 세션이 없으면 offline, cron만 돌면 idle, 활성 세션이 있으면 online">
              기준: 30분 세션 활성
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <p className="text-sm text-destructive">시스템 상태 로딩 실패: {statusError}</p>
          ) : !systemStatus ? (
            <p className="text-sm text-muted-foreground">데이터 없음</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(systemStatus.agents ?? {}).map(([key, agent]) => {
                const meta = AGENT_META[key] ?? { label: key, emoji: '🤖' }
                const status = agent.runtime?.status ?? agent.status
                const detail = agent.runtime?.detail ?? agent.detail
                const timestamp = agent.runtime?.updatedAt ?? agent.runtime?.timestamp ?? agent.lastActivity
                const lastNote = agent.note
                const lastAction = agent.action
                return (
                  <div key={key} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <StatusDot status={status} />
                          <span className="font-medium text-sm">{meta.label}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${status === 'online' ? 'text-green-600 border-green-300' : status === 'idle' ? 'text-yellow-600 border-yellow-300' : 'text-red-600 border-red-300'}`}
                          >
                            {status}
                          </Badge>
                        </div>
                        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(timestamp)}</span>
                    </div>
                    {lastNote && (
                      <div className="mt-2 ml-9 pl-3 border-l-2 border-muted">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {lastAction === 'done' || lastAction === 'completed' ? '✅ 마지막 작업' : '🔄 현재 작업'}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{lastNote}</p>
                      </div>
                    )}
                  </div>
                )
              })}
              {systemStatus.api?.latencyMs !== undefined && (
                <div className="pt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  API 레이턴시: {systemStatus.api.latencyMs}ms
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. 시스템 리소스 */}
      {systemStatus?.storage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📦 시스템 리소스</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>R2 저장소</span>
                <span className="text-muted-foreground">{formatBytes(systemStatus.storage.r2UsageBytes)}</span>
              </div>
              <Progress
                value={Math.min(100, ((systemStatus.storage.r2UsageBytes ?? 0) / (10 * 1024 * 1024 * 1024)) * 100)}
                className="h-1.5"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center p-2 rounded-md bg-muted/40">
                <p className="text-lg font-semibold">{systemStatus.storage.r2FilesCount?.toLocaleString() ?? '—'}</p>
                <p className="text-xs text-muted-foreground">R2 파일</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/40">
                <p className="text-lg font-semibold">{systemStatus.storage.d1RowCount?.toLocaleString() ?? '—'}</p>
                <p className="text-xs text-muted-foreground">D1 행</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/40">
                <p className="text-lg font-semibold text-green-600">{systemStatus.workers?.status ?? 'OK'}</p>
                <p className="text-xs text-muted-foreground">Worker</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. 퀵 링크 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">⚡ 빠른 이동</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onTabChange?.('ad-manager')}>
            Ad Manager 자세히 보기 →
          </Button>
          <Button variant="outline" size="sm" onClick={() => onTabChange?.('ad-manager')}>
            소재 비교탭 열기 →
          </Button>
          <Button variant="outline" size="sm" onClick={() => onTabChange?.('ad-manager')}>
            UTM 빌더 열기 →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
