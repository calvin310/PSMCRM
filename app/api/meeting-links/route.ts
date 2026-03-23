import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { calendar_event_id, account_id } = await request.json()

    if (!calendar_event_id || !account_id) {
      return NextResponse.json({ error: 'Missing calendar_event_id or account_id' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('meeting_links').upsert(
      { user_id: user.id, calendar_event_id, account_id },
      { onConflict: 'user_id,calendar_event_id' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}
