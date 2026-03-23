import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

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
    .select('id, meeting_date, processed_at, file_name, summary, psm_action_items, protocol_action_items, health_status, health_reason')
    .eq('account_id', id)
    .eq('user_id', user.id)
    .order('processed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings: meetings ?? [] })
}
