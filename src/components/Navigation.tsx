import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/store/hooks'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Worklist', href: '/worklist' },
  { label: 'PAC List', href: '/pac-list' },
  { label: 'Automation', href: '/automation' },
  { label: 'Settings', href: '/settings' },
]

export function Navigation() {
  const user = useAppSelector((state) => state.auth.user)
  const location = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-lg">
      <div className="h-16 flex items-center justify-between px-6 w-full max-w-full">
        {/* Left - Logo */}
        <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity shrink-0">
          <div className="w-11 h-11 bg-linear-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">synPacs</span>
        </Link>

        
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-black! text-white! shadow-md hover:bg-gray-900'
                    : 'bg-white! text-black! border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

      
        <div>
          {user && user.name ? (
            <span className="text-sm text-gray-700 font-medium">
              Welcome, {user.name}
            </span>
          ) : (
            <Link to="/auth">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 h-11 rounded-lg shadow-md hover:shadow-lg transition-all">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
