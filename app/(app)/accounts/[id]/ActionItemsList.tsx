'use client'

import { useState } from 'react'

type StatusEntry = { index: number; done: boolean; comment?: string; dueDate?: string | null }
type PendingDelete = { countdown: number; timeoutId: ReturnType<typeof setTimeout>; intervalId: ReturnType<typeof setInterval> }

function getDueDateInfo(dueDate: string | null | undefined): { label: string; cls: string } | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `Overdue ${Math.abs(diff)}d`, cls: 'text-red-600 bg-red-50 border-red-100' }
  if (diff === 0) return { label: 'Due today', cls: 'text-amber-600 bg-amber-50 border-amber-100' }
  return { label: `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, cls: 'text-gray-500 bg-gray-50 border-gray-100' }
}

export default function ActionItemsList({
  items: initialItems,
  statusItems: initialStatus,
  type,
  accountId,
}: {
  items: string[]
  statusItems: StatusEntry[]
  type: 'psm' | 'protocol'
  accountId: string
}) {
  const [items, setItems] = useState<string[]>(initialItems)
  const [status, setStatus] = useState<StatusEntry[]>(initialStatus)
  const [commentOpen, setCommentOpen] = useState<Record<number, boolean>>({})
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({})
  const [dueDateOpen, setDueDateOpen] = useState<Record<number, boolean>>({})
  const [dueDateDraft, setDueDateDraft] = useState<Record<number, string>>({})
  const [addingItem, setAddingItem] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [pendingDeletes, setPendingDeletes] = useState<Record<number, PendingDelete>>({})

  function getStatus(index: number): StatusEntry {
    return status.find((s) => s.index === index) ?? { index, done: false }
  }

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/accounts/${accountId}/action-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...body }),
    })
  }

  async function handleToggle(index: number) {
    const current = getStatus(index)
    const newDone = !current.done
    setStatus((prev) => {
      const existing = prev.find((s) => s.index === index)
      if (existing) return prev.map((s) => s.index === index ? { ...s, done: newDone } : s)
      return [...prev, { index, done: newDone }]
    })
    await patch({ index, done: newDone })
  }

  async function handleSaveComment(index: number) {
    const comment = commentDraft[index] ?? ''
    setStatus((prev) => {
      const existing = prev.find((s) => s.index === index)
      if (existing) return prev.map((s) => s.index === index ? { ...s, comment } : s)
      return [...prev, { index, done: false, comment }]
    })
    setCommentOpen((o) => ({ ...o, [index]: false }))
    await patch({ index, comment })
  }

  async function handleSaveDueDate(index: number) {
    const dueDate = dueDateDraft[index] || null
    setStatus((prev) => {
      const existing = prev.find((s) => s.index === index)
      if (existing) return prev.map((s) => s.index === index ? { ...s, dueDate } : s)
      return [...prev, { index, done: false, dueDate }]
    })
    setDueDateOpen((o) => ({ ...o, [index]: false }))
    await patch({ action: 'set-due-date', index, dueDate })
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return
    const text = newItemText.trim()
    const newIndex = items.length
    setItems((prev) => [...prev, text])
    setStatus((prev) => [...prev, { index: newIndex, done: false }])
    setNewItemText('')
    setAddingItem(false)
    await patch({ action: 'add', text })
  }

  function handleDelete(index: number) {
    if (pendingDeletes[index]) return

    let countdown = 5
    const intervalId = setInterval(() => {
      countdown -= 1
      setPendingDeletes((prev) => {
        if (!prev[index]) return prev
        return { ...prev, [index]: { ...prev[index], countdown } }
      })
    }, 1000)

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
      setPendingDeletes((prev) => {
        const next = { ...prev }
        delete next[index]
        return next
      })
      setItems((prev) => prev.filter((_, i) => i !== index))
      setStatus((prev) =>
        prev
          .filter((s) => s.index !== index)
          .map((s) => s.index > index ? { ...s, index: s.index - 1 } : s)
      )
      patch({ action: 'delete', index })
    }, 5000)

    setPendingDeletes((prev) => ({ ...prev, [index]: { countdown, timeoutId, intervalId } }))
  }

  function handleUndo(index: number) {
    const pending = pendingDeletes[index]
    if (!pending) return
    clearTimeout(pending.timeoutId)
    clearInterval(pending.intervalId)
    setPendingDeletes((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  if (items.length === 0 && !addingItem) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-400 italic">Nothing recorded</p>
        <button
          onClick={() => setAddingItem(true)}
          className="text-xs text-gray-500 hover:text-gray-800 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-3 py-1.5 text-left transition-colors w-fit"
        >
          + Add item
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((text, index) => {
        const s = getStatus(index)
        const hasComment = !!(s.comment && s.comment.trim())
        const commentInputOpen = !!commentOpen[index]
        const dueDateInputOpen = !!dueDateOpen[index]
        const pending = pendingDeletes[index]
        const dueDateInfo = getDueDateInfo(s.dueDate)

        if (pending) {
          return (
            <div key={index} className="flex items-center gap-2 py-1 opacity-50">
              <span className="text-sm text-gray-400 line-through flex-1">{text}</span>
              <button
                onClick={() => handleUndo(index)}
                className="text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-300 px-2 py-0.5 rounded transition-colors flex-shrink-0"
              >
                Undo ({pending.countdown}s)
              </button>
            </div>
          )
        }

        return (
          <div key={index} className="flex flex-col gap-0.5">
            <div className="flex items-start gap-2 group py-0.5">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => handleToggle(index)}
                className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-500 flex-shrink-0 cursor-pointer"
              />
              <span className={`text-sm flex-1 leading-snug ${s.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {text}
              </span>
              {s.done && (
                <span className="text-xs font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">
                  Done
                </span>
              )}
              {dueDateInfo && !s.done && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${dueDateInfo.cls}`}>
                  {dueDateInfo.label}
                </span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => {
                    setCommentDraft((d) => ({ ...d, [index]: s.comment ?? '' }))
                    setCommentOpen((o) => ({ ...o, [index]: !o[index] }))
                  }}
                  className="text-xs text-gray-300 hover:text-gray-600"
                  title={hasComment ? 'Edit comment' : 'Add comment'}
                >
                  {hasComment ? '✎' : '+'}
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="text-xs text-gray-300 hover:text-red-500"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>

            {hasComment && !commentInputOpen && (
              <p className="text-xs text-gray-400 italic ml-6">{s.comment}</p>
            )}

            {commentInputOpen && (
              <div className="ml-6 flex gap-2 items-center mt-0.5">
                <input
                  type="text"
                  value={commentDraft[index] ?? ''}
                  onChange={(e) => setCommentDraft((d) => ({ ...d, [index]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveComment(index)
                    if (e.key === 'Escape') setCommentOpen((o) => ({ ...o, [index]: false }))
                  }}
                  placeholder="Add a comment..."
                  autoFocus
                  className="flex-1 border border-gray-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <button onClick={() => handleSaveComment(index)} className="text-xs font-medium text-gray-700 hover:text-gray-900">Save</button>
                <button onClick={() => setCommentOpen((o) => ({ ...o, [index]: false }))} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}

            {dueDateInputOpen && (
              <div className="ml-6 flex gap-2 items-center mt-0.5">
                <input
                  type="date"
                  value={dueDateDraft[index] ?? s.dueDate ?? ''}
                  onChange={(e) => setDueDateDraft((d) => ({ ...d, [index]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDueDate(index)
                    if (e.key === 'Escape') setDueDateOpen((o) => ({ ...o, [index]: false }))
                  }}
                  autoFocus
                  className="border border-gray-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <button onClick={() => handleSaveDueDate(index)} className="text-xs font-medium text-gray-700 hover:text-gray-900">Save</button>
                <button onClick={() => setDueDateOpen((o) => ({ ...o, [index]: false }))} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}

            <div className="ml-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setDueDateDraft((d) => ({ ...d, [index]: s.dueDate ?? '' }))
                  setDueDateOpen((o) => ({ ...o, [index]: !o[index] }))
                }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                {s.dueDate ? 'Edit due date' : 'Add due date'}
              </button>
            </div>
          </div>
        )
      })}

      {addingItem ? (
        <div className="flex gap-2 items-center mt-1.5">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="New action item..."
            autoFocus
            className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button onClick={handleAddItem} className="text-xs font-medium text-gray-700 hover:text-gray-900">Save</button>
          <button onClick={() => { setAddingItem(false); setNewItemText('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAddingItem(true)}
          className="text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1.5 text-left transition-all mt-1"
        >
          + Add item
        </button>
      )}
    </div>
  )
}
