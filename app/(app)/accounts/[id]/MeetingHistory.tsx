'use client'

import { useEffect, useState } from 'react'

type Meeting = {
  id: string
  meeting_date: string | null
  processed_at: string
  file_id: string | null
  file_name: string | null
  summary: string[] | null
  psm_action_items: string[] | null
  protocol_action_items: string[] | null
  health_status: string | null
  health_reason: string | null
  raw_transcript: string | null
}

type Account = { id: string; name: string }

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

function driveUrl(fileId: string) {
  return `https://docs.google.com/document/d/${fileId}/edit`
}

export default function MeetingHistory({ accountId }: { accountId: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [transcriptOpen, setTranscriptOpen] = useState<Set<string>>(new Set())

  // Reassign state
  const [reassigning, setReassigning] = useState<string | null>(null) // meeting id
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [reassignTarget, setReassignTarget] = useState('')
  const [reassignSaving, setReassignSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/accounts/${accountId}/meetings`)
      .then((r) => r.json())
      .then((d) => { setMeetings(d.meetings ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [accountId])

  // Fetch all accounts when reassign is first opened
  async function openReassign(meetingId: string) {
    setReassigning(meetingId)
    setReassignTarget('')
    if (allAccounts.length === 0) {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAllAccounts((data.accounts ?? []).filter((a: Account) => a.id !== accountId))
      }
    }
  }

  async function handleReassign(meetingId: string) {
    if (!reassignTarget) return
    setReassignSaving(true)
    const res = await fetch(`/api/accounts/${accountId}/meetings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id: meetingId, new_account_id: reassignTarget }),
    })
    if (res.ok) {
      setMeetings(prev => prev.filter(m => m.id !== meetingId))
    }
    setReassigning(null)
    setReassignSaving(false)
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTranscript(id: string) {
    setTranscriptOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <p className="text-sm text-gray-400 italic py-8 text-center">Loading...</p>
  if (meetings.length === 0) return <p className="text-sm text-gray-400 italic py-8">No meeting history yet.</p>

  return (
    <div className="flex flex-col gap-3 pt-2">
      {meetings.map((m) => {
        const isOpen = expanded.has(m.id)
        const dateStr = m.meeting_date
          ? new Date(m.meeting_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : new Date(m.processed_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

        return (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Row header */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <button
                onClick={() => toggle(m.id)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-medium text-gray-900 truncate">{dateStr}</span>
                {m.health_status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0 ${HEALTH_CLS[m.health_status] ?? ''}`}>
                    {HEALTH_LABEL[m.health_status] ?? m.health_status}
                  </span>
                )}
                {m.file_name && (
                  <span className="text-xs text-gray-400 truncate hidden sm:block">{m.file_name}</span>
                )}
              </button>

              {/* Actions: Drive link + reassign + expand */}
              <div className="flex items-center gap-2 ml-3 shrink-0">
                {m.file_id && (
                  <a
                    href={driveUrl(m.file_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Google Docs"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-gray-400 hover:text-indigo-600 transition-colors px-1"
                  >
                    ↗ Doc
                  </a>
                )}
                <button
                  onClick={() => reassigning === m.id ? setReassigning(null) : openReassign(m.id)}
                  title="Move to different account"
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-1"
                >
                  Move
                </button>
                <button onClick={() => toggle(m.id)} className="text-xs text-gray-400">
                  {isOpen ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* Reassign panel */}
            {reassigning === m.id && (
              <div className="border-t border-dashed border-gray-200 px-5 py-3 bg-gray-50 flex items-center gap-2">
                <select
                  value={reassignTarget}
                  onChange={e => setReassignTarget(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Move to account...</option>
                  {allAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleReassign(m.id)}
                  disabled={!reassignTarget || reassignSaving}
                  className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {reassignSaving ? 'Moving...' : 'Move'}
                </button>
                <button
                  onClick={() => setReassigning(null)}
                  className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Expanded detail */}
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
                          <span className="text-gray-400 mt-0.5">•</span><span>{item}</span>
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
                          <span className="text-gray-400 mt-0.5">•</span><span>{item}</span>
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
                          <span className="text-gray-400 mt-0.5">•</span><span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.raw_transcript && (
                  <div>
                    <button
                      onClick={() => toggleTranscript(m.id)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {transcriptOpen.has(m.id) ? '▲ Hide transcript' : '▼ Show full transcript'}
                    </button>
                    {transcriptOpen.has(m.id) && (
                      <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto border border-gray-100">
                        {m.raw_transcript}
                      </pre>
                    )}
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
