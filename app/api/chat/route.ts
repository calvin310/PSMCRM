import { createClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Account {
  id: string
  name: string
  health_status?: string
  health_reason?: string
  relationship_stage?: string
  current_focus?: string
  current_status?: string
  what_building?: string
  blockers?: string[]
  exploring?: string[]
  what_working?: string[]
  key_dates?: string[]
  psm_action_items?: string[]
  psm_action_items_status?: { index: number; done: boolean; comment?: string; dueDate?: string }[]
  protocol_action_items?: string[]
  protocol_action_items_status?: { index: number; done: boolean; comment?: string; dueDate?: string }[]
  last_meeting_date?: string
  last_meeting_summary?: string[]
}

interface Meeting {
  id: string
  account_id: string
  meeting_date?: string
  summary?: string[]
  psm_action_items?: string[]
  protocol_action_items?: string[]
  health_status?: string
  blockers?: string[]
  what_working?: string[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function buildContext(accounts: Account[], meetings: Meeting[]): string {
  const meetingsByAccount = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    if (!acc[m.account_id]) acc[m.account_id] = []
    acc[m.account_id].push(m)
    return acc
  }, {})

  const accountSections = accounts.map((a) => {
    const acctMeetings = (meetingsByAccount[a.id] || []).slice(0, 3)
    const recentMeetings = acctMeetings
      .map((m) => `  - ${m.meeting_date || 'unknown date'}: ${(m.summary || []).slice(0, 2).join(' | ')}`)
      .join('\n')

    const openPsmItems = (a.psm_action_items || []).filter((_, i) => {
      const status = a.psm_action_items_status?.[i]
      return !status?.done
    })

    const openProtocolItems = (a.protocol_action_items || []).filter((_, i) => {
      const status = a.protocol_action_items_status?.[i]
      return !status?.done
    })

    return `### ${a.name}
- Health: ${a.health_status || 'unknown'}${a.health_reason ? ` — ${a.health_reason}` : ''}
- Stage: ${a.relationship_stage || 'unknown'}
- What they're building: ${a.what_building || 'n/a'}
- Current focus: ${a.current_focus || 'n/a'}
- Current status: ${a.current_status || 'n/a'}
- Blockers: ${(a.blockers || []).join('; ') || 'none'}
- What's working: ${(a.what_working || []).join('; ') || 'n/a'}
- Exploring: ${(a.exploring || []).join('; ') || 'n/a'}
- Key dates: ${(a.key_dates || []).join('; ') || 'none'}
- Open PSM action items (${openPsmItems.length}): ${openPsmItems.length > 0 ? openPsmItems.join('; ') : 'none'}
- Open protocol action items (${openProtocolItems.length}): ${openProtocolItems.length > 0 ? openProtocolItems.join('; ') : 'none'}
- Last meeting: ${a.last_meeting_date || 'unknown'}${recentMeetings ? `\n- Recent meetings:\n${recentMeetings}` : ''}`
  })

  return accountSections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let messages: ChatMessage[]
  try {
    ;({ messages } = await req.json())
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  // Fetch portfolio data
  const [{ data: accounts }, { data: meetings }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('psm_id', user.id)
      .order('name'),
    supabase
      .from('meeting_history')
      .select(
        'id, account_id, meeting_date, summary, psm_action_items, protocol_action_items, health_status, blockers, what_working'
      )
      .eq('user_id', user.id)
      .order('meeting_date', { ascending: false })
      .limit(60),
  ])

  const context = buildContext(
    (accounts as Account[]) || [],
    (meetings as Meeting[]) || []
  )

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const systemPrompt = `You are an AI assistant embedded in a PSM (Partner Success Manager) platform. You help PSMs stay on top of their accounts, surface insights, and answer questions about meetings and action items.

Today is ${today}.

Below is the current portfolio data for this PSM:

${context}

Guidelines:
- Be concise and direct. Get to the answer fast.
- Reference account names specifically.
- Flag red/at-risk accounts proactively when discussing portfolio health.
- For action items, distinguish open vs. completed.
- If a piece of information isn't in the data, say so — don't invent details.
- Use bullet points for lists; prose for short answers.`

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of messageStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
