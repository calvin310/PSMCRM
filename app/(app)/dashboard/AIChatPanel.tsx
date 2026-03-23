'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Sparkles, ArrowUp, Plus, Clock, Trash2, ChevronLeft } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const SESSIONS_KEY = 'psm-ai-sessions'
const ACTIVE_KEY = 'psm-ai-active-session'

function loadSessions(): ChatSession[] {
  try {
    const saved = localStorage.getItem(SESSIONS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Suggested starter questions
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  'Which accounts need my attention right now?',
  'What are all my open action items?',
  'Summarize the health of my portfolio',
  "Which accounts haven't had a meeting in 2+ weeks?",
]

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-2 leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        if (line.startsWith('### ')) return <p key={i} className="font-semibold text-gray-900 mt-3">{line.slice(4)}</p>
        if (line.startsWith('## ')) return <p key={i} className="font-bold text-gray-900 mt-3">{line.slice(3)}</p>

        const bulletMatch = line.match(/^(\s*[-*•])\s+(.+)/)
        if (bulletMatch) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            <span className="text-gray-700">{renderInline(bulletMatch[2])}</span>
          </div>
        )

        const numMatch = line.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="shrink-0 text-gray-400 text-sm font-medium w-5 text-right">{numMatch[1]}.</span>
            <span className="text-gray-700">{renderInline(numMatch[2])}</span>
          </div>
        )

        return <p key={i} className="text-gray-700">{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'sessions'>('chat')
  const [sessions, setSessions] = useState<ChatSession[]>(() => typeof window !== 'undefined' ? loadSessions() : [])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACTIVE_KEY)
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const activeMessages = activeSession?.messages ?? []

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }, [sessions])

  // Persist active session id
  useEffect(() => {
    if (activeSessionId) localStorage.setItem(ACTIVE_KEY, activeSessionId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeSessionId])

  // Listen for open event from SidebarNav
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('open-ai-chat', handler)
    return () => window.removeEventListener('open-ai-chat', handler)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  useEffect(() => {
    if (isOpen && view === 'chat') setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen, view])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const updateSessionMessages = useCallback((sessionId: string, messages: Message[]) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages, updatedAt: new Date().toISOString() } : s
    ))
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Create a new session if none is active
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      const newSession: ChatSession = {
        id: sessionId,
        title: content.trim().slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setSessions(prev => [newSession, ...prev])
      setActiveSessionId(sessionId)
    }

    const userMessage: Message = { role: 'user', content: content.trim() }
    const outgoing = [...activeMessages, userMessage]

    updateSessionMessages(sessionId, [...outgoing, { role: 'assistant', content: '' }])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: outgoing }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          const msgs = [...s.messages]
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: msgs[msgs.length - 1].content + chunk,
          }
          return { ...s, messages: msgs, updatedAt: new Date().toISOString() }
        }))
      }
    } catch {
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s
        const msgs = [...s.messages]
        msgs[msgs.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return { ...s, messages: msgs }
      }))
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [activeSessionId, activeMessages, isLoading, updateSessionMessages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const startNewChat = () => {
    setActiveSessionId(null)
    setView('chat')
    setInput('')
  }

  const openSession = (id: string) => {
    setActiveSessionId(id)
    setView('chat')
  }

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) setActiveSessionId(null)
  }

  const sessionTitle = activeSession?.title ?? 'New conversation'

  return (
    <div
      className={`fixed right-0 top-0 h-screen w-[500px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
        {view === 'sessions' ? (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('chat')}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-gray-900 text-sm">Conversations</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <span className="font-semibold text-gray-900 text-sm truncate">{sessionTitle}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setView('sessions')}
                title="All conversations"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                {sessions.length > 0 && <span>{sessions.length}</span>}
              </button>
              <button
                onClick={startNewChat}
                title="New conversation"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sessions list view                                                   */}
      {/* ------------------------------------------------------------------ */}
      {view === 'sessions' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <button
              onClick={startNewChat}
              className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors mb-3"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>

            {sessions.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No conversations yet</p>
            ) : (
              <div className="space-y-1">
                {sessions
                  .slice()
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map(session => (
                    <button
                      key={session.id}
                      onClick={() => openSession(session.id)}
                      className={`group w-full text-left px-4 py-3 rounded-xl transition-colors flex items-start justify-between gap-2 ${
                        session.id === activeSessionId
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{session.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {session.messages.length} messages · {timeAgo(session.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteSession(session.id, e)}
                        className="shrink-0 p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Chat view                                                            */}
      {/* ------------------------------------------------------------------ */}
      {view === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeMessages.length === 0 ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 pb-8">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Ask about your portfolio</p>
                    <p className="text-sm text-gray-400 mt-1">Accounts, meetings, action items</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Try asking</p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-sm text-gray-600 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 px-4 py-3 rounded-xl border border-gray-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {activeMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] text-sm ${
                        msg.role === 'user'
                          ? 'bg-gray-100 text-gray-900 px-4 py-2.5 rounded-2xl rounded-tr-sm'
                          : 'text-gray-800 pt-0.5'
                      }`}
                    >
                      {msg.role === 'assistant' && !msg.content ? (
                        <div className="flex gap-1 items-center h-5">
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : msg.role === 'user' ? (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your accounts..."
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none px-4 pt-3.5 pb-12 disabled:opacity-50"
                style={{ lineHeight: '1.5rem', maxHeight: '120px' }}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className="text-xs text-gray-400 select-none">⏎ to send</span>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2">Shift+Enter for new line</p>
          </div>
        </>
      )}
    </div>
  )
}
