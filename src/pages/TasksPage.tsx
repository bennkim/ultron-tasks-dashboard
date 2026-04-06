import { useEffect, useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { fetchEpics, fetchStories, fetchTasks, fetchTaskDetail } from '@/lib/api'
import { Epic, Story, Task, TaskDetailResponse } from '@/types'

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_EMOJI: Record<string, string> = {
  DONE: '✅', IN_PROGRESS: '🔄', BLOCKED: '🚨', TODO: '📋', BACKLOG: '📦', REVIEW: '👀', WAITING: '⏳',
}
const STATUS_CLASS: Record<string, string> = {
  DONE: 'bg-green-100 text-green-800 border-green-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  BLOCKED: 'bg-red-100 text-red-800 border-red-200',
  TODO: 'bg-gray-100 text-gray-700 border-gray-200',
  BACKLOG: 'bg-slate-100 text-slate-500 border-slate-200',
  REVIEW: 'bg-purple-100 text-purple-800 border-purple-200',
  WAITING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}
const ICE_CLASS = (score?: number) => {
  if (!score || score === 0) return 'text-muted-foreground'
  if (score >= 80) return 'text-red-600 font-bold'
  if (score >= 50) return 'text-orange-500 font-semibold'
  return 'text-yellow-600'
}

const HISTORY_EMOJI: Record<string, string> = {
  created: '🆕', started: '🚀', progress: '🔄', done: '✅', completed: '✅',
  blocked: '🚨', reopened: '🔓', commented: '💬', assigned: '👤',
}

const HISTORY_DOT_CLASS: Record<string, string> = {
  created: 'bg-blue-500', started: 'bg-blue-500', progress: 'bg-blue-500',
  done: 'bg-green-500', completed: 'bg-green-500',
  blocked: 'bg-red-500', reopened: 'bg-gray-400', commented: 'bg-gray-400', assigned: 'bg-gray-400',
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
const PRIORITY_EMOJI: Record<string, string> = { P0: '🔴', P1: '🟠', P2: '🟡', P3: '⚪' }

// ─── Sort helpers ─────────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc'
type SortState<K extends string> = { key: K; dir: SortDir }

function toggleSort<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: 'asc' }
}

function SortHeader<K extends string>({ label, sortKey, current, onSort }: {
  label: string; sortKey: K; current: SortState<K>; onSort: (k: K) => void
}) {
  const active = current.key === sortKey
  return (
    <th
      className="py-1.5 px-2 text-left font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (current.dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

// ─── localStorage red-dot helpers ────────────────────────────────────────────
function getReadMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('taskReadMap') ?? '{}') } catch { return {} }
}
function markRead(id: string) {
  const m = getReadMap()
  m[id] = new Date().toISOString().slice(0, 10)
  localStorage.setItem('taskReadMap', JSON.stringify(m))
}
function hasUnread(id: string, latestDate?: string): boolean {
  if (!latestDate) return false
  const m = getReadMap()
  return !m[id] || m[id] < latestDate
}

// ─── Sub-tab types ────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'epics' | 'stories'
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: '📋 태스크 보드' },
  { id: 'epics', label: '🎯 에픽 목록' },
  { id: 'stories', label: '📖 스토리 목록' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// EPICS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
type EpicSortKey = 'id' | 'title' | 'status' | 'priority' | 'owner' | 'created_at'

function EpicDetailModal({ epic, stories, tasks, open, onClose }: {
  epic: Epic | null; stories: Story[]; tasks: Task[]; open: boolean; onClose: () => void
}) {
  if (!epic) return null
  const epicStories = stories.filter(s => s.epic_id === epic.id)
  const epicTasks = tasks.filter(t => t.epic_id === epic.id || epicStories.some(s => s.id === t.story_id))
  const done = epicTasks.filter(t => t.status === 'DONE').length
  const pct = epicTasks.length > 0 ? Math.round((done / epicTasks.length) * 100) : 0
  const statusCls = STATUS_CLASS[epic.status ?? 'TODO'] ?? STATUS_CLASS.TODO

  function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
    if (!value) return null
    return (
      <div className={full ? 'col-span-2' : ''}>
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm break-words whitespace-pre-wrap">{value}</div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold pr-8">
            {epic.id} — {epic.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${statusCls}`}>
              {STATUS_EMOJI[epic.status ?? 'TODO'] ?? ''} {epic.status ?? 'TODO'}
            </span>
            {epic.priority && (
              <span className="text-xs px-2 py-1 rounded bg-muted font-medium">
                {PRIORITY_EMOJI[epic.priority] ?? ''} {epic.priority}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
              {done}/{epicTasks.length} 완료 ({pct}%)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/10">
            <Field label="목표 (Goal)" value={epic.goal} full />
            <Field label="담당 (Owner)" value={epic.owner} />
            <Field label="생성일" value={epic.created_at?.slice(0, 16)} />
            <Field label="수정일" value={epic.updated_at?.slice(0, 16)} />
            <Field label="📝 노트" value={epic.notes} full />
            <Field label="📋 컨텍스트" value={epic.context} full />
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">스토리 ({epicStories.length}개)</div>
            {epicStories.length === 0 ? (
              <p className="text-sm text-muted-foreground">스토리 없음</p>
            ) : (
              <div className="space-y-1">
                {epicStories.map(s => {
                  const sTasks = tasks.filter(t => t.story_id === s.id)
                  const sDone = sTasks.filter(t => t.status === 'DONE').length
                  const sCls = STATUS_CLASS[s.status ?? 'TODO'] ?? STATUS_CLASS.TODO
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                      <span className="flex-1 truncate">{s.title}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${sCls}`}>
                        {STATUS_EMOJI[s.status ?? 'TODO'] ?? ''} {s.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{sDone}/{sTasks.length}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StoryDetailModal({ story, epic, tasks, open, onClose }: {
  story: Story | null; epic?: Epic; tasks: Task[]; open: boolean; onClose: () => void
}) {
  if (!story) return null
  const storyTasks = tasks.filter(t => t.story_id === story.id)
  const done = storyTasks.filter(t => t.status === 'DONE').length
  const pct = storyTasks.length > 0 ? Math.round((done / storyTasks.length) * 100) : 0
  const statusCls = STATUS_CLASS[story.status ?? 'TODO'] ?? STATUS_CLASS.TODO

  function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
    if (!value) return null
    return (
      <div className={full ? 'col-span-2' : ''}>
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm break-words whitespace-pre-wrap">{value}</div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold pr-8">
            {story.id} — {story.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${statusCls}`}>
              {STATUS_EMOJI[story.status ?? 'TODO'] ?? ''} {story.status ?? 'TODO'}
            </span>
            {epic && (
              <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {epic.id} {epic.title}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
              {done}/{storyTasks.length} 완료 ({pct}%)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/10">
            <Field label="담당 (Owner)" value={story.owner} />
            <Field label="생성일" value={story.created_at?.slice(0, 16)} />
            <Field label="수정일" value={story.updated_at?.slice(0, 16)} />
            <Field label="📝 노트" value={story.notes} full />
            <Field label="📋 컨텍스트" value={story.context} full />
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">태스크 ({storyTasks.length}개)</div>
            {storyTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">태스크 없음</p>
            ) : (
              <div className="space-y-1">
                {storyTasks.map(t => {
                  const tCls = STATUS_CLASS[t.status] ?? STATUS_CLASS.TODO
                  return (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${tCls}`}>
                        {STATUS_EMOJI[t.status] ?? ''} {t.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{t.owner ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EpicsTable({ epics, allStories, allTasks, onSelectEpic }: {
  epics: Epic[]; allStories: Story[]; allTasks: Task[]; onSelectEpic: (e: Epic) => void
}) {
  const [sort, setSort] = useState<SortState<EpicSortKey>>({ key: 'priority', dir: 'asc' })

  const sorted = useMemo(() => {
    const arr = [...epics]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'id': cmp = a.id.localeCompare(b.id); break
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'status': cmp = (a.status ?? '').localeCompare(b.status ?? ''); break
        case 'priority': {
          const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 99
          const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 99
          cmp = pa - pb || a.id.localeCompare(b.id)
          break
        }
        case 'owner': cmp = (a.owner ?? '').localeCompare(b.owner ?? ''); break
        case 'created_at': cmp = (a.created_at ?? '').localeCompare(b.created_at ?? ''); break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [epics, sort])

  const onSort = useCallback((k: EpicSortKey) => setSort(s => toggleSort(s, k)), [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <SortHeader label="ID" sortKey="id" current={sort} onSort={onSort} />
            <SortHeader label="에픽명" sortKey="title" current={sort} onSort={onSort} />
            <SortHeader label="상태" sortKey="status" current={sort} onSort={onSort} />
            <SortHeader label="우선순위" sortKey="priority" current={sort} onSort={onSort} />
            <SortHeader label="담당" sortKey="owner" current={sort} onSort={onSort} />
            <th className="py-1.5 px-2 text-left font-medium">스토리</th>
            <th className="py-1.5 px-2 text-left font-medium">태스크</th>
            <th className="py-1.5 px-2 text-left font-medium">진행률</th>
            <SortHeader label="생성일" sortKey="created_at" current={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map(e => {
            const stories = allStories.filter(s => s.epic_id === e.id)
            const tasks = allTasks.filter(t => t.epic_id === e.id || stories.some(s => s.id === t.story_id))
            const done = tasks.filter(t => t.status === 'DONE').length
            const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
            const statusCls = STATUS_CLASS[e.status ?? 'TODO'] ?? STATUS_CLASS.TODO
            return (
              <tr key={e.id} className="hover:bg-muted/30 text-sm transition-colors cursor-pointer" onClick={() => onSelectEpic(e)}>
                <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{e.id}</td>
                <td className="py-2 px-2 font-medium">{e.title}</td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusCls}`}>
                    {STATUS_EMOJI[e.status ?? 'TODO'] ?? ''} {e.status ?? 'TODO'}
                  </span>
                </td>
                <td className="py-2 px-2 text-sm">
                  {e.priority ? <span>{PRIORITY_EMOJI[e.priority] ?? ''} {e.priority}</span> : '—'}
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{e.owner ?? '—'}</td>
                <td className="py-2 px-2 text-xs">{stories.length}</td>
                <td className="py-2 px-2 text-xs">{done}/{tasks.length}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{(e.created_at ?? '').slice(0, 10)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORIES TABLE
// ═══════════════════════════════════════════════════════════════════════════════
type StorySortKey = 'id' | 'title' | 'status' | 'epic_id' | 'owner' | 'created_at'

function StoriesTable({ stories, allTasks, epics, onSelectStory }: {
  stories: Story[]; allTasks: Task[]; epics: Epic[]; onSelectStory: (s: Story) => void
}) {
  const [sort, setSort] = useState<SortState<StorySortKey>>({ key: 'epic_id', dir: 'asc' })

  const epicMap = useMemo(() => {
    const m: Record<string, Epic> = {}
    epics.forEach(e => { m[e.id] = e })
    return m
  }, [epics])

  const sorted = useMemo(() => {
    const arr = [...stories]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'id': cmp = a.id.localeCompare(b.id); break
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'status': cmp = (a.status ?? '').localeCompare(b.status ?? ''); break
        case 'epic_id': cmp = (a.epic_id ?? '').localeCompare(b.epic_id ?? '') || a.id.localeCompare(b.id); break
        case 'owner': cmp = (a.owner ?? '').localeCompare(b.owner ?? ''); break
        case 'created_at': cmp = (a.created_at ?? '').localeCompare(b.created_at ?? ''); break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [stories, sort])

  const onSort = useCallback((k: StorySortKey) => setSort(s => toggleSort(s, k)), [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <SortHeader label="ID" sortKey="id" current={sort} onSort={onSort} />
            <SortHeader label="스토리명" sortKey="title" current={sort} onSort={onSort} />
            <SortHeader label="에픽" sortKey="epic_id" current={sort} onSort={onSort} />
            <SortHeader label="상태" sortKey="status" current={sort} onSort={onSort} />
            <SortHeader label="담당" sortKey="owner" current={sort} onSort={onSort} />
            <th className="py-1.5 px-2 text-left font-medium">태스크</th>
            <th className="py-1.5 px-2 text-left font-medium">진행률</th>
            <SortHeader label="생성일" sortKey="created_at" current={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map(s => {
            const tasks = allTasks.filter(t => t.story_id === s.id)
            const done = tasks.filter(t => t.status === 'DONE').length
            const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
            const statusCls = STATUS_CLASS[s.status ?? 'TODO'] ?? STATUS_CLASS.TODO
            const epic = epicMap[s.epic_id ?? '']
            return (
              <tr key={s.id} className="hover:bg-muted/30 text-sm transition-colors cursor-pointer" onClick={() => onSelectStory(s)}>
                <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{s.id}</td>
                <td className="py-2 px-2 font-medium">{s.title}</td>
                <td className="py-2 px-2 text-xs">
                  {epic ? (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {epic.id} {epic.title.slice(0, 20)}{epic.title.length > 20 ? '…' : ''}
                    </span>
                  ) : (s.epic_id ?? '—')}
                </td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusCls}`}>
                    {STATUS_EMOJI[s.status ?? 'TODO'] ?? ''} {s.status ?? 'TODO'}
                  </span>
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{s.owner ?? '—'}</td>
                <td className="py-2 px-2 text-xs">{done}/{tasks.length}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{(s.created_at ?? '').slice(0, 10)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK ROW (existing)
// ═══════════════════════════════════════════════════════════════════════════════
function TaskRow({
  task, latestHistoryDate, onOpen,
}: {
  task: Task
  latestHistoryDate?: string
  onOpen: (id: string) => void
}) {
  const statusCls = STATUS_CLASS[task.status] ?? STATUS_CLASS.TODO
  const unread = hasUnread(task.id, latestHistoryDate)
  const dateStr = (task.completed_date ?? task.updated_at ?? '').slice(5, 10)

  return (
    <tr
      className="hover:bg-muted/30 cursor-pointer text-sm transition-colors"
      onClick={() => onOpen(task.id)}
    >
      <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
        <span className="relative inline-flex items-center gap-1">
          {task.id}
          {unread && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 absolute -top-0.5 -right-2" />
          )}
        </span>
      </td>
      <td className="py-1.5 px-2 text-left flex-1 min-w-0">
        <span className="line-clamp-2">{task.title}</span>
      </td>
      <td className="py-1.5 px-2 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusCls}`}>
          {STATUS_EMOJI[task.status] ?? ''} {task.status}
        </span>
      </td>
      <td className="py-1.5 px-2 text-xs text-muted-foreground whitespace-nowrap">{task.owner ?? '—'}</td>
      <td className={`py-1.5 px-2 text-xs text-right whitespace-nowrap ${ICE_CLASS(task.ice_score)}`}>
        {task.ice_score && task.ice_score > 0 ? task.ice_score : '—'}
      </td>
      <td className="py-1.5 px-2 text-xs text-muted-foreground text-center whitespace-nowrap">{dateStr || '—'}</td>
    </tr>
  )
}

// ─── Story section ────────────────────────────────────────────────────────────
function StorySection({
  story, ownerFilter, latestDates, onOpen,
}: {
  story: Story
  ownerFilter: string
  latestDates: Record<string, string>
  onOpen: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const tasks = (story.tasks ?? []).filter(t =>
    ownerFilter === 'all' || (t.owner ?? '').includes(ownerFilter)
  )
  if (tasks.length === 0) return null

  const done = tasks.filter(t => t.status === 'DONE').length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
  const statusCls = STATUS_CLASS[story.status] ?? STATUS_CLASS.TODO

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-1">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 bg-muted/20 hover:bg-muted/40 rounded text-sm text-left transition-colors group">
        <span className={`transition-transform duration-200 text-muted-foreground text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-mono text-xs text-muted-foreground">{story.id}</span>
        <span className="font-medium flex-1 truncate">{story.title}</span>
        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusCls}`}>
          {STATUS_EMOJI[story.status] ?? ''} {story.status}
        </span>
        <span className="text-xs text-muted-foreground">{done}/{tasks.length}</span>
        <div className="w-16 hidden sm:block">
          <Progress value={pct} className="h-1" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-0.5">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-1 px-2 text-left font-medium">Task</th>
                <th className="py-1 px-2 text-left font-medium">제목</th>
                <th className="py-1 px-2 text-left font-medium">상태</th>
                <th className="py-1 px-2 text-left font-medium">담당</th>
                <th className="py-1 px-2 text-right font-medium">ICE</th>
                <th className="py-1 px-2 text-center font-medium">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {tasks.map(t => (
                <TaskRow key={t.id} task={t} latestHistoryDate={latestDates[t.id]} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Epic section ────────────────────────────────────────────────────────────
function EpicSection({
  epic, ownerFilter, latestDates, onOpen,
}: {
  epic: Epic
  ownerFilter: string
  latestDates: Record<string, string>
  onOpen: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const allTasks = (epic.stories ?? []).flatMap(s => s.tasks ?? [])
  const visibleTasks = allTasks.filter(t =>
    ownerFilter === 'all' || (t.owner ?? '').includes(ownerFilter)
  )
  if (visibleTasks.length === 0) return null

  const done = allTasks.filter(t => t.status === 'DONE').length
  const pct = allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg overflow-hidden mb-3">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 bg-muted/10 hover:bg-muted/20 text-left transition-colors">
        <span className={`transition-transform duration-200 text-muted-foreground text-xs font-bold ${open ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-mono text-xs text-muted-foreground">{epic.id}</span>
        <span className="font-semibold flex-1 truncate">{epic.title}</span>
        {epic.priority && (
          <span className="text-sm">{PRIORITY_EMOJI[epic.priority] ?? ''} {epic.priority}</span>
        )}
        {epic.status && (
          <span className="text-xs text-muted-foreground">{epic.status}</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Progress value={pct} className="h-1.5 w-20 hidden sm:block" />
          <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
          <span className="text-xs text-muted-foreground">({done}/{allTasks.length})</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-2 space-y-1">
          {(epic.stories ?? []).map(s => (
            <StorySection
              key={s.id}
              story={s}
              ownerFilter={ownerFilter}
              latestDates={latestDates}
              onOpen={onOpen}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({
  taskId, open, onClose,
}: {
  taskId: string | null
  open: boolean
  onClose: () => void
}) {
  const [detail, setDetail] = useState<TaskDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId || !open) return
    setLoading(true)
    setDetail(null)
    setError(null)
    fetchTaskDetail(taskId)
      .then(d => { setDetail(d); markRead(taskId) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [taskId, open])

  const t = detail?.task

  function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
    if (!value) return null
    return (
      <div className={full ? 'col-span-2' : ''}>
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm break-words">{value}</div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold pr-8">
            {t ? `${t.id} — ${t.title}` : (taskId ?? '로딩 중...')}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-muted-foreground animate-pulse text-sm">로딩 중...</div>
        )}
        {error && (
          <div className="py-4 text-center text-destructive text-sm">❌ 로드 실패: {error}</div>
        )}

        {t && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${STATUS_CLASS[t.status] ?? STATUS_CLASS.TODO}`}>
                {STATUS_EMOJI[t.status] ?? ''} {t.status}
              </span>
              {t.ice_score && t.ice_score > 0 && (
                <span className={`text-xs px-2 py-1 rounded bg-muted font-medium ${ICE_CLASS(t.ice_score)}`}>
                  ICE {t.ice_score}
                </span>
              )}
              {detail?.epic && (
                <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {detail.epic.id} {detail.epic.title}
                </span>
              )}
              {detail?.story && (
                <span className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
                  {detail.story.id}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/10">
              <Field label="요청자 (Owner)" value={t.owner} />
              <Field label="작업자 (Assignee)" value={t.assignee} />
              <Field label="착수일" value={t.started_at} />
              <Field label="완료일" value={t.completed_date} />
              <Field label="생성일" value={t.created_at?.slice(0, 16)} />
              <Field label="수정일" value={t.updated_at?.slice(0, 16)} />
              <Field label="🚨 블로커 사유" value={t.blocked_reason} full />
              {t.related_commit && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-0.5">관련 커밋/PR</div>
                  {t.related_commit.startsWith('http') ? (
                    <a href={t.related_commit} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                      {t.related_commit}
                    </a>
                  ) : (
                    <div className="text-sm font-mono text-xs bg-muted px-2 py-1 rounded">{t.related_commit}</div>
                  )}
                </div>
              )}
              <Field label="✅ 완료 조건" value={t.completion_criteria} full />
              <Field label="📝 메모" value={t.notes} full />
              {t.description && t.description !== t.title && (
                <Field label="상세 설명" value={t.description} full />
              )}
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">히스토리</div>
              {!detail?.history?.length ? (
                <p className="text-sm text-muted-foreground">📝 기록 없음</p>
              ) : (
                <div className="space-y-3">
                  {detail.history.map((e, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${HISTORY_DOT_CLASS[e.type] ?? 'bg-gray-300'}`}>
                          {HISTORY_EMOJI[e.type] ?? '📝'}
                        </div>
                        {i < (detail.history?.length ?? 0) - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-1 min-h-[8px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="text-xs text-muted-foreground mb-0.5">
                          {e.date} · {e.author}
                        </div>
                        {e.note && <div className="text-sm">{e.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Owner Filters ────────────────────────────────────────────────────────────
const OWNER_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'CEO', label: '🤖 CEO' },
  { id: 'CMO', label: '🎯 CMO' },
  { id: 'CTO', label: '💻 CTO' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function TasksPage() {
  const [rawEpics, setRawEpics] = useState<Epic[]>([])
  const [rawStories, setRawStories] = useState<Story[]>([])
  const [rawTasks, setRawTasks] = useState<Task[]>([])
  const [enrichedEpics, setEnrichedEpics] = useState<Epic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [latestDates, setLatestDates] = useState<Record<string, string>>({})
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null)
  const [epicModalOpen, setEpicModalOpen] = useState(false)
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [storyModalOpen, setStoryModalOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEpics(), fetchStories(), fetchTasks()])
      .then(([epicsData, storiesData, tasksData]) => {
        setRawEpics(epicsData)
        setRawStories(storiesData)
        setRawTasks(tasksData)
        const enriched = epicsData.map(epic => ({
          ...epic,
          stories: storiesData
            .filter(s => s.epic_id === epic.id)
            .map(story => ({
              ...story,
              tasks: tasksData.filter(t => t.story_id === story.id),
            })),
        }))
        setEnrichedEpics(enriched)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    fetch('https://wakalab-media-worker.kimbang0105.workers.dev/api/history')
      .then(r => r.json())
      .then((data: { history?: Record<string, Array<{ date?: string; created_at?: string }>> }) => {
        const hist: Record<string, Array<{ date?: string; created_at?: string }>> = data.history ?? {}
        const latest: Record<string, string> = {}
        Object.entries(hist).forEach(([id, entries]) => {
          latest[id] = entries.reduce((m, e) => {
            const d = e.created_at ?? e.date ?? ''
            return d > m ? d : m
          }, '')
        })
        setLatestDates(latest)
      })
      .catch(() => {})
  }, [])

  const openModal = useCallback((id: string) => {
    setSelectedTaskId(id)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  const unreadCount = Object.entries(latestDates).filter(([id, date]) => hasUnread(id, date)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <span className="animate-pulse">데이터 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-3">
        ❌ 로딩 실패: {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Tasks</h1>
          <p className="text-sm text-muted-foreground">태스크 관리 — 에픽 &gt; 스토리 &gt; 태스크</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">{unreadCount} 새 업데이트</Badge>
        )}
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-1 border-b border-border">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              subTab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Epics tab */}
      {subTab === 'epics' && (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">🎯 에픽 목록</h2>
            <span className="text-sm text-muted-foreground">{rawEpics.length}개</span>
          </div>
          <EpicsTable epics={rawEpics} allStories={rawStories} allTasks={rawTasks} onSelectEpic={(e) => { setSelectedEpic(e); setEpicModalOpen(true) }} />
        </div>
      )}

      {/* Stories tab */}
      {subTab === 'stories' && (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">📖 스토리 목록</h2>
            <span className="text-sm text-muted-foreground">{rawStories.length}개</span>
          </div>
          <StoriesTable stories={rawStories} allTasks={rawTasks} epics={rawEpics} onSelectStory={(s) => { setSelectedStory(s); setStoryModalOpen(true) }} />
        </div>
      )}

      {/* Overview (existing board) */}
      {subTab === 'overview' && (
        <>
          {/* Owner filter */}
          <div className="flex gap-2 flex-wrap">
            {OWNER_FILTERS.map(f => (
              <Button
                key={f.id}
                variant={ownerFilter === f.id ? 'default' : 'outline'}
                size="sm"
                className="rounded-full text-xs h-7"
                onClick={() => setOwnerFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {enrichedEpics.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">태스크가 없습니다.</p>
          ) : (
            enrichedEpics.map(epic => (
              <EpicSection
                key={epic.id}
                epic={epic}
                ownerFilter={ownerFilter}
                latestDates={latestDates}
                onOpen={openModal}
              />
            ))
          )}
        </>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal taskId={selectedTaskId} open={modalOpen} onClose={closeModal} />

      {/* Epic Detail Modal */}
      <EpicDetailModal
        epic={selectedEpic}
        stories={rawStories}
        tasks={rawTasks}
        open={epicModalOpen}
        onClose={() => setEpicModalOpen(false)}
      />

      {/* Story Detail Modal */}
      <StoryDetailModal
        story={selectedStory}
        epic={rawEpics.find(e => e.id === selectedStory?.epic_id)}
        tasks={rawTasks}
        open={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
      />
    </div>
  )
}
