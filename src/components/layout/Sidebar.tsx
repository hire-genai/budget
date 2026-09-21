'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Target, PieChart, Repeat,
  Tags, FileText, Settings, LogOut, Menu, X, PiggyBank,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/accounts',    label: 'Accounts',    icon: Wallet },
  { href: '/budgets',     label: 'Budgets',     icon: PiggyBank },
  { href: '/categories',  label: 'Categories',  icon: Tags },
  { href: '/recurring',   label: 'Recurring',   icon: Repeat },
  { href: '/analytics',   label: 'Analytics',   icon: PieChart },
  { href: '/goals',       label: 'Goals',       icon: Target },
  { href: '/reports',     label: 'Reports',     icon: FileText },
  { href: '/settings',    label: 'Settings',    icon: Settings },
]

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-bg-border bg-bg/95 backdrop-blur px-4 flex items-center justify-between">
        <button className="btn-ghost !p-2" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Wallet size={14} className="text-brand-400" />
          </div>
          <div className="text-sm font-semibold">Ledger</div>
        </div>
        <div className="w-9" />
      </div>

      {/* Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 z-50 h-full w-64 bg-bg-soft border-r border-bg-border flex flex-col transition-transform lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
              <Wallet size={16} className="text-brand-400" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Ledger</div>
              <div className="text-[10px] text-text-muted leading-tight">Personal Finance</div>
            </div>
          </div>
          <button className="lg:hidden btn-ghost !p-2" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 mx-2 my-0.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-brand-600/15 text-brand-200 border border-brand-500/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                )}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-bg-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-hover">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-200 text-xs font-semibold">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{userName}</div>
              <div className="text-[10px] text-text-muted truncate">{userEmail}</div>
            </div>
            <button onClick={logout} className="btn-ghost !p-1.5" title="Sign out"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  )
}
