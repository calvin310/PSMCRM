import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ProcessMeeting from './ProcessMeeting'
import CopyButton from './CopyButton'
import ClearMeetingButton from './ClearMeetingButton'
import EditSection from './EditSection'
import ActionItemsList from './ActionItemsList'
import NotesSection from './NotesSection'
import StickyTabs from './StickyTabs'
import AccountTabs from './AccountTabs'

const HEALTH_STYLES: Record<string, { badge: string; label: string }> = {
  green: { badge: 'bg-green-100 text-green-700 border-green-200', label: 'Healthy' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'At risk' },
  red: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Critical' },
}

const STAGE_BADGE: Record<string, string> = {
  onboarding: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  'at-risk': 'bg-yellow-100 text-yellow-700',
  churned: 'bg-gray-100 text-gray-500',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0)
    return <p className="text-sm text-gray-400 italic">Nothing recorded</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-700">
          <span className="text-gray-400 mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, { data: latestMeeting }, { data: initialNotes }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).single(),
    supabase.from('meeting_history').select('*').eq('account_id', id)
      .order('processed_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('account_notes').select('*').eq('account_id', id)
      .order('created_at', { ascending: false }).limit(20),
  ])

  if (!account) notFound()

  const health = HEALTH_STYLES[account.health_status] ?? HEALTH_STYLES.green
  const updatedAt = account.updated_at as string

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto flex flex-col gap-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/accounts" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Accounts
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-medium text-gray-900">{account.name}</h1>
      </div>

      <AccountTabs
        accountId={id}
        overviewContent={<>
      {/* Sticky tabs */}
      <StickyTabs />

      {/* Section 1 — Overview */}
      <div id="overview">
      <EditSection
        key={`overview-${updatedAt}`}
        title="Overview"
        fields={[
          { key: 'what_building', label: "What they're building", type: 'textarea' },
          { key: 'current_focus', label: 'Current focus', type: 'textarea' },
          { key: 'current_status', label: 'Current status', type: 'textarea' },
          { key: 'relationship_stage', label: 'Stage', type: 'select' },
          { key: 'comms_channel', label: 'Comms channel', type: 'select' },
        ]}
        values={{
          what_building: account.what_building,
          current_focus: account.current_focus,
          current_status: account.current_status,
          relationship_stage: account.relationship_stage,
          comms_channel: account.comms_channel,
        }}
        accountId={account.id}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Account name</p>
            <p className="text-base font-semibold text-gray-900">{account.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Stage</p>
            {account.relationship_stage ? (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${STAGE_BADGE[account.relationship_stage] ?? 'bg-gray-100 text-gray-600'}`}>
                {account.relationship_stage}
              </span>
            ) : <p className="text-sm text-gray-400 italic">—</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Comms channel</p>
            <p className="text-sm text-gray-700 capitalize">{account.comms_channel ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Current focus</p>
            <p className="text-sm text-gray-700">{account.current_focus ?? '—'}</p>
          </div>
          {account.what_building && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-1">What they&apos;re building</p>
              <p className="text-sm text-gray-700">{account.what_building}</p>
            </div>
          )}
          {account.current_status && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-1">Current status</p>
              <p className="text-sm text-gray-700">{account.current_status}</p>
            </div>
          )}
        </div>
      </EditSection>
      </div>

      {/* Section 2 — Health */}
      <div id="health">
      <EditSection
        key={`health-${updatedAt}`}
        title="Health"
        fields={[
          { key: 'health_status', label: 'Health status', type: 'health' },
          { key: 'health_reason', label: 'Reason', type: 'textarea' },
        ]}
        values={{ health_status: account.health_status, health_reason: account.health_reason }}
        accountId={account.id}
      >
        <div className="flex flex-col gap-3">
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border w-fit ${health.badge}`}>
            {health.label}
          </span>
          {account.health_reason ? (
            <p className="text-sm text-gray-700">{account.health_reason}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No health context recorded</p>
          )}
        </div>
      </EditSection>
      </div>

      {/* Section 3 — Last meeting (not editable inline) */}
      <div id="last-meeting">
      <Section title="Last meeting">
        <div className="flex items-center gap-3 mb-3">
          {account.last_meeting_date && (
            <p className="text-xs text-gray-400">
              {new Date(account.last_meeting_date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          )}
          {latestMeeting && (
            <ClearMeetingButton meetingHistoryId={latestMeeting.id} accountId={account.id} />
          )}
        </div>
        <BulletList items={account.last_meeting_summary} />
      </Section>
      </div>

      {/* Section 4 — Action items */}
      <div id="action-items">
      <Section title="Action items">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">PSM owes</p>
            <ActionItemsList
              items={account.psm_action_items ?? []}
              statusItems={account.psm_action_items_status ?? []}
              type="psm"
              accountId={account.id}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Protocol owes</p>
            <ActionItemsList
              items={account.protocol_action_items ?? []}
              statusItems={account.protocol_action_items_status ?? []}
              type="protocol"
              accountId={account.id}
            />
          </div>
        </div>
      </Section>
      </div>

      {/* Section 5 — Intelligence */}
      <div id="intelligence">
      <EditSection
        key={`intelligence-${updatedAt}`}
        title="Intelligence"
        fields={[
          { key: 'blockers', label: 'Blockers', type: 'array' },
          { key: 'exploring', label: 'Exploring', type: 'array' },
          { key: 'sector_trends', label: 'Sector trends', type: 'textarea' },
        ]}
        values={{
          blockers: account.blockers,
          exploring: account.exploring,
          sector_trends: account.sector_trends,
        }}
        accountId={account.id}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Blockers</p>
            <BulletList items={account.blockers} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Exploring</p>
            <BulletList items={account.exploring} />
          </div>
          {account.sector_trends && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Sector trends</p>
              <p className="text-sm text-gray-700">{account.sector_trends}</p>
            </div>
          )}
        </div>
      </EditSection>
      </div>

      {/* Section 6 — What's working */}
      <div id="what-working">
      <EditSection
        key={`working-${updatedAt}`}
        title="What's working"
        fields={[{ key: 'what_working', label: "What's working", type: 'array' }]}
        values={{ what_working: account.what_working }}
        accountId={account.id}
      >
        <BulletList items={account.what_working} />
      </EditSection>
      </div>

      {/* Section 7 — Key dates */}
      <div id="key-dates">
      <EditSection
        key={`keydates-${updatedAt}`}
        title="Key dates"
        fields={[{ key: 'key_dates', label: 'Key dates', type: 'array' }]}
        values={{ key_dates: account.key_dates }}
        accountId={account.id}
      >
        <BulletList items={account.key_dates} />
      </EditSection>
      </div>

      {/* Section 8 — Follow up draft */}
      <div id="follow-up">
      <EditSection
        key={`followup-${updatedAt}`}
        title="Follow up draft"
        fields={[{ key: 'follow_up_draft', label: 'Follow up draft', type: 'array' }]}
        values={{ follow_up_draft: account.follow_up_draft }}
        accountId={account.id}
      >
        <div className="flex flex-col gap-3">
          {account.follow_up_draft && account.follow_up_draft.length > 0 ? (
            <>
              <BulletList items={account.follow_up_draft} />
              <CopyButton text={account.follow_up_draft.map((b: string) => `• ${b}`).join('\n')} />
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No follow-up draft yet — process a meeting to generate one</p>
          )}
        </div>
      </EditSection>
      </div>

      {/* Notes */}
      <div id="notes">
      <NotesSection
        accountId={account.id}
        initialNotes={initialNotes ?? []}
        userEmail={user.email ?? ''}
      />
      </div>

      {/* Process meeting notes */}
      <div id="process-meeting">
      <Section title="Process meeting notes">
        <ProcessMeeting accountId={account.id} />
      </Section>
      </div>
        </>}
      />
    </div>
  )
}
