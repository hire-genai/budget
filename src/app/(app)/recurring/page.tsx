'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Plus, Repeat, Play, Pencil, Trash2, Pause } from 'lucide-react'
import { formatMoney, formatDate, relativeDate } from '@/lib/formatters'
import { FREQUENCIES, FREQUENCY_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import clsx from 'clsx'

export default function RecurringPage() {
  const toast = useToast()
  const [items, setItems] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, a, c] = await Promise.all([
      fetch('/api/recurring').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
    setItems(r.recurring || [])
    setAccounts(a.accounts || [])
    setCategories(c.categories || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(r: any) {
    await fetch(`/api/recurring/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !r.isActive }),
    })
    toast.push(r.isActive ? 'Paused' : 'Reactivated', 'success')
    load()
  }
  async function post(r: any) {
    const res = await fetch(`/api/recurring/${r.id}/post`, { method: 'POST' })
    if (!res.ok) { toast.push('Unable to post transaction', 'error'); return }
    toast.push('Transaction posted', 'success'); load()
  }
  async function del() {
    if (!deleting) return
    setBusy(true)
    const res = await fetch(`/api/recurring/${deleting.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.push('Unable to delete', 'error'); return }
    toast.push('Deleted', 'success')
    setDeleting(null); load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Recurring transactions</div>
          <div className="text-sm text-text-secondary">Subscriptions, rent, EMIs — track anything that repeats.</div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> New recurring</button>
      </header>

      {loading
        ? <div className="text-sm text-text-secondary">Loading…</div>
        : items.length === 0
        ? <Card><EmptyState title="No recurring transactions yet" hint="Add subscriptions, rent, EMIs to plan ahead." icon={<Repeat size={16} />} /></Card>
        : (
          <Card className="!p-0 overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Frequency</th>
                  <th>Next</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={clsx(!r.isActive && 'opacity-60')}>
                    <td>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {r.name}
                        {!r.isActive && <span className="chip border-bg-border bg-bg-hover text-text-muted">Paused</span>}
                        {r.type === 'INCOME' && <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-200">Income</span>}
                      </div>
                      {r.notes && <div className="text-xs text-text-muted mt-0.5 max-w-sm truncate">{r.notes}</div>}
                    </td>
                    <td className="text-text-secondary text-sm">{r.category?.name || '—'}</td>
                    <td className="text-text-secondary text-sm">{r.account?.name}</td>
                    <td className="text-text-secondary text-sm">
                      {r.intervalCount > 1 && `every ${r.intervalCount} `}{FREQUENCY_LABELS[r.frequency as keyof typeof FREQUENCY_LABELS]?.toLowerCase() || r.frequency}
                    </td>
                    <td className="text-text-secondary text-sm whitespace-nowrap">
                      <div>{formatDate(r.nextOccurrence)}</div>
                      <div className="text-[11px] text-text-muted">{relativeDate(r.nextOccurrence)}</div>
                    </td>
                    <td className="text-right tabular-nums font-medium">{formatMoney(r.amount)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost !p-1.5" title="Post next occurrence now" onClick={() => post(r)} disabled={!r.isActive}><Play size={14} /></button>
                      <button className="btn-ghost !p-1.5" title={r.isActive ? 'Pause' : 'Reactivate'} onClick={() => toggle(r)}>{r.isActive ? <Pause size={14} /> : <Play size={14} />}</button>
                      <button className="btn-ghost !p-1.5" onClick={() => { setEditing(r); setOpen(true) }}><Pencil size={14} /></button>
                      <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(r)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Edit recurring' : 'New recurring transaction'} size="lg">
        <RecurringForm accounts={accounts} categories={categories} initial={editing}
          onSaved={() => { setOpen(false); setEditing(null); load() }}
          onCancel={() => { setOpen(false); setEditing(null) }} />
      </Modal>

      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} busy={busy}
        title="Delete this recurring transaction?"
        message="This won't affect transactions that have already been posted."
        confirmLabel="Delete" />
    </div>
  )
}

function RecurringForm({ accounts, categories, initial, onSaved, onCancel }: {
  accounts: any[]; categories: any[]; initial: any | null
  onSaved: () => void; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>(initial?.type || 'EXPENSE')
  const [amount, setAmount] = useState(initial?.amount || '')
  const [accountId, setAccountId] = useState(initial?.accountId || accounts[0]?.accountId || accounts[0]?.id || '')
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId || '')
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.paymentMethod || 'UPI')
  const [frequency, setFrequency] = useState<string>(initial?.frequency || 'MONTHLY')
  const [intervalCount, setIntervalCount] = useState<number>(initial?.intervalCount || 1)
  const [startDate, setStartDate] = useState<string>(
    initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState<string>(initial?.endDate ? new Date(initial.endDate).toISOString().slice(0, 10) : '')
  const [autoPost, setAutoPost] = useState<boolean>(!!initial?.autoPost)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const relCats = categories.filter((c) => c.kind === (type === 'INCOME' ? 'INCOME' : 'EXPENSE'))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const isEdit = !!initial
    const body = { name, type, amount, accountId, categoryId: categoryId || null, paymentMethod, frequency, intervalCount, startDate, endDate: endDate || null, autoPost, notes: notes || null }
    const res = await fetch(isEdit ? `/api/recurring/${initial.id}` : '/api/recurring', {
      method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save'); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix, Rent" required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount</label>
          <input className="input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Account</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.accountId ?? a.id} value={a.accountId ?? a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorised</option>
            {relCats.map((c) => <option key={c.id} value={c.id}>{(c.parentId ? '— ' : '') + c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Payment method</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Frequency</label>
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Every</label>
          <input className="input tabular-nums" type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Start date</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">End date (optional)</label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <label className="flex items-end gap-2 text-sm text-text-secondary pb-2">
          <input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} />
          Auto-post on next occurrence
        </label>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create'}</button>
      </div>
    </form>
  )
}
