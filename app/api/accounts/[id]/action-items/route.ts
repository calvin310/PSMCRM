import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

type StatusEntry = { index: number; done: boolean; comment?: string; dueDate?: string | null }

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
    const { type } = body

    const statusKey = type === 'psm' ? 'psm_action_items_status' : 'protocol_action_items_status'
    const itemsKey = type === 'psm' ? 'psm_action_items' : 'protocol_action_items'

    // Fetch current values
    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select(`${itemsKey}, ${statusKey}`)
      .eq('id', id)
      .eq('psm_id', user.id)
      .single()

    if (fetchError || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = account as any
    const statusArray: StatusEntry[] = (row[statusKey] as StatusEntry[]) ?? []

    // Case 1: toggle done
    if ('done' in body) {
      const existing = statusArray.find((s) => s.index === body.index)
      if (existing) {
        existing.done = body.done
      } else {
        statusArray.push({ index: body.index, done: body.done })
      }
      await supabase.from('accounts').update({ [statusKey]: statusArray, updated_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    // Case 2: add/update comment
    if ('comment' in body) {
      const existing = statusArray.find((s) => s.index === body.index)
      if (existing) {
        existing.comment = body.comment
      } else {
        statusArray.push({ index: body.index, done: false, comment: body.comment })
      }
      await supabase.from('accounts').update({ [statusKey]: statusArray, updated_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    // Case 3: add new item
    if (body.action === 'add') {
      const items: string[] = (row[itemsKey] as string[]) ?? []
      const newIndex = items.length
      items.push(body.text)
      statusArray.push({ index: newIndex, done: false })
      await supabase.from('accounts').update({
        [itemsKey]: items,
        [statusKey]: statusArray,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ success: true, newIndex })
    }

    // Case 4: edit existing item text
    if (body.action === 'edit') {
      const items: string[] = (row[itemsKey] as string[]) ?? []
      if (body.index < 0 || body.index >= items.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
      }
      items[body.index] = body.text
      await supabase.from('accounts').update({
        [itemsKey]: items,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    // Case 5: delete item
    if (body.action === 'delete') {
      const items: string[] = (row[itemsKey] as string[]) ?? []
      if (body.index < 0 || body.index >= items.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
      }
      items.splice(body.index, 1)
      const newStatusArray = statusArray
        .filter((s) => s.index !== body.index)
        .map((s) => s.index > body.index ? { ...s, index: s.index - 1 } : s)
      await supabase.from('accounts').update({
        [itemsKey]: items,
        [statusKey]: newStatusArray,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    // Case 6: set due date
    if (body.action === 'set-due-date') {
      const existing = statusArray.find((s) => s.index === body.index)
      if (existing) {
        existing.dueDate = body.dueDate ?? null
      } else {
        statusArray.push({ index: body.index, done: false, dueDate: body.dueDate ?? null })
      }
      await supabase.from('accounts').update({ [statusKey]: statusArray, updated_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
