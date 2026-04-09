import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { TasksPage } from '@/pages/TasksPage'
import { AdManagerPage } from '@/pages/AdManagerPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { ContentsPage } from '@/pages/ContentsPage'
import { LogsPage } from '@/pages/LogsPage'

function parseHash(): { tab: string; subTab?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('/')
  return { tab: parts[0] || 'home', subTab: parts[1] }
}

function setHash(tab: string, subTab?: string) {
  const path = subTab ? `${tab}/${subTab}` : tab
  window.location.hash = `#/${path}`
}

export default function App() {
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setHash(tab)
  }, [])

  const handleSubTabChange = useCallback((subTab: string) => {
    setHash(route.tab, subTab)
    setRoute(r => ({ ...r, subTab }))
  }, [route.tab])

  const page = (() => {
    switch (route.tab) {
      case 'home': return <HomePage onTabChange={handleTabChange} />
      case 'tasks': return <TasksPage />
      case 'ad-manager': return <AdManagerPage subTab={route.subTab} onSubTabChange={handleSubTabChange} />
      case 'leads': return <LeadsPage />
      case 'contents': return <ContentsPage />
      case 'logs': return <LogsPage />
      default: return <HomePage onTabChange={handleTabChange} />
    }
  })()

  return (
    <AppLayout activeTab={route.tab} onTabChange={handleTabChange}>
      {page}
    </AppLayout>
  )
}
