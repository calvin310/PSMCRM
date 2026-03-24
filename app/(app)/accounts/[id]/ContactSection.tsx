'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { id: string; email: string; display_name: string | null }

type Props = {
  accountId: string
  contact_email: string | null
  telegram: string | null
  twitter_x: string | null
  website: string | null
  psm_id: string | null
  updatedAt: string
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25l-3.25.5.5-3.25 7.537-6.987z" />
    </svg>
  )
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-800 break-all">{value}</span>
      )}
    </div>
  )
}

export default function ContactSection({
  accountId,
  contact_email,
  telegram,
  twitter_x,
  website,
  psm_id,
  updatedAt,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [form, setForm] = useState({
    contact_email: contact_email ?? '',
    telegram: telegram ?? '',
    twitter_x: twitter_x ?? '',
    website: website ?? '',
    psm_id: psm_id ?? '',
  })

  // Reset form when props change (after save)
  useEffect(() => {
    setForm({
      contact_email: contact_email ?? '',
      telegram: telegram ?? '',
      twitter_x: twitter_x ?? '',
      website: website ?? '',
      psm_id: psm_id ?? '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt])

  // Fetch profiles when entering edit mode
  useEffect(() => {
    if (!editing || profiles.length > 0) return
    fetch('/api/profiles')
      .then(r => r.json())
      .then(d => setProfiles(d.profiles ?? []))
      .catch(() => {})
  }, [editing, profiles.length])

  function psmLabel(id: string | null) {
    if (!id) return null
    const p = profiles.find(p => p.id === id)
    if (p) return p.display_name ?? p.email
    return id
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const body: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(form)) {
      body[k] = v.trim() || null
    }

    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
      setSaving(false)
      return
    }

    setEditing(false)
    setSaving(false)
    router.refresh()
  }

  const hasAnyData = contact_email || telegram || twitter_x || website || psm_id

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contact & ownership</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <PencilIcon />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          {/* Contact fields */}
          {[
            { key: 'contact_email', label: 'Email', placeholder: 'contact@example.com' },
            { key: 'telegram', label: 'Telegram', placeholder: '@handle' },
            { key: 'twitter_x', label: 'X / Twitter', placeholder: '@handle' },
            { key: 'website', label: 'Website', placeholder: 'https://...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          ))}

          {/* PSM assignment */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned PSM</label>
            {profiles.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Loading users...</p>
            ) : (
              <select
                value={form.psm_id}
                onChange={e => setForm(prev => ({ ...prev, psm_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                <option value="">— unassigned —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.display_name ?? p.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              disabled={saving}
              className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {!hasAnyData && (
            <p className="text-sm text-gray-400 italic">No contact info yet</p>
          )}
          <Row label="Email" value={contact_email} href={contact_email ? `mailto:${contact_email}` : undefined} />
          <Row label="Telegram" value={telegram} href={telegram ? `https://t.me/${telegram.replace('@', '')}` : undefined} />
          <Row label="X / Twitter" value={twitter_x} href={twitter_x ? `https://x.com/${twitter_x.replace('@', '')}` : undefined} />
          <Row label="Website" value={website} href={website ?? undefined} />
          {psm_id && (
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">PSM</span>
              <span className="text-sm text-gray-800">{psmLabel(psm_id) ?? psm_id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
