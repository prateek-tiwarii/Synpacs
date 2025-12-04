import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function MainLayout() {
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <TopBar />

            {/* Sidebar */}
            <div className="flex w-full">
                <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

                {/* Main Content Area */}
                <main className={`pt-16 transition-all duration-300 ${isCollapsed ? 'ml-16 w-[calc(100%-64px)]' : 'ml-48 w-[calc(100%-192px)]'}`}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
