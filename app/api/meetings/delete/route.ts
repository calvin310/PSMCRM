import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { meeting_history_id, account_id } = await request.json()

    if (!meeting_history_id || !account_id) {
      return NextResponse.json({ error: 'Missing meeting_history_id or account_id' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the meeting_history row belongs to this user
    const { data: meeting } = await supabase
      .from('meeting_history')
      .select('id')
      .eq('id', meeting_history_id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Clear all AI-extracted fields on the account
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        health_status: 'green',
        health_reason: null,
        last_meeting_date: null,
        last_meeting_summary: [],
        psm_action_items: [],
        protocol_action_items: [],
        what_working: [],
        blockers: [],
        exploring: [],
        key_dates: [],
        follow_up_draft: [],
        raw_transcript: null,
        current_focus: null,
        current_status: null,
        updated_at: now,
      })
      .eq('id', account_id)
      .eq('psm_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Delete the meeting_history row
    const { error: deleteError } = await supabase
      .from('meeting_history')
      .delete()
      .eq('id', meeting_history_id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
