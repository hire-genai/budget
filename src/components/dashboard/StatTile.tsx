import clsx from 'clsx'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatMoney } from '@/lib/formatters'

export function StatTile({
  label, value, sublabel, icon, delta, currency = 'INR', tone = 'default',
}: {
  label: string
  value: string | number
  sublabel?: string
  icon?: React.ReactNode
  delta?: { pct: number; label?: string }
  currency?: string
  tone?: 'default' | 'positive' | 'negative' | 'accent'
}) {
  const valueStr = typeof value === 'number' ? formatMoney(value, currency) : value
  return (
    <div className="card p-4 md:p-5 flex flex-col gap-3 min-h-[112px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-secondary uppercase tracking-wider font-medium">{label}</div>
        {icon && (
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            tone === 'positive' && 'bg-emerald-500/15 text-emerald-400',
            tone === 'negative' && 'bg-red-500/15 text-red-400',
            tone === 'accent' && 'bg-brand-500/15 text-brand-400',
            tone === 'default' && 'bg-bg-hover text-text-secondary',
          )}>{icon}</div>
        )}
      </div>
      <div className="text-2xl md:text-[26px] font-semibold tracking-tight tabular-nums">{valueStr}</div>
      <div className="flex items-center justify-between text-xs">
        {sublabel && <div className="text-text-secondary">{sublabel}</div>}
        {delta && (
          <div className={clsx('flex items-center gap-0.5 font-medium tabular-nums',
            delta.pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {delta.pct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(delta.pct).toFixed(1)}%{delta.label ? ` ${delta.label}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
