'use client'

import { useState } from 'react'
import MeetingHistory from './MeetingHistory'

export default function AccountTabs({
  accountId,
  overviewContent,
}: {
  accountId: string
  overviewContent: React.ReactNode
}) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview')

  return (
    <>
      <div className="flex items-center gap-0 border-b border-gray-200 -mb-1">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'history', label: 'Meetings' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        overviewContent
      ) : (
        <MeetingHistory accountId={accountId} />
      )}
    </>
  )
}
