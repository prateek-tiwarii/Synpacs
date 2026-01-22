import { type ReactNode } from 'react'
import { TopBar } from './TopBar'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <TopBar />

      {/* Sidebar */}
      <div className="flex w-full">
        {/* <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} /> */}

        {/* Main Content Area */}
        <main className={`pt-16 transition-all duration-300`}>
          {children}
        </main>
      </div>
    </div>
  )
}
