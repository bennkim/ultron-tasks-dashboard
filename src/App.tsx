import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { TasksPage } from '@/pages/TasksPage'
import { AdManagerPage } from '@/pages/AdManagerPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { ContentsPage } from '@/pages/ContentsPage'

function getPage(tab: string, onTabChange: (id: string) => void) {
  switch (tab) {
    case 'home':
      return <HomePage onTabChange={onTabChange} />
    case 'tasks':
      return <TasksPage />
    case 'ad-manager':
      return <AdManagerPage />
    case 'leads':
      return <LeadsPage />
    case 'contents':
      return <ContentsPage />
    default:
      return <HomePage onTabChange={onTabChange} />
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {getPage(activeTab, setActiveTab)}
    </AppLayout>
  )
}
