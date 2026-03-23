import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TeamAccounts from './TeamAccounts'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Team — all accounts</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-800">
          <strong>SUPABASE_SERVICE_ROLE_KEY</strong> is not configured. Add it to your environment variables to enable the team view.
        </div>
      </div>
    )
  }

  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  const [{ data: allAccounts }, { data: { users } }] = await Promise.all([
    admin.from('accounts').select('*').order('updated_at', { ascending: false }),
    admin.auth.admin.listUsers(),
  ])

  // Build user email map
  const userMap: Record<string, string> = {}
  for (const u of users ?? []) {
    userMap[u.id] = u.email ?? u.id
  }

  // Group accounts by psm_id
  const grouped: Record<string, NonNullable<typeof allAccounts>> = {}
  for (const account of allAccounts ?? []) {
    const key = account.psm_id ?? 'unassigned'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(account)
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Team — all accounts</h1>
        <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-xs text-gray-500 inline-block">
          Read-only view — contact the account owner to make changes
        </div>
      </div>

      <TeamAccounts grouped={grouped} userMap={userMap} />
    </div>
  )
}
