import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEventsForDateRange, refreshCalendarToken } from '@/lib/calendar'
import MeetingsClient from './MeetingsClient'

export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = Date.now()
  const timeMin = new Date(now - 30 * 86400000).toISOString()
  const timeMax = new Date(now + 30 * 86400000).toISOString()

  const [
    { data: accounts },
    { data: calConn },
    { data: links },
    { data: prefs },
    { data: pendingNotes },
    { data: recentMeetings },
  ] = await Promise.all([
    supabase.from('accounts').select('id, name').order('name'),
    supabase.from('calendar_connections').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('meeting_links').select('calendar_event_id, account_id').eq('user_id', user.id),
    supabase.from('meeting_preferences').select('calendar_event_id, preference').eq('user_id', user.id),
    supabase.from('pending_notes').select('id, file_id, file_name, drive_created_at').eq('user_id', user.id).order('drive_created_at', { ascending: false }),
    supabase.from('meeting_history').select('account_id, meeting_date, processed_at').eq('user_id', user.id).gte('processed_at', new Date(now - 60 * 86400000).toISOString()),
  ])

  // Build meetings by account map: accountId → array of date strings
  const meetingsByAccount: Record<string, string[]> = {}
  for (const m of recentMeetings ?? []) {
    const date = m.meeting_date ?? m.processed_at
    if (!meetingsByAccount[m.account_id]) meetingsByAccount[m.account_id] = []
    meetingsByAccount[m.account_id].push(date)
  }

  const initialLinks: Record<string, string> = {}
  for (const l of links ?? []) initialLinks[l.calendar_event_id] = l.account_id

  const initialPreferences: Record<string, string> = {}
  for (const p of prefs ?? []) initialPreferences[p.calendar_event_id] = p.preference

  let events: Awaited<ReturnType<typeof getEventsForDateRange>> = []
  const calendarConnected = !!calConn

  if (calConn) {
    try {
      let token = calConn.access_token as string
      if (
        calConn.token_expires_at && calConn.refresh_token &&
        new Date(calConn.token_expires_at as string).getTime() - now < 10 * 60 * 1000
      ) {
        const refreshed = await refreshCalendarToken(calConn.refresh_token as string, user.id)
        token = refreshed.access_token
      }
      events = await getEventsForDateRange(token, timeMin, timeMax)
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Meetings</h1>
      <MeetingsClient
        events={events}
        accounts={accounts ?? []}
        initialLinks={initialLinks}
        initialPreferences={initialPreferences}
        meetingsByAccount={meetingsByAccount}
        pendingNotes={pendingNotes ?? []}
        calendarConnected={calendarConnected}
      />
    </div>
  )
}
