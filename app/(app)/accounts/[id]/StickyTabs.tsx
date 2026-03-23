'use client'

import { useEffect, useState } from 'react'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'health', label: 'Health' },
  { id: 'last-meeting', label: 'Last meeting' },
  { id: 'action-items', label: 'Action items' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'what-working', label: "What's working" },
  { id: 'key-dates', label: 'Key dates' },
  { id: 'follow-up', label: 'Follow-up' },
  { id: 'notes', label: 'Notes' },
  { id: 'process-meeting', label: 'Process meeting' },
]

export default function StickyTabs({
  scrollEl,
  xMargin = '-mx-8 px-8',
}: {
  scrollEl?: HTMLElement | null
  xMargin?: string
}) {
  const [active, setActive] = useState('overview')

  useEffect(() => {
    const root = scrollEl ?? null
    const sections = TABS.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { root, rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [scrollEl])

  function handleClick(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    if (scrollEl) {
      const offset = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top - 48
      scrollEl.scrollBy({ top: offset, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className={`sticky top-0 z-10 bg-white border-b border-gray-100 ${xMargin} py-2`}>
      <div
        className="flex gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.id)}
            className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              active === tab.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
