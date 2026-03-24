'use client'

import { useState } from 'react'

const CREATE_NEW = '__create_new__'

type PendingNote = {
  id: string
  file_id: string
  file_name: string | null
  content: string | null
  drive_created_at: string | null
}

type Account = {
  id: string
  name: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function NoteCard({
  note,
  accounts,
  onRemove,
  onAccountCreated,
}: {
  note: PendingNote
  accounts: Account[]
  onRemove: (id: string) => void
  onAccountCreated: (account: Account) => void
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const isCreatingNew = selectedAccountId === CREATE_NEW

  async function handleCreateAndProcess() {
    if (!newAccountName.trim()) return
    setCreatingAccount(true)
    setError(null)

    try {
      // Create the account first
      const createRes = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName.trim() }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        setError(createData.error ?? 'Failed to create account')
        setCreatingAccount(false)
        return
      }

      const newAccount: Account = { id: createData.id, name: newAccountName.trim() }
      onAccountCreated(newAccount)

      // Now process the meeting against the new account
      setProcessing(true)
      const res = await fetch('/api/process-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: newAccount.id,
          transcript: note.content,
          file_id: note.file_id,
          file_name: note.file_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Processing failed')
        setCreatingAccount(false)
        setProcessing(false)
        return
      }

      onRemove(note.id)
    } catch {
      setError('Something went wrong')
      setCreatingAccount(false)
      setProcessing(false)
    }
  }

  async function handleProcess() {
    if (!selectedAccountId || selectedAccountId === CREATE_NEW) return
    setProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/process-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          transcript: note.content,
          file_id: note.file_id,
          file_name: note.file_name,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Processing failed')
        setProcessing(false)
        return
      }

      onRemove(note.id)
    } catch {
      setError('Failed to connect to AI service')
      setProcessing(false)
    }
  }

  async function handleDismiss() {
    setDismissing(true)
    try {
      await fetch(`/api/pending-notes/${note.id}`, { method: 'DELETE' })
      onRemove(note.id)
    } catch {
      setDismissing(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <p className="font-medium text-gray-900 text-sm">{note.file_name ?? 'Untitled note'}</p>
        {note.drive_created_at && (
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(note.drive_created_at)}</p>
        )}
      </div>

      {note.content && (
        <p className="text-xs text-gray-500 leading-relaxed">
          {note.content.slice(0, 300)}
          {note.content.length > 300 ? '...' : ''}
        </p>
      )}

      {/* Account selector */}
      <select
        value={selectedAccountId}
        onChange={(e) => { setSelectedAccountId(e.target.value); setError(null) }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
      >
        <option value="">Select account...</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
        <option value={CREATE_NEW}>＋ Create new account</option>
      </select>

      {/* New account name input */}
      {isCreatingNew && (
        <input
          type="text"
          value={newAccountName}
          onChange={e => setNewAccountName(e.target.value)}
          placeholder="Account name..."
          autoFocus
          className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-600">Dismiss this note? It won&apos;t be processed.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {dismissing ? 'Dismissing...' : 'Yes, dismiss'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {isCreatingNew ? (
            <button
              onClick={handleCreateAndProcess}
              disabled={!newAccountName.trim() || creatingAccount || processing}
              className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creatingAccount || processing ? 'Creating...' : 'Create & process'}
            </button>
          ) : (
            <button
              onClick={handleProcess}
              disabled={!selectedAccountId || processing}
              className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {processing ? 'Processing...' : 'Process'}
            </button>
          )}
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

export default function ReviewQueue({
  notes,
  accounts: initialAccounts,
}: {
  notes: PendingNote[]
  accounts: Account[]
}) {
  const [localNotes, setLocalNotes] = useState(notes)
  const [accounts, setAccounts] = useState(initialAccounts)

  function removeNote(id: string) {
    setLocalNotes((prev) => prev.filter((n) => n.id !== id))
  }

  function addAccount(account: Account) {
    setAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
  }

  if (localNotes.length === 0) return null

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Meeting notes to review ({localNotes.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {localNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            accounts={accounts}
            onRemove={removeNote}
            onAccountCreated={addAccount}
          />
        ))}
      </div>
    </div>
  )
}
