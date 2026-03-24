'use client'

import { useState } from 'react'

function relativeTime(dateStr: string | null): string {
  if (!dateStr || dateStr.startsWith('2000-')) return 'Never synced'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function DriveStatus({
  connected,
  lastSynced,
}: {
  connected: boolean
  lastSynced: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function handleSync() {
    setLoading(true)
    setMessage(null)
    setIsError(false)
    try {
      const res = await fetch('/api/drive/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setIsError(true)
        setMessage(`Sync failed: ${data.error ?? 'unknown error'}`)
      } else {
        setMessage(`Done — ${data.new_notes} new note${data.new_notes === 1 ? '' : 's'} ready to review`)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setIsError(true)
      setMessage('Sync failed — try again')
    } finally {
      setLoading(false)
    }
  }

  if (!connected) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-blue-800">
          Connect Google Drive to automatically sync Gemini meeting notes
        </p>
        <a
          href="/api/drive/connect"
          className="flex-shrink-0 bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Drive
        </a>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900">Drive connected</span>
        <span className="text-xs text-gray-400">Last synced: {relativeTime(lastSynced)}</span>
      </div>
      <div className="flex items-center gap-3">
        {message && (
          <span className={`text-xs ${isError ? 'text-red-600' : 'text-gray-500'}`}>{message}</span>
        )}
        <button
          onClick={handleSync}
          disabled={loading}
          className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
    </div>
  )
}
