'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EditSection from '../accounts/[id]/EditSection'
import ActionItemsList from '../accounts/[id]/ActionItemsList'
import NotesSection from '../accounts/[id]/NotesSection'
import ProcessMeeting from '../accounts/[id]/ProcessMeeting'
import ClearMeetingButton from '../accounts/[id]/ClearMeetingButton'
import CopyButton from '../accounts/[id]/CopyButton'
import StickyTabs from '../accounts/[id]/StickyTabs'
import MeetingHistory from '../accounts/[id]/MeetingHistory'
import ContactSection from '../accounts/[id]/ContactSection'

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

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

type Note = { id: string; content: string; user_email: string; created_at: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Account = Record<string, any>
type MeetingHistory = { id: string } & Record<string, unknown>

export default function AccountPanel({
  accountId,
  onClose,
  userEmail,
}: {
  accountId: string | null
  onClose: () => void
  userEmail: string
}) {
  const [data, setData] = useState<{
    account: Account
    latestMeeting: MeetingHistory | null
    notes: Note[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null)
  const [panelTab, setPanelTab] = useState<'overview' | 'history'>('overview')

  // Reset tab when switching accounts
  useEffect(() => {
    setPanelTab('overview')
  }, [accountId])

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    setData(null)
    fetch(`/api/accounts/${accountId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [accountId, refreshKey])

  // Lock body scroll when panel is open
  useEffect(() => {
    if (accountId) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [accountId])

  const isOpen = !!accountId

  if (!isOpen) return null

  const account = data?.account
  const latestMeeting = data?.latestMeeting ?? null
  const notes = data?.notes ?? []
  const updatedAt = account?.updated_at as string | undefined

  const health = HEALTH_STYLES[account?.health_status] ?? HEALTH_STYLES.green

  function refetch() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={(el) => { if (el) setPanelEl(el) }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-xl flex flex-col"
        style={{ overflowY: 'auto' }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {loading ? 'Loading...' : (account?.name ?? '—')}
            </h2>
            {account && (
              <Link
                href={`/accounts/${accountId}`}
                className="text-xs text-gray-500 hover:text-gray-800 flex-shrink-0"
              >
                Open full page →
              </Link>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-4 flex-shrink-0"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center flex-1 py-20">
            <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}

        {!loading && account && (
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Overview / Meeting history tab bar */}
            <div className="flex items-center gap-0 border-b border-gray-200 -mb-1">
              {([
                { id: 'overview', label: 'Overview' },
                { id: 'history', label: 'Meetings' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPanelTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    panelTab === t.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {panelTab === 'history' ? (
              <MeetingHistory accountId={account.id} />
            ) : (<>
            {/* Sticky tabs inside panel */}
            <StickyTabs
              key={`${accountId}-${refreshKey}`}
              scrollEl={panelEl}
              xMargin="-mx-6 px-6"
            />

            {/* Contact & ownership */}
            <ContactSection
              key={`contact-${updatedAt}`}
              accountId={account.id}
              contact_email={account.contact_email ?? null}
              telegram={account.telegram ?? null}
              twitter_x={account.twitter_x ?? null}
              website={account.website ?? null}
              psm_id={account.psm_id ?? null}
              updatedAt={updatedAt ?? ''}
              onSaved={refetch}
            />

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
                onSaved={refetch}
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
                onSaved={refetch}
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

            {/* Section 3 — Last meeting */}
            <div id="last-meeting">
              <PanelSection title="Last meeting">
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
              </PanelSection>
            </div>

            {/* Section 4 — Action items */}
            <div id="action-items">
              <PanelSection title="Action items">
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
              </PanelSection>
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
                onSaved={refetch}
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
                onSaved={refetch}
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
                onSaved={refetch}
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
                onSaved={refetch}
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
                initialNotes={notes}
                userEmail={userEmail}
              />
            </div>

            {/* Process meeting */}
            <div id="process-meeting">
              <PanelSection title="Process meeting notes">
                <ProcessMeeting accountId={account.id} onProcessed={refetch} />
              </PanelSection>
            </div>
            </>)}
          </div>
        )}
      </div>
    </>
  )
}
