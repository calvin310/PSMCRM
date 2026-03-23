'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

export default function NewAccountPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      relationship_stage: (form.elements.namedItem('relationship_stage') as HTMLSelectElement).value,
      comms_channel: (form.elements.namedItem('comms_channel') as HTMLSelectElement).value,
      what_building: (form.elements.namedItem('what_building') as HTMLTextAreaElement).value,
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: insertError } = await supabase.from('accounts').insert({ ...data, psm_id: user.id })
    if (insertError) { setError(insertError.message); setLoading(false); return }

    router.push('/accounts')
  }

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/accounts" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Accounts
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">New account</span>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-6">Add a partner account</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Account name <span className="text-red-500">*</span>
          </label>
          <input
            id="name" name="name" type="text" required placeholder="e.g. Kana Labs"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="relationship_stage" className="text-sm font-medium text-gray-700">Relationship stage</label>
          <select id="relationship_stage" name="relationship_stage"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="at-risk">At-risk</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="comms_channel" className="text-sm font-medium text-gray-700">Comms channel</label>
          <select id="comms_channel" name="comms_channel"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="telegram">Telegram</option>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
            <option value="none">None</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="what_building" className="text-sm font-medium text-gray-700">What are they building?</label>
          <textarea id="what_building" name="what_building" rows={3}
            placeholder="Brief description of their product or protocol..."
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/accounts" className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-lg">Cancel</Link>
          <button type="submit" disabled={loading}
            className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}
