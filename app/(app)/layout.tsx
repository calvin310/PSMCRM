import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SidebarNav from './SidebarNav'
import AIChatPanel from './dashboard/AIChatPanel'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin = !!adminRow

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* App name */}
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-900">PSM Platform</span>
          </div>
        </div>

        {/* Nav + user */}
        <SidebarNav isAdmin={isAdmin} userEmail={user.email ?? ''} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* AI Chat — available on all pages */}
      <AIChatPanel />
    </div>
  )
}
