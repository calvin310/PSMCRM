import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin access
  const { data: adminRow } = await supabase
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) redirect('/dashboard')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Admin</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-800">
          <strong>SUPABASE_SERVICE_ROLE_KEY</strong> is not configured. Add it to your environment variables to enable admin features.
        </div>
      </div>
    )
  }

  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  const [{ data: allAccounts }, { data: { users } }, { data: adminRows }] = await Promise.all([
    admin.from('accounts').select('id, name, relationship_stage, health_status, psm_id').order('name'),
    admin.auth.admin.listUsers(),
    admin.from('admin_users').select('user_id'),
  ])

  const adminIds = new Set((adminRows ?? []).map((r: { user_id: string }) => r.user_id))
  const userList = (users ?? []).map((u) => ({ id: u.id, email: u.email ?? u.id, isAdmin: adminIds.has(u.id) }))
  const userMap: Record<string, string> = {}
  for (const u of userList) userMap[u.id] = u.email

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
      <AdminPanel
        accounts={allAccounts ?? []}
        users={userList}
        userMap={userMap}
      />
    </div>
  )
}
