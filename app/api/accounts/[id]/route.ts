import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: account }, { data: latestMeeting }, { data: notes }] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', id).single(),
      supabase.from('meeting_history').select('*').eq('account_id', id)
        .order('processed_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('account_notes').select('*').eq('account_id', id)
        .order('created_at', { ascending: false }).limit(20),
    ])

    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ account, latestMeeting: latestMeeting ?? null, notes: notes ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const { error } = await supabase
      .from('accounts')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('psm_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
