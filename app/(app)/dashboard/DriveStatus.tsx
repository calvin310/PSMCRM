'use client'

import { useState } from 'react'

type SyncResult = {
  found: number
  added: number
  skipped: number
  skipped_files: string[]
}

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
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)

  async function handleSync() {
    setLoading(true)
    setError(null)
    setLastResult(null)
    setShowSkipped(false)
    try {
      const res = await fetch('/api/drive/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Sync failed')
      } else {
        setLastResult({
          found: data.found ?? 0,
          added: data.added ?? 0,
          skipped: data.skipped ?? 0,
          skipped_files: data.skipped_files ?? [],
        })
      }
    } catch {
      setError('Sync failed — try again')
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Main row */}
      <div className="px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900">Drive connected</span>
          <span className="text-xs text-gray-400">Last synced: {relativeTime(lastSynced)}</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            onClick={handleSync}
            disabled={loading}
            className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* Sync result log — appears after each manual sync */}
      {lastResult && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-gray-500">
              <span className="font-medium text-gray-700">{lastResult.found}</span> found
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              <span className="font-medium text-green-700">{lastResult.added}</span> added to review queue
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              <span className="font-medium text-gray-700">{lastResult.skipped}</span> skipped
            </span>
            {lastResult.skipped > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => setShowSkipped(v => !v)}
                  className="text-indigo-600 hover:underline"
                >
                  {showSkipped ? 'hide details' : 'why skipped?'}
                </button>
              </>
            )}
          </div>

          {showSkipped && lastResult.skipped_files.length > 0 && (
            <ul className="space-y-1 pt-1 border-t border-gray-200 mt-1">
              {lastResult.skipped_files.map((f, i) => (
                <li key={i} className="text-xs text-gray-500 flex gap-2">
                  <span className="text-gray-300 shrink-0">—</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
