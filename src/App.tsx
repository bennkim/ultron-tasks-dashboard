import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'

function getPage(tab: string, onTabChange: (id: string) => void) {
  switch (tab) {
    case 'home':
      return <HomePage onTabChange={onTabChange} />
    case 'tasks':
      return <div><h1 className="text-2xl font-semibold mb-2">Tasks</h1><p className="text-muted-foreground">태스크 관리</p></div>
    case 'ad-manager':
      return <div><h1 className="text-2xl font-semibold mb-2">Ad Manager</h1><p className="text-muted-foreground">광고 관리</p></div>
    case 'leads':
      return <div><h1 className="text-2xl font-semibold mb-2">Leads</h1><p className="text-muted-foreground">리드 관리</p></div>
    case 'contents':
      return <div><h1 className="text-2xl font-semibold mb-2">Contents</h1><p className="text-muted-foreground">콘텐츠 관리</p></div>
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
