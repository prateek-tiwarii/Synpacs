import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ListChecks, 
  Image, 
  Settings, 
  Zap,
  HelpCircle,
  LogOut,
  User
} from 'lucide-react'
import { useAppDispatch } from '@/store/hooks'
import { logout } from '@/store/authSlice'

const sidebarItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Worklist', href: '/worklist', icon: ListChecks },
  { label: 'PAC List', href: '/pac-list', icon: Image },
  { label: 'Automation', href: '/automation', icon: Zap },
  { label: 'Manage Patients', href: '/manage-patients', icon: User },
  { label: 'Manage Users', href: '/manage-users', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-white! border-r border-gray-200! transition-all duration-300 z-30 flex flex-col`}>
     

      {/* Navigation Items */}
      <nav className="p-3 space-y-1 mt-4 flex-1">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-black! text-white! shadow-sm'
                  : 'text-gray-700! hover:bg-gray-100!'
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              { (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        <Link
          to="/help"
          className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-gray-700! hover:bg-gray-100!"
          title="Help Center"
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Help Center</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all bg-white! text-red-600! hover:bg-red-50!"
          title="Logout"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  )
}
