export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'WAITING'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  owner?: string
  ice_score?: number
  completed_date?: string
  created_at?: string
  updated_at?: string
  description?: string
  priority?: string
}

export interface AgentInfo {
  status: 'online' | 'idle' | 'offline'
  detail?: string
  lastActivity?: string
  runtime?: {
    status: 'online' | 'idle' | 'offline'
    detail?: string
    timestamp?: string
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
