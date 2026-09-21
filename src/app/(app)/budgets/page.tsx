'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, PiggyBank, Trash2, Pencil } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Progress } from '@/components/ui/Progress'
import { formatMoney, formatDate } from '@/lib/formatters'
import { useToast } from '@/components/ui/Toast'
import { BUDGET_PERIODS } from '@/lib/constants'
import clsx from 'clsx'

export default function BudgetsPage() {
  const toast = useToast()
  const [budgets, setBudgets] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [b, c] = await Promise.all([
      fetch('/api/budgets').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
    setBudgets(b.budgets || [])
    setStatuses(b.statuses || [])
    setCategories(c.categories || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function del() {
    if (!deleting) return
    setBusy(true)
    const res = await fetch(`/api/budgets/${deleting.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.push('Unable to delete', 'error'); return }
    toast.push('Budget removed', 'success')
    setDeleting(null); load()
  }

  const totalBudget = statuses.reduce((a, b) => a + Number(b.amount), 0)
  const totalSpent = statuses.reduce((a, b) => a + Number(b.spent), 0)
  const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Budgets</div>
          <div className="text-sm text-text-secondary">Set spending limits per category and track them each period.</div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> New budget</button>
      </header>

      {statuses.length > 0 && (
        <Card className="!p-5">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
            <div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">Total budgeted this period</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">{formatMoney(totalBudget)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-text-secondary uppercase tracking-wider">Spent so far</div>
              <div className={clsx('text-2xl font-semibold tabular-nums mt-0.5', totalSpent > totalBudget ? 'text-accent-red' : '')}>
                {formatMoney(totalSpent)}
              </div>
            </div>
          </div>
          <Progress value={totalSpent} max={totalBudget || 1} tone={totalSpent > totalBudget ? 'danger' : pct >= 80 ? 'warn' : 'primary'} />
        </Card>
      )}

      {loading
        ? <div className="text-sm text-text-secondary">Loading budgets…</div>
        : statuses.length === 0
        ? <Card><EmptyState title="No budgets yet" hint="Create a monthly budget for a category to start tracking." icon={<PiggyBank size={16} />} /></Card>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {statuses.map((s) => {
              const budget = budgets.find((b) => b.id === s.budgetId)
              return (
                <div key={s.budgetId} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.categoryColor }} />
                      <div>
                        <div className="text-sm font-medium">{s.categoryName}</div>
                        <div className="text-[11px] text-text-muted">{s.period} · {formatDate(s.periodStart)} → {formatDate(s.periodEnd)}</div>
                      </div>
                    </div>
                    <div className="flex">
                      {budget && <button className="btn-ghost !p-1.5" onClick={() => { setEditing(budget); setOpen(true) }}><Pencil size={14} /></button>}
                      {budget && <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(budget)}><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <div className={clsx('tabular-nums font-semibold text-lg', s.status === 'OVER_BUDGET' ? 'text-accent-red' : '')}>
                      {formatMoney(s.spent)}
                    </div>
                    <div className="text-text-secondary tabular-nums">of {formatMoney(s.amount)}</div>
                  </div>
                  <Progress value={Number(s.spent)} max={Number(s.amount)}
                    tone={s.status === 'OVER_BUDGET' ? 'danger' : s.status === 'NEAR_LIMIT' ? 'warn' : 'primary'} className="mt-2" />
                  <div className="flex items-center justify-between text-[11px] mt-2">
                    <span className={clsx(
                      s.status === 'OVER_BUDGET' && 'text-accent-red',
                      s.status === 'NEAR_LIMIT' && 'text-amber-300',
                      s.status === 'HEALTHY' && 'text-emerald-300',
                    )}>{s.usagePct.toFixed(1)}% used · {s.status.replace('_', ' ').toLowerCase()}</span>
                    <span className="text-text-muted tabular-nums">
                      {Number(s.remaining) >= 0 ? formatMoney(s.remaining) + ' left' : formatMoney(Math.abs(Number(s.remaining))) + ' over'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Edit budget' : 'New budget'}>
        <BudgetForm categories={categories.filter((c: any) => c.kind === 'EXPENSE')}
          initial={editing}
          onSaved={() => { setOpen(false); setEditing(null); load() }}
          onCancel={() => { setOpen(false); setEditing(null) }} />
      </Modal>

      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} busy={busy}
        title="Delete this budget?" message="This removes the budget limit but does not touch your transactions."
        confirmLabel="Delete" />
    </div>
  )
}

function BudgetForm({ categories, initial, onSaved, onCancel }:
  { categories: any[]; initial: any | null; onSaved: () => void; onCancel: () => void }) {
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId || categories[0]?.id || '')
  const [amount, setAmount] = useState<string>(initial?.amount || '')
  const [period, setPeriod] = useState<string>(initial?.period || 'MONTHLY')
  const [rollover, setRollover] = useState<boolean>(!!initial?.rollover)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const url = initial ? `/api/budgets/${initial.id}` : '/api/budgets'
    const method = initial ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, amount, period, rollover }),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save'); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Category</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!!initial}>
          {categories.map((c) => <option key={c.id} value={c.id}>{(c.parentId ? '— ' : '') + c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount</label>
          <input className="input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Period</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {BUDGET_PERIODS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
        Rollover unused amount to next period
      </label>
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create budget'}</button>
      </div>
    </form>
  )
}
