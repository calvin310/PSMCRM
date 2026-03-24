import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { getDriveFiles, exportFileAsText, refreshAccessToken } from '@/lib/drive'
import { getEventsForDateRange, type CalendarEvent } from '@/lib/calendar'

// ── Fuzzy title matching ───────────────────────────────────────────────────

function extractMeetingTitle(fileName: string): string {
  // Old format: "Notes from Weekly Sync Hyperion"
  // New format: "Weekly Sync Hyperion - 2026/03/23 08:27 EDT - Notes by Gemini"
  return fileName
    .replace(/^Notes from\s+/i, '')
    .replace(/\s+-\s+\d{4}[\/\-]\d{2}[\/\-]\d{2}.*?Notes by Gemini.*$/i, '')
    .replace(/\.docx?$/i, '')
    .trim()
}

function fuzzyScore(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean)
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean)
  if (wordsA.length === 0 || wordsB.length === 0) return 0
  const matches = wordsA.filter((w) => wordsB.includes(w)).length
  return matches / Math.max(wordsA.length, wordsB.length)
}

function findBestMatch(title: string, events: CalendarEvent[]): CalendarEvent | null {
  let best: CalendarEvent | null = null
  let bestScore = 0
  for (const event of events) {
    if (!event.summary) continue
    const score = fuzzyScore(title, event.summary)
    if (score >= 0.6 && score > bestScore) {
      best = event
      bestScore = score
    }
  }
  return best
}

// ── Calendar token refresh (inline, no cookie dependency) ─────────────────

async function refreshCalendarTokenInline(
  refreshToken: string,
  userId: string,
  db: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
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
  // Best-effort save
  await db.from('calendar_connections').update({
    access_token,
    token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
  return access_token
}

// ── Main sync function ─────────────────────────────────────────────────────

async function syncConnection(
  _db: unknown,
  connection: {
    user_id: string
    access_token: string
    refresh_token: string | null
    token_expires_at: string | null
    gemini_folder_id: string | null
    last_synced_at: string | null
  }
): Promise<number> {
  // Always use service-role client inside syncConnection — this runs in a trusted
  // server context (cron or server-side POST) and needs to bypass RLS to operate
  // on behalf of any user.
  const db = createAdminClient()

  let accessToken = connection.access_token

  // Refresh drive token if expiring within 10 minutes
  if (
    connection.token_expires_at &&
    connection.refresh_token &&
    new Date(connection.token_expires_at).getTime() - Date.now() < 10 * 60 * 1000
  ) {
    const refreshed = await refreshAccessToken(connection.refresh_token, connection.user_id)
    accessToken = refreshed.access_token
  }

  if (!connection.gemini_folder_id) return 0

  const afterDate = connection.last_synced_at ?? '2000-01-01T00:00:00Z'
  const files = await getDriveFiles(
    accessToken,
    connection.gemini_folder_id,
    afterDate,
    connection.refresh_token ?? undefined,
    connection.user_id
  )

  // ── Fetch skip preferences and calendar events ─────────────────────────

  // Only fetch 'skip' preferences — that's all we act on during sync
  const { data: skipPrefs } = await db
    .from('meeting_preferences')
    .select('calendar_event_id')
    .eq('user_id', connection.user_id)
    .eq('preference', 'skip')

  const skipSet = new Set((skipPrefs ?? []).map((p) => p.calendar_event_id as string))

  // Fetch calendar events covering the sync window (capped to 30 days back)
  let calendarEvents: CalendarEvent[] = []
  if (skipSet.size > 0) {
    // Only bother fetching calendar data if there are skip preferences
    try {
      const { data: calConn } = await db
        .from('calendar_connections')
        .select('*')
        .eq('user_id', connection.user_id)
        .maybeSingle()

      if (calConn) {
        let calToken = calConn.access_token as string
        if (
          calConn.token_expires_at &&
          calConn.refresh_token &&
          new Date(calConn.token_expires_at as string).getTime() - Date.now() < 10 * 60 * 1000
        ) {
          calToken = await refreshCalendarTokenInline(
            calConn.refresh_token as string,
            connection.user_id,
            db
          )
        }

        // Fetch events from (afterDate or 30d ago) -1d to now+1d
        const windowStart = new Date(
          Math.max(new Date(afterDate).getTime(), Date.now() - 30 * 86400000)
        )
        const timeMin = new Date(windowStart.getTime() - 86400000).toISOString()
        const timeMax = new Date(Date.now() + 86400000).toISOString()

        calendarEvents = await getEventsForDateRange(calToken, timeMin, timeMax)
      }
    } catch {
      // Non-fatal: proceed without preference checking
      calendarEvents = []
    }
  }

  // ── Process each file ─────────────────────────────────────────────────

  let added = 0
  let skipped = 0
  const skippedFiles: string[] = []

  for (const file of files) {
    // Skip if already in pending_notes or meeting_history
    const [{ data: existingPending }, { data: existingHistory }] = await Promise.all([
      db.from('pending_notes').select('id').eq('user_id', connection.user_id).eq('file_id', file.id).maybeSingle(),
      db.from('meeting_history').select('id').eq('user_id', connection.user_id).eq('file_id', file.id).maybeSingle(),
    ])

    if (existingPending || existingHistory) {
      skipped++
      skippedFiles.push(`${file.name ?? file.id} (already processed)`)
      continue
    }

    // Check meeting preference before fetching content
    if (calendarEvents.length > 0) {
      const title = extractMeetingTitle(file.name ?? '')
      const match = findBestMatch(title, calendarEvents)
      if (match && skipSet.has(match.id)) {
        skipped++
        skippedFiles.push(`${file.name ?? file.id} (marked skip)`)
        continue
      }
    }

    let content = ''
    try {
      content = await exportFileAsText(accessToken, file.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'token_expired') continue
      throw err
    }

    await db.from('pending_notes').insert({
      user_id: connection.user_id,
      file_id: file.id,
      file_name: file.name,
      content,
      drive_created_at: file.createdTime,
    })

    added++
  }

  await db
    .from('drive_connections')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', connection.user_id)

  return { found: files.length, added, skipped, skippedFiles }
}

// GET — cron trigger
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminDb = createAdminClient()
  const { data: connections } = await adminDb.from('drive_connections').select('*')

  if (!connections || connections.length === 0) {
    return NextResponse.json({ success: true, new_notes: 0 })
  }

  let totalAdded = 0
  for (const conn of connections) {
    try {
      const result = await syncConnection(null, conn)
      totalAdded += result.added
    } catch {
      // Continue with other connections on error
    }
  }

  return NextResponse.json({ success: true, new_notes: totalAdded })
}

// POST — manual trigger from dashboard
export async function POST() {
  const userDb = await createClient()

  const {
    data: { user },
  } = await userDb.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connection } = await userDb
    .from('drive_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'No Drive connection found' }, { status: 404 })
  }

  try {
    const result = await syncConnection(null, connection)
    return NextResponse.json({ success: true, new_notes: result.added, found: result.found, added: result.added, skipped: result.skipped, skipped_files: result.skippedFiles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[drive/sync POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
