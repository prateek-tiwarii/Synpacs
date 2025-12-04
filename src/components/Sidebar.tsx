import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { logout } from '@/store/authSlice'
import { sidebarItems, doctorSidebarItems } from '@/defaults/sidebarDefaults'

interface SidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const location = useLocation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const isDoctor = user?.role === 'doctor'

  const items = isDoctor ? doctorSidebarItems : sidebarItems

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] ${isCollapsed ? 'w-16' : 'w-48'} bg-white! border-r border-gray-200! transition-all duration-300 z-30 flex flex-col`}>
      
      <div className="flex justify-end p-2">
        <button 
          onClick={toggleSidebar} 
          className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="p-2 space-y-1 flex-1">
        {items.map((item) => {
          const isActive = location.pathname === item.href
          const IconComponent = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all ${isActive
                ? 'bg-black! text-white! shadow-sm'
                : 'text-gray-700! hover:bg-gray-100!'
                } ${isCollapsed ? 'justify-center' : ''}`}
              title={item.label}
            >
              <IconComponent className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="text-xs font-medium">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-all ${location.pathname === '/settings'
            ? 'bg-black! text-white! shadow-sm'
            : 'text-gray-700! hover:bg-gray-100!'
            } ${isCollapsed ? 'justify-center' : ''}`}
          title="General Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="text-xs font-medium">General Settings</span>}
        </Link>
        <Link
          to="/help"
          className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-gray-700! hover:bg-gray-100! ${isCollapsed ? 'justify-center' : ''}`}
          title="Help Center"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="text-xs font-medium">Help Center</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all bg-white! text-red-600! hover:bg-red-50! ${isCollapsed ? 'justify-center' : ''}`}
          title="Logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="text-xs font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
