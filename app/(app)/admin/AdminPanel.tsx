'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

type Account = {
  id: string
  name: string
  relationship_stage: string | null
  health_status: string | null
  psm_id: string | null
}

type User = { id: string; email: string; isAdmin: boolean }

export default function AdminPanel({
  accounts,
  users,
  userMap,
}: {
  accounts: Account[]
  users: User[]
  userMap: Record<string, string>
}) {
  const supabase = createClient()

  // Create account form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '', relationship_stage: 'active', comms_channel: 'email',
    what_building: '', psm_id: users[0]?.id ?? '',
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    const { error } = await supabase.from('accounts').insert(formData)
    if (error) { setCreateError(error.message); setCreating(false); return }
    window.location.reload()
  }

  // Admin toggle
  const [adminState, setAdminState] = useState<Record<string, boolean>>(
    Object.fromEntries(users.map((u) => [u.id, u.isAdmin]))
  )
  const [toggling, setToggling] = useState<string | null>(null)

  async function handleToggleAdmin(userId: string) {
    setToggling(userId)
    const action = adminState[userId] ? 'remove' : 'make'
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, target_user_id: userId }),
    })
    if (res.ok) {
      setAdminState((s) => ({ ...s, [userId]: !s[userId] }))
    }
    setToggling(null)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1 — Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Accounts</h2>
          <button
            onClick={() => setShowForm((f) => !f)}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Create account'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 flex flex-col gap-4">
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Assign to PSM</label>
                <select value={formData.psm_id} onChange={(e) => setFormData({ ...formData, psm_id: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Stage</label>
                <select value={formData.relationship_stage} onChange={(e) => setFormData({ ...formData, relationship_stage: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {['onboarding', 'active', 'at-risk', 'churned'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Comms channel</label>
                <select value={formData.comms_channel} onChange={(e) => setFormData({ ...formData, comms_channel: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {['telegram', 'slack', 'email', 'none'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">What are they building?</label>
                <textarea rows={2} value={formData.what_building} onChange={(e) => setFormData({ ...formData, what_building: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={creating}
                className="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PSM</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/accounts/${account.id}`} className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${HEALTH_DOT[account.health_status ?? ''] ?? 'bg-gray-300'}`} />
                      <span className="font-medium text-gray-900">{account.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{account.psm_id ? (userMap[account.psm_id] ?? account.psm_id) : '—'}</td>
                  <td className="px-5 py-3 text-gray-500 capitalize text-xs">{account.relationship_stage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2 — Users */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Users</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{u.email}</td>
                  <td className="px-5 py-3">
                    {adminState[u.id] ? (
                      <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Admin</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleToggleAdmin(u.id)}
                      disabled={toggling === u.id}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {toggling === u.id ? '...' : adminState[u.id] ? 'Remove admin' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
