'use client'

import { useState } from 'react'

type Note = { id: string; content: string; user_email: string; created_at: string }

function formatNoteDate(dateStr: string): string {
  const d = new Date(dateStr)
  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timePart = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${datePart}, ${timePart}`
}

export default function NotesSection({
  accountId,
  initialNotes,
  userEmail,
}: {
  accountId: string
  initialNotes: Note[]
  userEmail: string
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [showAdd, setShowAdd] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!noteText.trim()) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/accounts/${accountId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); setSaving(false); return }

      setNotes((prev) => [data, ...prev])
      setNoteText('')
      setShowAdd(false)
    } catch {
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Notes</h3>

      {notes.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 italic mb-4">No notes yet — add the first one</p>
      )}

      {notes.length > 0 && (
        <div className="flex flex-col divide-y divide-gray-100 mb-4">
          {notes.map((note) => (
            <div key={note.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs text-gray-400">{formatNoteDate(note.created_at)}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{note.user_email}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
              className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save note'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNoteText(''); setError(null) }}
              className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm text-gray-500 hover:text-gray-800 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-4 py-2 transition-all"
        >
          + Add note
        </button>
      )}
    </div>
  )
}
