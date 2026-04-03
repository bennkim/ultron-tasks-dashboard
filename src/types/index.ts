export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'WAITING' | 'BACKLOG' | 'REVIEW'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  owner?: string
  assignee?: string
  ice_score?: number
  completed_date?: string
  created_at?: string
  updated_at?: string
  description?: string
  priority?: string
  story_id?: string
}

export interface Story {
  id: string
  title: string
  status: TaskStatus
  epic_id?: string
  created_at?: string
  updated_at?: string
  tasks?: Task[]
}

export interface Epic {
  id: string
  title: string
  status?: string
  priority?: string
  created_at?: string
  updated_at?: string
  stories?: Story[]
}

export interface HistoryEntry {
  date: string
  author: string
  type: string
  note?: string
}

export interface TaskDetail extends Task {
  assignee?: string
  started_at?: string
  blocked_reason?: string
  related_commit?: string
  completion_criteria?: string
  notes?: string
}

export interface TaskDetailResponse {
  task: TaskDetail
  history: HistoryEntry[]
  story?: Story
  epic?: Epic
}

export interface AgentInfo {
  action?: string
  note?: string
  currentTask?: string
  status: 'online' | 'idle' | 'offline'
  detail?: string
  lastActivity?: string
  runtime?: {
    status: 'online' | 'idle' | 'offline'
    detail?: string
    timestamp?: string
    updatedAt?: string
  }
}

export interface SystemStatus {
  agents: Record<string, AgentInfo>
  storage?: {
    r2UsageBytes?: number
    r2FilesCount?: number
    d1RowCount?: number
  }
  api?: {
    latencyMs?: number
    status?: string
  }
  workers?: {
    status?: string
  }
}

export interface KpiStats {
  total: number
  done: number
  inProgress: number
  blocked: number
  waiting: number
  progressPct: number
}

// Ad Manager types
export interface AdMetric {
  date: string
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  spend: number
  roas: number
}

export interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  start_date: string
  end_date: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  roas: number
}

export interface Creative {
  id: string
  name: string
  status: string
  thumbnail?: string
  ctr: number
  conversions: number
}

export interface UtmParams {
  base_url: string
  source: string
  medium: string
  campaign: string
  content?: string
  term?: string
}

// Leads types
export interface Lead {
  id: string
  agency: string
  domain?: string
  email?: string
  region?: string
  size?: string
  clutch_score?: number
}

// Contents types
export interface ContentRequest {
  channel: string
  objective: string
  tone: string
  variations: number
  theme: string
  keywords?: string
}

export interface ContentResult {
  id: string
  copies: string[]
  image_prompt?: string
  created_at: string
  request: ContentRequest
}
