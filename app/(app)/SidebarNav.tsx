'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/team', label: 'Team' },
]

export default function SidebarNav({
  isAdmin,
  userEmail,
}: {
  isAdmin: boolean
  userEmail: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = isAdmin ? [...NAV_LINKS, { href: '/admin', label: 'Admin' }] : NAV_LINKS

  return (
    <div className="flex flex-col h-full">
      {/* Nav links */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
        {links.map((link) => {
          const active =
            link.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Ask AI */}
      <div className="px-3 pb-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Ask AI
        </button>
      </div>

      {/* User + sign out */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 truncate mb-2">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
