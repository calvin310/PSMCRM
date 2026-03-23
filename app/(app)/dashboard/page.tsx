import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getThisWeekEvents, refreshCalendarToken } from '@/lib/calendar'
import type { ActionItem } from './ActionItems'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = Date.now()
  const fourteenDaysAgo = new Date(now - 14 * 86400000)
  const mondayStart = (() => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    d.setUTCHours(0, 0, 0, 0)
    return d
  })()

  const [
    { data: accounts },
    { data: pendingNotes },
    { data: driveConnection },
    { data: calendarConnection },
    { data: meetingLinks },
    { data: meetingPrefs },
  ] = await Promise.all([
    supabase.from('accounts').select('*').order('updated_at', { ascending: false }),
    supabase.from('pending_notes').select('*').eq('user_id', user.id).order('drive_created_at', { ascending: false }),
    supabase.from('drive_connections').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('calendar_connections').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('meeting_links').select('*').eq('user_id', user.id),
    supabase.from('meeting_preferences').select('*').eq('user_id', user.id),
  ])

  // Refresh calendar token if needed, then fetch events
  let calendarEvents: Awaited<ReturnType<typeof getThisWeekEvents>> = []
  const calendarConnected = !!calendarConnection

  if (calendarConnection) {
    try {
      let token = calendarConnection.access_token
      if (
        calendarConnection.token_expires_at &&
        calendarConnection.refresh_token &&
        new Date(calendarConnection.token_expires_at).getTime() - now < 10 * 60 * 1000
      ) {
        const refreshed = await refreshCalendarToken(calendarConnection.refresh_token, user.id)
        token = refreshed.access_token
      }
      calendarEvents = await getThisWeekEvents(token)
    } catch {
      // Non-fatal — show connected state but no events
    }
  }

  // Build initial meeting links map: eventId → accountId
  const initialLinks: Record<string, string> = {}
  for (const link of meetingLinks ?? []) {
    initialLinks[link.calendar_event_id] = link.account_id
  }

  // Build initial preferences map: eventId → preference
  const initialPreferences: Record<string, string> = {}
  for (const pref of meetingPrefs ?? []) {
    initialPreferences[pref.calendar_event_id] = pref.preference
  }

  const allAccounts = accounts ?? []

  // Quick stats
  const stats = {
    total: allAccounts.length,
    red: allAccounts.filter((a) => a.health_status === 'red').length,
    pending: pendingNotes?.length ?? 0,
    openItems: allAccounts.reduce((sum, a) => sum + (a.psm_action_items?.length ?? 0), 0),
  }

  // Needs attention — red health OR had a meeting but it was >14 days ago
  // Excludes brand-new accounts with no meeting date yet
  const needsAttention = allAccounts.filter(
    (a) =>
      a.health_status === 'red' ||
      (a.last_meeting_date && new Date(a.last_meeting_date) < fourteenDaysAgo)
  )

  // Action items — flatten all accounts
  const actionItems: ActionItem[] = allAccounts
    .sort((a, b) => {
      if (!a.last_meeting_date && !b.last_meeting_date) return 0
      if (!a.last_meeting_date) return 1
      if (!b.last_meeting_date) return -1
      return new Date(b.last_meeting_date).getTime() - new Date(a.last_meeting_date).getTime()
    })
    .flatMap((account) => {
      const isOverdue =
        !account.last_meeting_date || new Date(account.last_meeting_date) < fourteenDaysAgo
      const isThisWeek =
        !!account.last_meeting_date && new Date(account.last_meeting_date) >= mondayStart
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const psmStatus: any[] = account.psm_action_items_status ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const protocolStatus: any[] = account.protocol_action_items_status ?? []
      return [
        ...(account.psm_action_items ?? []).map((text: string, index: number) => {
          const s = psmStatus.find((e) => e.index === index)
          return {
            text,
            type: 'PSM' as const,
            accountId: account.id,
            accountName: account.name,
            lastMeetingDate: account.last_meeting_date,
            isOverdue,
            isThisWeek,
            index,
            done: s?.done ?? false,
            comment: s?.comment ?? '',
            dueDate: s?.dueDate ?? null,
          }
        }),
        ...(account.protocol_action_items ?? []).map((text: string, index: number) => {
          const s = protocolStatus.find((e) => e.index === index)
          return {
            text,
            type: 'Protocol' as const,
            accountId: account.id,
            accountName: account.name,
            lastMeetingDate: account.last_meeting_date,
            isOverdue,
            isThisWeek,
            index,
            done: s?.done ?? false,
            comment: s?.comment ?? '',
            dueDate: s?.dueDate ?? null,
          }
        }),
      ]
    })

  return (
    <DashboardClient
      accounts={allAccounts}
      driveConnected={!!driveConnection}
      driveLastSynced={driveConnection?.last_synced_at ?? null}
      pendingNotes={pendingNotes ?? []}
      calendarConnected={calendarConnected}
      calendarEvents={calendarEvents}
      initialLinks={initialLinks}
      initialPreferences={initialPreferences}
      needsAttention={needsAttention}
      actionItems={actionItems}
      stats={stats}
      userEmail={user.email ?? ''}
    />
  )
}
