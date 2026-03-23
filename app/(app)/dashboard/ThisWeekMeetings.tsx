'use client'

import { useState } from 'react'
import type { CalendarEvent } from '@/lib/calendar'

type Account = { id: string; name: string }
type LinkMap = Record<string, string> // eventId → accountId

// ── helpers ──────────────────────────────────────────────────────────────────

function getEventStart(event: CalendarEvent): Date {
  return new Date(event.start.dateTime ?? event.start.date ?? '')
}

function isAllDay(event: CalendarEvent): boolean {
  return !!event.start.date && !event.start.dateTime
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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

function formatTime(event: CalendarEvent, now: Date): string {
  if (isAllDay(event)) return 'All day'
  const start = getEventStart(event)
  const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (isSameLocalDay(start, now)) return `Today ${time}`
  if (isSameLocalDay(start, tomorrow)) return `Tomorrow ${time}`
  return `${start.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

function formatDayLabel(date: Date, now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const dateStr = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (isSameLocalDay(date, now)) return `Today — ${dateStr}`
  if (isSameLocalDay(date, tomorrow)) return `Tomorrow — ${dateStr}`
  return dateStr
}

function groupByDay(events: CalendarEvent[]): { date: Date; events: CalendarEvent[] }[] {
  const groups: { date: Date; events: CalendarEvent[] }[] = []
  for (const event of events) {
    const start = getEventStart(event)
    const existing = groups.find((g) => isSameLocalDay(g.date, start))
    if (existing) existing.events.push(event)
    else groups.push({ date: start, events: [event] })
  }
  return groups
}

// ── main component ────────────────────────────────────────────────────────────

type PrefMap = Record<string, string> // eventId → 'record' | 'skip' | 'sync'

export default function ThisWeekMeetings({
  events,
  accounts,
  initialLinks,
  initialPreferences,
  calendarConnected,
  onOpenPanel,
}: {
  events: CalendarEvent[]
  accounts: Account[]
  initialLinks: LinkMap
  initialPreferences: PrefMap
  calendarConnected: boolean
  onOpenPanel?: (accountId: string) => void
}) {
  const [now] = useState(() => new Date())
  const [links, setLinks] = useState<LinkMap>(initialLinks)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [linkedFeedback, setLinkedFeedback] = useState<Record<string, boolean>>({})
  const [prefs, setPrefs] = useState<PrefMap>(initialPreferences)
  const [savingPref, setSavingPref] = useState<Record<string, boolean>>({})
  const [showEarlier, setShowEarlier] = useState(false)
  const [showFullWeek, setShowFullWeek] = useState(false)

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  // Classify events
  const pastEvents = events.filter((e) => isPastEvent(e, now))
  const upcomingEvents = events.filter((e) => !isPastEvent(e, now))
  const todayUpcoming = upcomingEvents.filter((e) => isSameLocalDay(getEventStart(e), now))
  const tomorrowEvents = upcomingEvents.filter((e) => isSameLocalDay(getEventStart(e), tomorrow))
  const laterEvents = upcomingEvents.filter(
    (e) => !isSameLocalDay(getEventStart(e), now) && !isSameLocalDay(getEventStart(e), tomorrow)
  )

  const visibleUpcoming = showFullWeek
    ? upcomingEvents
    : [...todayUpcoming, ...tomorrowEvents]

  const upcomingGroups = groupByDay(visibleUpcoming)

  async function handleSetPref(eventId: string, preference: string) {
    setSavingPref((s) => ({ ...s, [eventId]: true }))
    try {
      await fetch('/api/meeting-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_event_id: eventId, preference }),
      })
      setPrefs((p) => ({ ...p, [eventId]: preference }))
    } finally {
      setSavingPref((s) => ({ ...s, [eventId]: false }))
    }
  }

  async function handleLink(eventId: string, accountId: string) {
    setSaving((s) => ({ ...s, [eventId]: true }))
    try {
      await fetch('/api/meeting-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_event_id: eventId, account_id: accountId }),
      })
      setLinks((l) => ({ ...l, [eventId]: accountId }))
      setLinkedFeedback((f) => ({ ...f, [eventId]: true }))
      setTimeout(() => setLinkedFeedback((f) => ({ ...f, [eventId]: false })), 2000)
    } finally {
      setSaving((s) => ({ ...s, [eventId]: false }))
    }
  }

  function renderEventRow(event: CalendarEvent, past: boolean) {
    const linkedAccountId = links[event.id]
    const linkedAccount = accounts.find((a) => a.id === linkedAccountId)
    const isToday = isSameLocalDay(getEventStart(event), now)
    const isTomorrow = isSameLocalDay(getEventStart(event), tomorrow)

    const rowBorder = past
      ? ''
      : isToday
      ? 'border-l-2 border-l-blue-400'
      : isTomorrow
      ? 'border-l-2 border-l-gray-200'
      : 'border-l-2 border-l-gray-200'

    const activePref = prefs[event.id]
    const prefInfoLine = activePref && !past

    return (
      <div
        key={event.id}
        className={`flex flex-col ${rowBorder} ${past ? 'opacity-50' : ''}`}
      >
      <div className="flex items-center gap-4 px-5 py-3">
        <div className="flex-1 min-w-0">
          {event.summary ? (
            <p className={`text-sm font-medium truncate ${past ? 'text-gray-500' : 'text-gray-900'}`}>
              {event.summary}
            </p>
          ) : (
            <p className={`text-sm truncate italic ${past ? 'text-gray-400' : 'text-gray-500'}`}>
              Untitled meeting
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">{formatTime(event, now)}</p>
            {past && (
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Past</span>
            )}
          </div>
        </div>

        <select
          value={linkedAccountId ?? ''}
          onChange={(e) => e.target.value && handleLink(event.id, e.target.value)}
          disabled={saving[event.id]}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[160px]"
        >
          <option value="">Link to account...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Recording preference */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(['record', 'skip', 'sync'] as const).map((pref) => {
            const active = prefs[event.id] === pref
            const labels: Record<string, string> = { record: 'Rec', skip: 'Skip', sync: 'Sync' }
            const titles: Record<string, string> = {
              record: 'Gemini notes will be added to your review queue',
              skip: 'Gemini notes for this meeting will be ignored',
              sync: 'Notes will be added to your review queue — use this if you want to manually sync after the meeting',
            }
            return (
              <button
                key={pref}
                onClick={() => handleSetPref(event.id, pref)}
                disabled={savingPref[event.id]}
                title={titles[pref]}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'text-gray-400 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {labels[pref]}
              </button>
            )
          })}
        </div>

        {linkedFeedback[event.id] ? (
          <span className="text-xs font-medium text-green-600 flex-shrink-0 min-w-[48px] text-center">
            Linked ✓
          </span>
        ) : linkedAccount ? (
          <button
            onClick={() => onOpenPanel?.(linkedAccount.id)}
            className="text-xs font-medium text-teal-700 border border-teal-200 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition-colors flex-shrink-0"
          >
            Prep
          </button>
        ) : (
          <span
            title="Link an account first"
            className="text-xs text-gray-300 border border-gray-100 px-3 py-1.5 rounded-lg flex-shrink-0 cursor-default"
          >
            Prep
          </span>
        )}
      </div>
      {prefInfoLine && (
        <p className="text-xs text-gray-400 px-5 pb-1.5 -mt-0.5">
          Preference affects auto-sync from Google Drive
        </p>
      )}
      </div>
    )
  }

  if (!calendarConnected) {
    return (
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">This week&apos;s meetings</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">Connect Google Calendar to see your meetings here</p>
          <a
            href="/api/calendar/connect"
            className="flex-shrink-0 bg-amber-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Connect Calendar
          </a>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">This week&apos;s meetings</h2>
        <p className="text-sm text-gray-400 italic">No meetings found for this week.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">This week&apos;s meetings</h2>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">

        {/* Earlier today / past — collapsed by default */}
        {pastEvents.length > 0 && (
          <>
            <button
              onClick={() => setShowEarlier((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Earlier ({pastEvents.length})
              </span>
              <span className="text-xs text-gray-400">{showEarlier ? '▲' : '▼'}</span>
            </button>
            {showEarlier && pastEvents.map((e) => renderEventRow(e, true))}
          </>
        )}

        {/* Upcoming — grouped by day */}
        {upcomingGroups.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-5 py-4">No upcoming meetings today or tomorrow.</p>
        ) : (
          upcomingGroups.map((group) => (
            <div key={`${group.date.getFullYear()}-${group.date.getMonth()}-${group.date.getDate()}`}>
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {formatDayLabel(group.date, now)}
                </p>
              </div>
              {group.events.map((e) => renderEventRow(e, false))}
            </div>
          ))
        )}

        {/* Show full week toggle */}
        {laterEvents.length > 0 && (
          <button
            onClick={() => setShowFullWeek((v) => !v)}
            className="w-full px-5 py-2.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors text-center"
          >
            {showFullWeek ? 'Show less ▲' : `Show full week (${laterEvents.length} more) ▼`}
          </button>
        )}
      </div>
    </div>
  )
}
