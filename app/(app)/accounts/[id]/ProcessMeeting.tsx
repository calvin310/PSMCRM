'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProcessMeeting({
  accountId,
  onProcessed,
}: {
  accountId: string
  onProcessed?: () => void
}) {
  const router = useRouter()
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleProcess() {
    if (!transcript.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/process-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, transcript }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTranscript('')
      if (onProcessed) {
        onProcessed()
      } else {
        router.refresh()
      }
    } catch {
      setError('Failed to connect to AI service')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={8}
        placeholder="Paste meeting transcript or notes..."
        className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none w-full"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Meeting processed successfully. This page has been updated with the extracted data.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleProcess}
          disabled={loading || !transcript.trim()}
          className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Processing...
            </>
          ) : (
            'Process with AI'
          )}
        </button>
        {loading && (
          <span className="text-xs text-gray-400">This may take 10–20 seconds</span>
        )}
      </div>
    </div>
  )
}
