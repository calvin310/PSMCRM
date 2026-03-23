'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'array' | 'select' | 'health'
}

const SELECT_OPTIONS: Record<string, string[]> = {
  relationship_stage: ['onboarding', 'active', 'at-risk', 'churned'],
  comms_channel: ['telegram', 'slack', 'email', 'none'],
}

const HEALTH_COLORS = {
  green: { dot: 'bg-green-500', label: 'Green' },
  yellow: { dot: 'bg-yellow-400', label: 'Yellow' },
  red: { dot: 'bg-red-500', label: 'Red' },
}

function cloneValues(values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values)) {
    result[k] = Array.isArray(v) ? [...v] : v ?? ''
  }
  return result
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25l-3.25.5.5-3.25 7.537-6.987z" />
    </svg>
  )
}

export default function EditSection({
  title,
  fields,
  values,
  accountId,
  children,
  onSaved,
}: {
  title: string
  fields: FieldDef[]
  values: Record<string, unknown>
  accountId: string
  children: React.ReactNode
  onSaved?: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => cloneValues(values))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(key: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function setArrayItem(key: string, index: number, value: string) {
    const arr = [...((formValues[key] as string[]) ?? [])]
    arr[index] = value
    setField(key, arr)
  }

  function removeArrayItem(key: string, index: number) {
    const arr = [...((formValues[key] as string[]) ?? [])]
    arr.splice(index, 1)
    setField(key, arr)
  }

  function addArrayItem(key: string) {
    const arr = [...((formValues[key] as string[]) ?? []), '']
    setField(key, arr)
  }

  function handleCancel() {
    setFormValues(cloneValues(values))
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Filter out empty strings in arrays
    const body: Record<string, unknown> = {}
    for (const field of fields) {
      const val = formValues[field.key]
      if (field.type === 'array') {
        body[field.key] = ((val as string[]) ?? []).filter((s) => s.trim() !== '')
      } else {
        body[field.key] = val ?? null
      }
    }

    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    setEditing(false)
    setSaving(false)
    if (onSaved) {
      onSaved()
    } else {
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {!editing && (
          <button
            onClick={() => { setFormValues(cloneValues(values)); setEditing(true) }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <PencilIcon />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>

              {field.type === 'text' && (
                <input
                  type="text"
                  value={(formValues[field.key] as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  rows={3}
                  value={(formValues[field.key] as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
              )}

              {field.type === 'select' && (
                <select
                  value={(formValues[field.key] as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">— none —</option>
                  {(SELECT_OPTIONS[field.key] ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'health' && (
                <div className="flex gap-4">
                  {Object.entries(HEALTH_COLORS).map(([color, { dot, label }]) => (
                    <label key={color} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`${accountId}-health`}
                        value={color}
                        checked={(formValues[field.key] as string) === color}
                        onChange={() => setField(field.key, color)}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-full ${dot} ${(formValues[field.key] as string) === color ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-50'}`} />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'array' && (
                <div className="flex flex-col gap-1.5">
                  {((formValues[field.key] as string[]) ?? []).map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => setArrayItem(field.key, i, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem(field.key, i)}
                        className="text-gray-400 hover:text-red-500 px-2 transition-colors"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem(field.key)}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-3 py-1.5 text-left transition-colors"
                  >
                    + Add item
                  </button>
                </div>
              )}
            </div>
          ))}

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
              onClick={handleCancel}
              disabled={saving}
              className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
