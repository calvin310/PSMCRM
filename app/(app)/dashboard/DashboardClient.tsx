'use client'

import { useState } from 'react'
import Link from 'next/link'
import DriveStatus from './DriveStatus'
import ReviewQueue from './ReviewQueue'
import NeedsAttention from './NeedsAttention'
import ThisWeekMeetings from './ThisWeekMeetings'
import ActionItems, { type ActionItem } from './ActionItems'
import AccountPanel from './AccountPanel'
import type { CalendarEvent } from '@/lib/calendar'

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

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never updated'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'Updated today'
  if (diff === 1) return 'Updated 1 day ago'
  return `Updated ${diff} days ago`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Account = Record<string, any>

type PendingNote = {
  id: string
  file_id: string
  file_name: string | null
  content: string | null
  drive_created_at: string | null
}

type Props = {
  accounts: Account[]
  driveConnected: boolean
  driveLastSynced: string | null
  pendingNotes: PendingNote[]
  calendarConnected: boolean
  calendarEvents: CalendarEvent[]
  initialLinks: Record<string, string>
  initialPreferences: Record<string, string>
  needsAttention: Account[]
  actionItems: ActionItem[]
  stats: { total: number; red: number; pending: number; openItems: number }
  userEmail: string
}

export default function DashboardClient({
  accounts,
  driveConnected,
  driveLastSynced,
  pendingNotes,
  calendarConnected,
  calendarEvents,
  initialLinks,
  initialPreferences,
  needsAttention,
  actionItems,
  stats,
  userEmail,
}: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto flex flex-col gap-8">

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total accounts', value: stats.total },
          { label: 'Red accounts', value: stats.red, warn: stats.red > 0 },
          { label: 'Pending meetings', value: stats.pending, warn: stats.pending > 0 },
          { label: 'Open action items', value: stats.openItems },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className={`text-2xl font-bold ${stat.warn ? 'text-red-600' : 'text-gray-900'}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Drive status */}
      <DriveStatus connected={driveConnected} lastSynced={driveLastSynced} />

      {/* Review queue */}
      {pendingNotes.length > 0 && (
        <ReviewQueue
          notes={pendingNotes}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}

      {/* Action items */}
      <ActionItems items={actionItems} onOpenPanel={setSelectedAccountId} />

      {/* Needs attention */}
      <NeedsAttention accounts={needsAttention as { id: string; name: string; health_status: string | null; last_meeting_date: string | null }[]} />

      {/* This week's meetings */}
      <ThisWeekMeetings
        events={calendarEvents}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        initialLinks={initialLinks}
        initialPreferences={initialPreferences}
        calendarConnected={calendarConnected}
        onOpenPanel={setSelectedAccountId}
      />

      {/* Accounts grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">All accounts</h2>
          <Link
            href="/accounts/new"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Add account
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 text-sm mb-4">No accounts yet — add your first partner account</p>
            <Link
              href="/accounts/new"
              className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              + Add account
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 leading-tight">{account.name}</h3>
                  <span
                    className={`inline-block w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${
                      HEALTH_DOT[account.health_status] ?? 'bg-gray-300'
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account panel */}
      <AccountPanel
        accountId={selectedAccountId}
        onClose={() => setSelectedAccountId(null)}
        userEmail={userEmail}
      />

    </div>
  )
}
