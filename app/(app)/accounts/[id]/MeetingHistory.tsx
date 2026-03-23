'use client'

import { useEffect, useState } from 'react'

type Meeting = {
  id: string
  meeting_date: string | null
  processed_at: string
  file_name: string | null
  summary: string[] | null
  psm_action_items: string[] | null
  protocol_action_items: string[] | null
  health_status: string | null
  health_reason: string | null
}

const HEALTH_LABEL: Record<string, string> = {
  green: 'Healthy',
  yellow: 'At risk',
  red: 'Critical',
}

const HEALTH_CLS: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
}

export default function MeetingHistory({ accountId }: { accountId: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/accounts/${accountId}/meetings`)
      .then((r) => r.json())
      .then((d) => {
        setMeetings(d.meetings ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [accountId])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <p className="text-sm text-gray-400 italic py-8 text-center">Loading...</p>
  }

  if (meetings.length === 0) {
    return <p className="text-sm text-gray-400 italic py-8">No meeting history yet.</p>
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      {meetings.map((m) => {
        const isOpen = expanded.has(m.id)
        const dateStr = m.meeting_date
          ? new Date(m.meeting_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : new Date(m.processed_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

        return (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(m.id)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">{dateStr}</span>
                {m.health_status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0 ${HEALTH_CLS[m.health_status] ?? ''}`}>
                    {HEALTH_LABEL[m.health_status] ?? m.health_status}
                  </span>
                )}
                {m.file_name && (
                  <span className="text-xs text-gray-400 truncate hidden sm:block">{m.file_name}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 ml-3 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
                {m.health_reason && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Health note</p>
                    <p className="text-sm text-gray-700">{m.health_reason}</p>
                  </div>
                )}
                {m.summary && m.summary.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</p>
                    <ul className="space-y-1">
                      {m.summary.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.psm_action_items && m.psm_action_items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">PSM action items</p>
                    <ul className="space-y-1">
                      {m.psm_action_items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.protocol_action_items && m.protocol_action_items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Protocol action items</p>
                    <ul className="space-y-1">
                      {m.protocol_action_items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
