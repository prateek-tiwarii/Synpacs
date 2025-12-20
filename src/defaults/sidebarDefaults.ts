import { Activity, LayoutDashboard, Users, Zap, Settings, ClipboardMinus, Search, Bookmark } from "lucide-react"

export const sidebarItems = [
  { label: 'Queue', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Automation', href: '/automation', icon: Zap },
  { label: 'Performance', href: '/performance', icon: Activity },
  { label: 'Manage PACs', href: '/manage-pacs', icon: ClipboardMinus },
  { label: 'Manage Users', href: '/manage-users', icon: Users },
]

export const doctorSidebarItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Research', href: '/research', icon: Search },
  { label: 'Viewer Settings', href: '/viewer-settings', icon: Settings },
  { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
]