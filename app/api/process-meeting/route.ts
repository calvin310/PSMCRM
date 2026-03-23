import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `You are an AI assistant for a Partner Success Manager (PSM) at Aptos Foundation. You will be given a meeting transcript or meeting notes from a call between a PSM and a protocol team. Your job is to extract structured information from this content.

Extract the following and return ONLY a valid JSON object. No markdown, no code fences, no explanation. Start with { and end with }.

{
  "summary": ["3 to 5 bullet points as strings summarising what happened and what was decided"],
  "psm_action_items": ["list of strings — things the PSM needs to do, each starting with a verb"],
  "protocol_action_items": ["list of strings — things the protocol team needs to do, each starting with a verb"],
  "health_status": "green or yellow or red",
  "health_reason": "one sentence explaining why you assigned that health status",
  "blockers": ["list of strings — problems, blockers, or risks mentioned"],
  "what_working": ["list of strings — positive signals, wins, or things going well"],
  "exploring": ["list of strings — things the protocol is considering, evaluating, or exploring strategically"],
  "key_dates": ["list of strings — any deadlines, milestones, or dates mentioned with context"],
  "follow_up_draft": ["bullet point strings the PSM can use as a starting point for their follow-up message. Each bullet covers one topic — what was discussed, what was decided, or what comes next. Write in first person as the PSM. Keep each bullet concise and actionable."]
}

Rules:
- Extract from the actual content only — do not invent or assume anything not mentioned
- If a field has nothing to extract, return an empty array [] or empty string
- health_status should be: green if relationship is positive and progressing, yellow if concerns or blockers exist but relationship is intact, red if relationship is at risk or there are serious unresolved issues
- For follow_up_draft focus on what matters most — decisions made, next steps, and anything urgent`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, transcript, file_id, file_name } = body

    if (!account_id || !transcript) {
      return NextResponse.json({ error: 'Missing account_id or transcript' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid JSON. Raw response: ' + rawText.slice(0, 200) },
        { status: 500 }
      )
    }

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        last_meeting_summary: extracted.summary ?? [],
        psm_action_items: extracted.psm_action_items ?? [],
        protocol_action_items: extracted.protocol_action_items ?? [],
        health_status: extracted.health_status ?? 'green',
        health_reason: extracted.health_reason ?? '',
        blockers: extracted.blockers ?? [],
        what_working: extracted.what_working ?? [],
        exploring: extracted.exploring ?? [],
        key_dates: extracted.key_dates ?? [],
        follow_up_draft: extracted.follow_up_draft ?? [],
        raw_transcript: transcript,
        last_meeting_date: now,
        updated_at: now,
      })
      .eq('id', account_id)
      .eq('psm_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: historyError } = await supabase.from('meeting_history').insert({
      account_id,
      user_id: user.id,
      file_id: file_id ?? null,
      file_name: file_name ?? null,
      meeting_date: now,
      processed_at: now,
      summary: extracted.summary ?? [],
      psm_action_items: extracted.psm_action_items ?? [],
      protocol_action_items: extracted.protocol_action_items ?? [],
      health_status: extracted.health_status ?? 'green',
      health_reason: extracted.health_reason ?? '',
      blockers: extracted.blockers ?? [],
      what_working: extracted.what_working ?? [],
      exploring: extracted.exploring ?? [],
      key_dates: extracted.key_dates ?? [],
      follow_up_draft: extracted.follow_up_draft ?? [],
      raw_transcript: transcript,
    })

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 })
    }

    // Remove from pending_notes if it came from Drive
    if (file_id) {
      await supabase
        .from('pending_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('file_id', file_id)
    }

    return NextResponse.json(extracted)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
