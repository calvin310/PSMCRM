'use client'

import { useState } from 'react'

export type ActionItem = {
  text: string
  type: 'PSM' | 'Protocol'
  accountId: string
  accountName: string
  lastMeetingDate: string | null
  isOverdue: boolean
  isThisWeek: boolean
  index: number
  done?: boolean
  comment?: string
  dueDate?: string | null
}

type ItemState = {
  done: boolean
  comment: string
  commentOpen: boolean
  commentDraft: string
  editing: boolean
  editDraft: string
  text: string
}

type PendingDelete = {
  countdown: number
  timeoutId: ReturnType<typeof setTimeout>
  intervalId: ReturnType<typeof setInterval>
}

function itemKey(item: ActionItem) {
  return `${item.accountId}-${item.type}-${item.index}`
}

function getDueDateInfo(dueDate: string | null | undefined): { label: string; cls: string } | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `Overdue ${Math.abs(diff)}d`, cls: 'text-red-600 bg-red-50 border border-red-100' }
  if (diff === 0) return { label: 'Due today', cls: 'text-amber-600 bg-amber-50 border border-amber-100' }
  return { label: `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, cls: 'text-gray-500 bg-gray-50 border border-gray-100' }
}

export default function ActionItems({
  items,
  onOpenPanel,
}: {
  items: ActionItem[]
  onOpenPanel?: (accountId: string) => void
}) {
  const [showPsm, setShowPsm] = useState(true)
  const [showProtocol, setShowProtocol] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done' | 'overdue'>('all')

  const [states, setStates] = useState<Record<string, ItemState>>(() => {
    const s: Record<string, ItemState> = {}
    for (const item of items) {
      s[itemKey(item)] = {
        done: item.done ?? false,
        comment: item.comment ?? '',
        commentOpen: false,
        commentDraft: item.comment ?? '',
        editing: false,
        editDraft: item.text,
        text: item.text,
      }
    }
    return s
  })

  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set())
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, PendingDelete>>({})

  function getState(item: ActionItem): ItemState {
    return states[itemKey(item)] ?? {
      done: item.done ?? false,
      comment: item.comment ?? '',
      commentOpen: false,
      commentDraft: item.comment ?? '',
      editing: false,
      editDraft: item.text,
      text: item.text,
    }
  }

  function patchState(item: ActionItem, patch: Partial<ItemState>) {
    setStates((s) => ({ ...s, [itemKey(item)]: { ...getState(item), ...patch } }))
  }

  async function handleToggle(item: ActionItem) {
    const newDone = !getState(item).done
    patchState(item, { done: newDone })
    await fetch(`/api/accounts/${item.accountId}/action-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type.toLowerCase(), index: item.index, done: newDone }),
    })
  }

  async function handleSaveComment(item: ActionItem) {
    const comment = getState(item).commentDraft
    patchState(item, { comment, commentOpen: false })
    await fetch(`/api/accounts/${item.accountId}/action-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type.toLowerCase(), index: item.index, comment }),
    })
  }

  async function handleSaveEdit(item: ActionItem) {
    const text = getState(item).editDraft.trim()
    if (!text) return
    patchState(item, { text, editing: false })
    await fetch(`/api/accounts/${item.accountId}/action-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type.toLowerCase(), index: item.index, action: 'edit', text }),
    })
  }

  function handleDelete(item: ActionItem) {
    const key = itemKey(item)
    if (pendingDeletes[key]) return

    let countdown = 5
    const intervalId = setInterval(() => {
      countdown -= 1
      setPendingDeletes((prev) => {
        if (!prev[key]) return prev
        return { ...prev, [key]: { ...prev[key], countdown } }
      })
    }, 1000)

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
      setPendingDeletes((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setDeletedKeys((prev) => new Set([...prev, key]))
      fetch(`/api/accounts/${item.accountId}/action-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type.toLowerCase(), index: item.index, action: 'delete' }),
      })
    }, 5000)

    setPendingDeletes((prev) => ({ ...prev, [key]: { countdown, timeoutId, intervalId } }))
  }

  function handleUndo(item: ActionItem) {
    const key = itemKey(item)
    const pending = pendingDeletes[key]
    if (!pending) return
    clearTimeout(pending.timeoutId)
    clearInterval(pending.intervalId)
    setPendingDeletes((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const visibleItems = items.filter((item) => !deletedKeys.has(itemKey(item)))

  const filtered = visibleItems.filter((item) => {
    const key = itemKey(item)
    if (pendingDeletes[key]) return true // always show pending deletes
    const s = getState(item)
    if (!showPsm && item.type === 'PSM') return false
    if (!showProtocol && item.type === 'Protocol') return false
    if (statusFilter === 'pending') return !s.done
    if (statusFilter === 'done') return s.done
    if (statusFilter === 'overdue') return !s.done && !!item.dueDate && new Date(item.dueDate) < today
    return true
  })

  if (items.length === 0) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900">Action items</h2>
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {visibleItems.length}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'done', 'overdue'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                statusFilter === v
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPsm}
              onChange={(e) => setShowPsm(e.target.checked)}
              className="rounded border-gray-300"
            />
            PSM
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showProtocol}
              onChange={(e) => setShowProtocol(e.target.checked)}
              className="rounded border-gray-300"
            />
            Protocol
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No items match the current filters.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtered.map((item) => {
            const key = itemKey(item)
            const pending = pendingDeletes[key]

            if (pending) {
              return (
                <div key={key} className="px-5 py-3 flex items-center gap-3 opacity-50">
                  <span className="text-sm text-gray-400 line-through flex-1">{getState(item).text}</span>
                  <button
                    onClick={() => handleUndo(item)}
                    className="text-xs font-medium text-gray-700 border border-gray-300 px-2 py-0.5 rounded flex-shrink-0"
                  >
                    Undo ({pending.countdown}s)
                  </button>
                </div>
              )
            }

            const s = getState(item)
            const hasComment = !!s.comment.trim()
            const dueDateInfo = getDueDateInfo(item.dueDate)

            return (
              <div
                key={key}
                onClick={() => onOpenPanel?.(item.accountId)}
                className="px-5 py-3 flex flex-col gap-1 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {/* Main row */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => handleToggle(item)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-500 flex-shrink-0 cursor-pointer"
                  />

                  {s.editing ? (
                    <div
                      className="flex-1 flex gap-2 items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={s.editDraft}
                        onChange={(e) => patchState(item, { editDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(item)
                          if (e.key === 'Escape') patchState(item, { editing: false, editDraft: s.text })
                        }}
                        autoFocus
                        className="flex-1 border border-gray-300 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <button onClick={() => handleSaveEdit(item)} className="text-xs font-medium text-gray-700 hover:text-gray-900">Save</button>
                      <button onClick={() => patchState(item, { editing: false, editDraft: s.text })} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <span className={`text-sm flex-1 leading-snug ${s.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {s.text}
                    </span>
                  )}

                  {s.done && !s.editing && (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">
                      Done
                    </span>
                  )}

                  {dueDateInfo && !s.done && !s.editing && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${dueDateInfo.cls}`}>
                      {dueDateInfo.label}
                    </span>
                  )}

                  {/* Badges + delete */}
                  <div
                    className="flex items-center gap-1.5 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.type === 'PSM' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.type}
                    </span>
                    <button
                      onClick={() => onOpenPanel?.(item.accountId)}
                      className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors"
                    >
                      {item.accountName}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors px-1"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Comment display */}
                {hasComment && !s.commentOpen && (
                  <p className="text-xs text-gray-400 italic ml-6">{s.comment}</p>
                )}

                {/* Comment input */}
                {s.commentOpen && (
                  <div
                    className="ml-6 flex gap-2 items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={s.commentDraft}
                      onChange={(e) => patchState(item, { commentDraft: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveComment(item)
                        if (e.key === 'Escape') patchState(item, { commentOpen: false })
                      }}
                      placeholder="Add a comment..."
                      autoFocus
                      className="flex-1 border border-gray-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button onClick={() => handleSaveComment(item)} className="text-xs font-medium text-gray-700 hover:text-gray-900">Save</button>
                    <button onClick={() => patchState(item, { commentOpen: false })} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                )}

                {/* Action buttons */}
                {!s.editing && (
                  <div
                    className="ml-6 flex items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => patchState(item, { editing: true, editDraft: s.text })}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => patchState(item, { commentOpen: !s.commentOpen, commentDraft: s.comment })}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {hasComment ? 'Edit comment' : 'Add comment'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
