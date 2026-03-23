'use client'

import { useState } from 'react'
import Link from 'next/link'

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

const STAGE_BADGE: Record<string, string> = {
  onboarding: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  'at-risk': 'bg-yellow-100 text-yellow-700',
  churned: 'bg-gray-100 text-gray-500',
}

type Account = {
  id: string
  name: string
  health_status: string | null
  relationship_stage: string | null
  last_meeting_date: string | null
  psm_action_items: string[] | null
  updated_at: string | null
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [search, setSearch] = useState('')

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Search accounts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent max-w-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {search ? 'No accounts match your search.' : 'No accounts yet.'}
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((account) => (
                <tr
                  key={account.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <Link href={`/accounts/${account.id}`} className="flex items-center gap-2.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          HEALTH_DOT[account.health_status ?? ''] ?? 'bg-gray-300'
                        }`}
                      />
                      <span className="font-medium text-gray-900">{account.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {account.relationship_stage ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          STAGE_BADGE[account.relationship_stage] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {account.relationship_stage}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(account.last_meeting_date)}</td>
                  <td className="px-5 py-3 text-gray-500">{account.psm_action_items?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
