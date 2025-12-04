import { Activity, LayoutDashboard, User, Users, Zap, FileImage } from "lucide-react"

export const sidebarItems = [
    { label: 'Queue', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Automation', href: '/automation', icon: Zap },
    { label: 'Performance', href: '/performance', icon: Activity },
    { label: 'Manage Patients', href: '/manage-patients', icon: User },
    { label: 'Manage Users', href: '/manage-users', icon: Users },
  ]
  
  export const doctorSidebarItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Cases', href: '/pac-list', icon: FileImage },
    { label: 'Analytics', href: '/performance', icon: Activity },
  ]