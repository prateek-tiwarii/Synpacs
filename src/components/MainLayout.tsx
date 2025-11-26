import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function MainLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <TopBar />

            {/* Sidebar */}
            <div className="flex w-full">
                <Sidebar />

                {/* Main Content Area */}
                <main className="pt-16 ml-48 transition-all duration-300 w-[calc(100%-192px)]">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
