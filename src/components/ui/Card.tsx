import clsx from 'clsx'
import React from 'react'

export function Card({
  className, children, ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card p-5', className)} {...rest}>{children}</div>
  )
}

export function CardTitle({
  title, subtitle, right, className,
}: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start justify-between mb-4 gap-4', className)}>
      <div>
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        {subtitle && <div className="text-xs text-text-secondary mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function EmptyState({
  title, hint, icon,
}: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && <div className="w-10 h-10 rounded-xl bg-bg-hover border border-bg-border flex items-center justify-center text-text-secondary mb-3">{icon}</div>}
      <div className="text-sm font-medium text-text-primary">{title}</div>
      {hint && <div className="text-xs text-text-secondary mt-1 max-w-xs">{hint}</div>}
    </div>
  )
}
