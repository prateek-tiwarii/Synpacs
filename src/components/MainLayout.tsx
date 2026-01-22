import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function MainLayout() {

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <TopBar />

            {/* Sidebar */}
            <div className="flex w-full">
                {/* <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} /> */}

                {/* Main Content Area */}
                <main className={`pt-16 transition-all duration-300 w-full`}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
