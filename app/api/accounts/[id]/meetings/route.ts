import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getEventsForDateRange, refreshCalendarToken } from '@/lib/calendar'
import type { CalendarEvent } from '@/lib/calendar'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meetings, error } = await supabase
    .from('meeting_history')
    .select('id, meeting_date, processed_at, file_id, file_name, summary, psm_action_items, protocol_action_items, health_status, health_reason, raw_transcript')
    .eq('account_id', id)
    .eq('user_id', user.id)
    .order('processed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch upcoming calendar events linked to this account
  let upcoming: CalendarEvent[] = []
  try {
    const { data: links } = await supabase
      .from('meeting_links')
      .select('calendar_event_id')
      .eq('account_id', id)
      .eq('user_id', user.id)

    const linkedEventIds = new Set((links ?? []).map((l: { calendar_event_id: string }) => l.calendar_event_id))

    if (linkedEventIds.size > 0) {
      const { data: calConn } = await supabase
        .from('calendar_connections')
        .select('access_token, refresh_token, token_expires_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (calConn) {
        let token = calConn.access_token as string
        if (
          calConn.token_expires_at && calConn.refresh_token &&
          new Date(calConn.token_expires_at as string).getTime() - Date.now() < 10 * 60 * 1000
        ) {
          const refreshed = await refreshCalendarToken(calConn.refresh_token as string, user.id)
          token = refreshed.access_token
        }
        const timeMin = new Date().toISOString()
        const timeMax = new Date(Date.now() + 30 * 86400000).toISOString()
        const allEvents = await getEventsForDateRange(token, timeMin, timeMax)
        upcoming = allEvents.filter(e => linkedEventIds.has(e.id))
      }
    }
  } catch {
    // Non-fatal — upcoming stays empty
  }

  return NextResponse.json({ meetings: meetings ?? [], upcoming })
}

// PATCH — reassign a meeting to a different account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meeting_id, new_account_id } = await request.json()
  if (!meeting_id || !new_account_id) {
    return NextResponse.json({ error: 'meeting_id and new_account_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('meeting_history')
    .update({ account_id: new_account_id })
    .eq('id', meeting_id)
    .eq('account_id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
