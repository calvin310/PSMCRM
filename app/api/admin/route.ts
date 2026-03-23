import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

// POST { action: 'make' | 'remove', target_user_id: string }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check caller is admin
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { action, target_user_id } = await request.json()
    const admin = createAdminClient()

    if (action === 'make') {
      await admin.from('admin_users').upsert({ user_id: target_user_id })
    } else if (action === 'remove') {
      await admin.from('admin_users').delete().eq('user_id', target_user_id)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
