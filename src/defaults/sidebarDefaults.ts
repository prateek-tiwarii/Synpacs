import { Activity, LayoutDashboard, Users, Zap, FileImage, Settings, ClipboardMinus, Search } from "lucide-react"

export const sidebarItems = [
    { label: 'Queue', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Automation', href: '/automation', icon: Zap },
    { label: 'Performance', href: '/performance', icon: Activity },
    { label: 'Manage PACs', href: '/manage-pacs', icon: ClipboardMinus },
    { label: 'Manage Users', href: '/manage-users', icon: Users },
  ]
  
  export const doctorSidebarItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Cases', href: '/pac-list', icon: FileImage },
    { label: 'Research', href: '/research', icon: Search },
    // { label: 'Analytics', href: '/performance', icon: Activity },
    { label: 'Viewer Settings', href: '/viewer-settings', icon: Settings },
  ]