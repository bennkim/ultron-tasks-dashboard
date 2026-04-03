import { Task, SystemStatus } from '@/types'

const API = 'https://wakalab-media-worker.kimbang0105.workers.dev'

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API}/api/tasks`)
  if (!res.ok) throw new Error(`Tasks fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.tasks ?? [])
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API}/api/system-status`)
  if (!res.ok) throw new Error(`System status fetch failed: ${res.status}`)
  const data = await res.json()
  return data.data ?? data
}
