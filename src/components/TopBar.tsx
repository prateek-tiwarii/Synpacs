import { Bell, Settings, User, RefreshCw } from 'lucide-react'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { useState, useEffect } from "react"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { user } = useUser()
  interface Hospital {
    _id: string
    name: string
    subscription: string
  }

  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await apiService.request<{ data: Hospital[] }>('/api/v1/auth/get-user-hospitals')
        if (response.data) {
          setHospitals(response.data)
          // Select the first hospital by default if available
          if (response.data.length > 0 && !value) {
            setValue(response.data[0]._id)
          }
        }
      } catch (error) {
        console.error('Error fetching hospitals:', error)
      }
    }

    fetchHospitals()
  }, [])

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
        <span className="text-xl font-bold text-gray-900">SynPACS</span>
      </Link>

      {/* Right Side Icons */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">

        {(user?.role === 'coordinator' || user?.role === 'super_coordinator') && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
              >
                {value
                  ? hospitals.find((hospital) => hospital._id === value)?.name
                  : "Select hospital..."}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search hospital..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No hospital found.</CommandEmpty>
                  <CommandGroup>
                    {hospitals.map((hospital) => (
                      <CommandItem
                        key={hospital._id}
                        value={hospital.name}
                        onSelect={() => {
                          setValue(hospital._id)
                          setOpen(false)
                        }}
                      >
                        {hospital.name}
                        <Check
                          className={cn(
                            "ml-auto",
                            value === hospital._id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        <div className='flex items-center gap-2'>
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.location.reload()}
            className="bg-white! border-gray-300! hover:bg-gray-50! text-gray-700!"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

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
                  <p className="text-sm font-medium">New critical case assigned</p>
                  <p className="text-xs text-gray-500 mt-1">CT Brain - John Smith</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Case completed</p>
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
      </div>
    </header>
  )
}
