'use client'

import { useState, useMemo } from 'react'
import type { CalendarEvent } from '@/lib/calendar'

type Account = { id: string; name: string }
type LinkMap = Record<string, string>
type PrefMap = Record<string, string>
type MeetingDatesMap = Record<string, string[]>
type PendingNote = { id: string; file_id: string; file_name: string | null; drive_created_at: string | null }
type Filter = 'all' | 'unlinked' | 'missing-notes'

// ── helpers ──────────────────────────────────────────────────────────────────

function getEventStart(event: CalendarEvent): Date {
  return new Date(event.start.dateTime ?? event.start.date ?? '')
}

function isAllDay(event: CalendarEvent): boolean {
  return !!event.start.date && !event.start.dateTime
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isPastEvent(event: CalendarEvent, now: Date): boolean {
  if (isAllDay(event)) {
    const eventDay = new Date(event.start.date!)
    eventDay.setHours(0, 0, 0, 0)
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    return eventDay < today
  }
  return getEventStart(event) < now
}

function formatEventTime(event: CalendarEvent): string {
  if (isAllDay(event)) return 'All day'
  const start = getEventStart(event)
  return start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(date: Date, now: Date): string {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  if (d.getTime() === today.getTime()) return `Today — ${label}`
  if (d.getTime() === tomorrow.getTime()) return `Tomorrow — ${label}`
  return label
}

function groupByDay(events: CalendarEvent[]): { date: Date; events: CalendarEvent[] }[] {
  const groups: { date: Date; events: CalendarEvent[] }[] = []
  for (const event of events) {
    const start = getEventStart(event)
    const existing = groups.find(g => isSameLocalDay(g.date, start))
    if (existing) existing.events.push(event)
    else groups.push({ date: start, events: [event] })
  }
  return groups
}

function extractTitle(fileName: string): string {
  return fileName
    .replace(/^Notes from\s+/i, '')
    .replace(/\s+-\s+\d{4}[\/\-]\d{2}[\/\-]\d{2}.*?Notes by Gemini.*$/i, '')
    .replace(/\.docx?$/i, '').trim()
}

function fuzzyScore(a: string, b: string): number {
  const wa = a.toLowerCase().split(/\s+/).filter(Boolean)
  const wb = b.toLowerCase().split(/\s+/).filter(Boolean)
  if (!wa.length || !wb.length) return 0
  return wa.filter(w => wb.includes(w)).length / Math.max(wa.length, wb.length)
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MeetingsClient({
  events,
  accounts,
  initialLinks,
  initialPreferences,
  meetingsByAccount,
  pendingNotes,
  calendarConnected,
}: {
  events: CalendarEvent[]
  accounts: Account[]
  initialLinks: LinkMap
  initialPreferences: PrefMap
  meetingsByAccount: MeetingDatesMap
  pendingNotes: PendingNote[]
  calendarConnected: boolean
}) {
  const [now] = useState(() => new Date())
  const [links, setLinks] = useState<LinkMap>(initialLinks)
  const [prefs, setPrefs] = useState<PrefMap>(initialPreferences)
  const [filter, setFilter] = useState<Filter>('all')
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savingPref, setSavingPref] = useState<Record<string, boolean>>({})
  const [showPast, setShowPast] = useState(false)
  const [linkedFeedback, setLinkedFeedback] = useState<Record<string, boolean>>({})

  // Match pending notes to calendar events by fuzzy title
  const noteMatches = useMemo(() => {
    const matches: Record<string, PendingNote> = {}
    for (const note of pendingNotes) {
      if (!note.file_name) continue
      const title = extractTitle(note.file_name)
      let bestId = '', bestScore = 0
      for (const event of events) {
        if (!event.summary) continue
        const score = fuzzyScore(title, event.summary)
        if (score >= 0.5 && score > bestScore) { bestId = event.id; bestScore = score }
      }
      if (bestId && !matches[bestId]) matches[bestId] = note
    }
    return matches
  }, [pendingNotes, events])

  function hasNotes(event: CalendarEvent): boolean {
    const acctId = links[event.id]
    if (!acctId) return false
    const dates = meetingsByAccount[acctId] ?? []
    const t = getEventStart(event).getTime()
    return dates.some(d => Math.abs(new Date(d).getTime() - t) < 2 * 86400000)
  }

  const pastEvents = events.filter(e => isPastEvent(e, now))
  const upcomingEvents = events.filter(e => !isPastEvent(e, now))

  function applyFilter(evts: CalendarEvent[]) {
    if (filter === 'unlinked') return evts.filter(e => !links[e.id])
    if (filter === 'missing-notes') return pastEvents.filter(e => !hasNotes(e) && !noteMatches[e.id])
    return evts
  }

  const filteredUpcoming = filter === 'missing-notes' ? [] : applyFilter(upcomingEvents)
  const filteredPast = filter === 'missing-notes'
    ? applyFilter(pastEvents)
    : applyFilter(pastEvents)

  const counts = {
    unlinked: events.filter(e => !links[e.id]).length,
    missingNotes: pastEvents.filter(e => !hasNotes(e) && !noteMatches[e.id]).length,
  }

  async function handleLink(eventId: string, accountId: string) {
    setSaving(s => ({ ...s, [eventId]: true }))
    try {
      await fetch('/api/meeting-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_event_id: eventId, account_id: accountId }),
      })
      setLinks(l => ({ ...l, [eventId]: accountId }))
      setLinkedFeedback(f => ({ ...f, [eventId]: true }))
      setTimeout(() => setLinkedFeedback(f => ({ ...f, [eventId]: false })), 2000)
    } finally {
      setSaving(s => ({ ...s, [eventId]: false }))
    }
  }

  async function handleSetPref(eventId: string, preference: string) {
    setSavingPref(s => ({ ...s, [eventId]: true }))
    try {
      await fetch('/api/meeting-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_event_id: eventId, preference }),
      })
      setPrefs(p => ({ ...p, [eventId]: preference }))
    } finally {
      setSavingPref(s => ({ ...s, [eventId]: false }))
    }
  }

  function renderEventRow(event: CalendarEvent) {
    const past = isPastEvent(event, now)
    const linkedAccountId = links[event.id]
    const linkedAccount = accounts.find(a => a.id === linkedAccountId)
    const notes = hasNotes(event)
    const matchedNote = noteMatches[event.id]
    const isToday = isSameLocalDay(getEventStart(event), now)

    return (
      <div
        key={event.id}
        className={`flex flex-col border-l-2 ${past ? 'border-l-gray-100' : isToday ? 'border-l-blue-400' : 'border-l-gray-200'} ${past ? 'opacity-70' : ''}`}
      >
        <div className="flex items-center gap-3 px-5 py-3">
          {/* Time */}
          <div className="w-14 flex-shrink-0 text-right">
            <p className="text-xs text-gray-400">{formatEventTime(event)}</p>
          </div>

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${past ? 'text-gray-600' : 'text-gray-900'}`}>
              {event.summary || <em className="text-gray-400 not-italic">Untitled meeting</em>}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {!linkedAccountId && (
                <span className="text-xs text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">Unlinked</span>
              )}
              {past && linkedAccountId && (
                notes
                  ? <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">Notes synced</span>
                  : matchedNote
                    ? <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Notes pending review</span>
                    : <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">No notes</span>
              )}
            </div>
          </div>

          {/* Account link selector */}
          <select
            value={linkedAccountId ?? ''}
            onChange={e => e.target.value && handleLink(event.id, e.target.value)}
            disabled={saving[event.id]}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[140px]"
          >
            <option value="">{linkedFeedback[event.id] ? 'Linked ✓' : linkedAccount ? linkedAccount.name : 'Link account...'}</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Rec/Skip/Sync preference */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {(['record', 'skip', 'sync'] as const).map(pref => {
              const active = prefs[event.id] === pref
              const labels = { record: 'Rec', skip: 'Skip', sync: 'Sync' }
              return (
                <button
                  key={pref}
                  onClick={() => handleSetPref(event.id, pref)}
                  disabled={savingPref[event.id]}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                >
                  {labels[pref]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (!calendarConnected) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-5 flex flex-col gap-3">
        <p className="text-sm text-amber-800">Connect Google Calendar to see your meetings here</p>
        <a href="/api/calendar/connect" className="self-start bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
          Connect Calendar
        </a>
      </div>
    )
  }

  const upcomingGroups = groupByDay(filteredUpcoming)
  const pastGroups = groupByDay([...filteredPast].reverse()) // most recent first

  return (
    <div className="flex flex-col gap-6">

      {/* Filter tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200">
        {([
          { id: 'all' as Filter, label: 'All' },
          { id: 'unlinked' as Filter, label: counts.unlinked > 0 ? `Unlinked (${counts.unlinked})` : 'Unlinked' },
          { id: 'missing-notes' as Filter, label: counts.missingNotes > 0 ? `Missing notes (${counts.missingNotes})` : 'Missing notes' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {filteredUpcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {upcomingGroups.map(group => (
              <div key={group.date.toISOString()}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{formatDayLabel(group.date, now)}</p>
                </div>
                {group.events.map(e => renderEventRow(e))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {filteredPast.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-700 transition-colors"
          >
            Past ({filteredPast.length}) <span>{showPast ? '▲' : '▼'}</span>
          </button>
          {showPast && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {pastGroups.map(group => (
                <div key={group.date.toISOString()}>
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{formatDayLabel(group.date, now)}</p>
                  </div>
                  {group.events.map(e => renderEventRow(e))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredUpcoming.length === 0 && filteredPast.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          {filter === 'unlinked' ? 'All meetings are linked to accounts.' :
           filter === 'missing-notes' ? 'No past meetings with missing notes.' :
           'No meetings found in the last 30 days.'}
        </p>
      )}

      {/* Pending Drive files */}
      {pendingNotes.length > 0 && filter === 'all' && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Unprocessed Drive files ({pendingNotes.length})
          </p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {pendingNotes.map(note => {
              const matchedEventId = Object.entries(noteMatches).find(([, n]) => n.id === note.id)?.[0]
              const matchedEvent = matchedEventId ? events.find(e => e.id === matchedEventId) : null
              return (
                <div key={note.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{note.file_name ?? 'Untitled'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {note.drive_created_at && (
                        <p className="text-xs text-gray-400">
                          {new Date(note.drive_created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {matchedEvent && (
                        <p className="text-xs text-amber-600">Possible match: {matchedEvent.summary}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href="/dashboard"
                    className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    Review on dashboard →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
