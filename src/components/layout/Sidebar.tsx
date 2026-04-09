import { cn } from '@/lib/utils'

interface NavItem {
  icon: string
  label: string
  id: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: '🏠', label: 'Home', id: 'home' },
  { icon: '📋', label: 'Tasks', id: 'tasks' },
  { icon: '📊', label: 'Ad Manager', id: 'ad-manager' },
  { icon: '👥', label: 'Leads', id: 'leads' },
  { icon: '✍️', label: 'Contents', id: 'contents' },
  { icon: '🔍', label: 'Logs', id: 'logs' },
]

interface SidebarProps {
  activeTab: string
  onTabChange: (id: string) => void
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ activeTab, onTabChange, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-full w-[200px] flex-col border-r border-border bg-sidebar-background',
          'flex transition-transform duration-200',
          'md:translate-x-0 md:static md:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-sm font-semibold text-sidebar-foreground">
            Ultron Dashboard
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id)
                onClose()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                activeTab === item.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
