import { Activity, LayoutDashboard, Users, Zap, Settings, ClipboardMinus, Search, Database } from "lucide-react"

export const sidebarItems = [
  { label: 'Queue', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Automation', href: '/automation', icon: Zap },
  { label: 'Performance', href: '/performance', icon: Activity },
  { label: 'Manage PACs', href: '/manage-cases', icon: ClipboardMinus },
  { label: 'Manage Users', href: '/manage-users', icon: Users },
]

export const doctorSidebarItems = [
  { label: 'Worklist', href: '/dashboard', icon: LayoutDashboard },
  { label: 'PACS List', href: '/pacs-list', icon: Database },
  { label: 'Research and Audit', href: '/research', icon: Search },
  { label: 'Viewer Settings', href: '/viewer-settings', icon: Settings },
]