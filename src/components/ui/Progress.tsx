import clsx from 'clsx'

export function Progress({
  value, max = 100, tone = 'primary', className,
}: {
  value: number; max?: number
  tone?: 'primary' | 'success' | 'warn' | 'danger' | string
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const overflow = value > max
  const barClass =
    tone === 'success' ? 'bg-emerald-500' :
    tone === 'warn' ? 'bg-amber-500' :
    tone === 'danger' ? 'bg-red-500' :
    'bg-brand-500'
  return (
    <div className={clsx('h-1.5 w-full bg-bg-hover rounded-full overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all', overflow ? 'bg-red-500' : barClass)}
        style={{ width: `${pct}%`, backgroundColor: !overflow && tone.startsWith('#') ? tone : undefined }}
      />
    </div>
  )
}
