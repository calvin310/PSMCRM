'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearMeetingButton({
  meetingHistoryId,
  accountId,
}: {
  meetingHistoryId: string
  accountId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/meetings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_history_id: meetingHistoryId, account_id: accountId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Failed to clear meeting data')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
      >
        Clear meeting data
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">Clear meeting data?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              This will remove the summary, action items, health status, and all other data
              extracted from this meeting. The account will be reset to blank. This cannot be
              undone.
            </p>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setOpen(false); setError(null) }}
                disabled={loading}
                className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="text-sm font-medium text-white bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Clearing...' : 'Yes, clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
