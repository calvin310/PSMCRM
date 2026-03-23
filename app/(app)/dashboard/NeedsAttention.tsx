import Link from 'next/link'

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

type AttentionAccount = {
  id: string
  name: string
  health_status: string | null
  last_meeting_date: string | null
}

function getReason(account: AttentionAccount): string {
  if (account.health_status === 'red') return 'Red health'
  if (!account.last_meeting_date) return 'No contact recorded'
  const days = Math.floor(
    (Date.now() - new Date(account.last_meeting_date).getTime()) / 86400000
  )
  return `No contact for ${days} days`
}

export default function NeedsAttention({ accounts }: { accounts: AttentionAccount[] }) {
  if (accounts.length === 0) return null

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Needs attention</h2>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {accounts.map((account) => (
          <Link
            key={account.id}
            href={`/accounts/${account.id}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                HEALTH_DOT[account.health_status ?? 'green'] ?? 'bg-gray-300'
              }`}
            />
            <span className="text-sm font-medium text-gray-900 flex-1">{account.name}</span>
            <span className="text-xs text-gray-400">{getReason(account)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
