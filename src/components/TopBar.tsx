import { Search, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'

export function TopBar() {
  const { user } = useUser()

  console.log(user)

  const formatRole = (role?: string) => {
    if (!role) return 'User'
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-6">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <span className="text-xl font-bold text-gray-900">synPacs</span>
      </Link>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients, studies, doctors..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white"
          />
        </div>
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="relative bg-white! border-gray-300! hover:bg-gray-50! text-gray-700!"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500! text-white! text-xs rounded-full flex items-center justify-center font-medium">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-3 border-b">
              <p className="font-semibold text-sm">Notifications</p>
            </div>
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">New critical study assigned</p>
                <p className="text-xs text-gray-500 mt-1">CT Brain - John Smith</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Study completed</p>
                <p className="text-xs text-gray-500 mt-1">MRI Spine - Sarah Johnson</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">New patient registered</p>
                <p className="text-xs text-gray-500 mt-1">5 minutes ago</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <Link to="/settings">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-white! border-gray-300! hover:bg-gray-50! text-gray-700!  "
          >
            <Settings className="h-4 w-4" />
          </Button>
        </Link>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="bg-white! border-gray-300! hover:bg-gray-50! text-gray-700! rounded-full"
            >
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm">{user?.full_name || 'Guest'}</p>
                <Badge variant="info" className="text-[10px] px-2 py-0">
                  {formatRole(user?.role)}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{user?.email || 'guest@synpac.com'}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Account Settings</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-red-600">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
