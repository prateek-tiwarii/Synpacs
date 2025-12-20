import { Outlet } from 'react-router-dom'
import ViewerHeader from './viewer/ViewerHeader'
import ViewerSidebar from './viewer/ViewerSidebar'

export function ViewerLayout() {
    return (
        <div className="min-h-screen w-full bg-black text-white">
            <ViewerHeader />
            <div className='flex h-full'>
                <ViewerSidebar />
                <Outlet />
            </div>
        </div>
    )
}
