import { createClient } from '@/lib/supabase-server'

export type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

function getWeekBounds() {
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun
  const daysFromMonday = (dayOfWeek + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysFromMonday)
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { timeMin: monday.toISOString(), timeMax: sunday.toISOString() }
}

export async function refreshCalendarToken(refreshToken: string, userId: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error('Calendar token refresh failed')

  const { access_token, expires_in } = await res.json()
  const supabase = await createClient()
  await supabase
    .from('calendar_connections')
    .update({
      access_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { access_token, expires_in }
}

async function fetchCalendarEvents(accessToken: string, timeMin: string, timeMax: string, maxResults = 50): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (res.status === 401) throw new Error('token_expired')
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`)

  const data = await res.json()
  return data.items ?? []
}

export async function getThisWeekEvents(accessToken: string): Promise<CalendarEvent[]> {
  const { timeMin, timeMax } = getWeekBounds()
  return fetchCalendarEvents(accessToken, timeMin, timeMax)
}

export async function getEventsForDateRange(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  return fetchCalendarEvents(accessToken, timeMin, timeMax, 100)
}
