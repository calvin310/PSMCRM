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
  current_status: string | null
  updated_at: string | null
}

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never updated'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

export default function TeamAccounts({
  grouped,
  userMap,
}: {
  grouped: Record<string, Account[]>
  userMap: Record<string, string>
}) {
  const [search, setSearch] = useState('')

  const searchLower = search.toLowerCase()

  return (
    <div className="flex flex-col gap-6">
      <input
        type="text"
        placeholder="Search all accounts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 max-w-sm"
      />

      {Object.entries(grouped).map(([psmId, accounts]) => {
        const filtered = search
          ? accounts.filter((a) => a.name.toLowerCase().includes(searchLower))
          : accounts
        if (filtered.length === 0) return null

        const email = userMap[psmId] ?? (psmId === 'unassigned' ? 'Unassigned' : psmId)

        return (
          <div key={psmId}>
            <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
              {email}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((account) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 leading-tight">{account.name}</h3>
                    <span
                      className={`inline-block w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${
                        HEALTH_DOT[account.health_status ?? ''] ?? 'bg-gray-300'
                      }`}
                    />
                  </div>
                  {account.relationship_stage && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                        STAGE_BADGE[account.relationship_stage] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {account.relationship_stage}
                    </span>
                  )}
                  {account.current_status && (
                    <p className="text-sm text-gray-600 line-clamp-2">{account.current_status}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-auto">{daysSince(account.updated_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
