import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <TopBar />

      {/* Sidebar */}
      <div className="flex w-full">
        {/* <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} /> */}

        {/* Main Content Area */}
        <main className={`pt-16 transition-all duration-300 ${isCollapsed ? 'ml-16 w-[calc(100%-64px)]' : 'ml-48 w-[calc(100%-192px)]'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
