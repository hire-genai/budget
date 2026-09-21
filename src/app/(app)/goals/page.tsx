'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Progress } from '@/components/ui/Progress'
import { useToast } from '@/components/ui/Toast'
import { Plus, Target, Pencil, Trash2, PlusCircle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/formatters'
import { CHART_COLORS } from '@/lib/constants'
import clsx from 'clsx'
import { differenceInMonths, differenceInDays } from 'date-fns'

export default function GoalsPage() {
  const toast = useToast()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [contributingTo, setContributingTo] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/goals').then((r) => r.json())
    setGoals(res.goals || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function del() {
    if (!deleting) return
    setBusy(true)
    const res = await fetch(`/api/goals/${deleting.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.push('Unable to delete', 'error'); return }
    toast.push('Goal deleted', 'success')
    setDeleting(null); load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Financial goals</div>
          <div className="text-sm text-text-secondary">Save for what matters — a new laptop, a trip, an emergency fund.</div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> New goal</button>
      </header>

      {loading
        ? <div className="text-sm text-text-secondary">Loading…</div>
        : goals.length === 0
        ? <Card><EmptyState title="No goals yet" hint="Set your first goal and track your savings toward it." icon={<Target size={16} />} /></Card>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const cur = Number(g.currentAmount)
              const tgt = Number(g.targetAmount)
              const pct = tgt > 0 ? Math.min(100, (cur / tgt) * 100) : 0
              const remaining = Math.max(0, tgt - cur)
              const months = g.targetDate ? Math.max(1, differenceInMonths(new Date(g.targetDate), new Date())) : null
              const perMonth = months && remaining > 0 ? remaining / months : null
              const daysLeft = g.targetDate ? differenceInDays(new Date(g.targetDate), new Date()) : null
              return (
                <div key={g.id} className="card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: g.color + '22', color: g.color }}>
                        <Target size={18} />
                      </div>
                      <div>
                        <div className="text-sm text-text-secondary uppercase tracking-wider text-[10px]">Goal</div>
                        <div className="text-lg font-semibold">{g.name}</div>
                      </div>
                    </div>
                    <div className="flex">
                      <button className="btn-ghost !p-1.5" onClick={() => setContributingTo(g)}><PlusCircle size={14} /></button>
                      <button className="btn-ghost !p-1.5" onClick={() => { setEditing(g); setOpen(true) }}><Pencil size={14} /></button>
                      <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(g)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="text-2xl font-semibold tabular-nums">{formatMoney(cur)}</div>
                    <div className="text-sm text-text-secondary tabular-nums">of {formatMoney(tgt)}</div>
                  </div>
                  <Progress value={cur} max={tgt} tone={pct >= 100 ? 'success' : 'primary'} className="mt-2" />
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div><div className="text-text-muted">Remaining</div><div className="tabular-nums text-text-primary">{formatMoney(remaining)}</div></div>
                    <div><div className="text-text-muted">Progress</div><div className="tabular-nums text-text-primary">{pct.toFixed(1)}%</div></div>
                    <div><div className="text-text-muted">Target</div><div className="text-text-primary">{g.targetDate ? formatDate(g.targetDate) : '—'}</div></div>
                  </div>
                  {perMonth !== null && (
                    <div className="mt-3 text-xs bg-brand-500/10 border border-brand-500/25 rounded-lg px-3 py-2 text-brand-100">
                      Save {formatMoney(perMonth)} per month for {months} month{months! > 1 ? 's' : ''} to reach this goal on time
                      {daysLeft !== null && daysLeft > 0 && ` (${daysLeft} days left)`}.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Edit goal' : 'New financial goal'}>
        <GoalForm initial={editing} onSaved={() => { setOpen(false); setEditing(null); load() }} onCancel={() => { setOpen(false); setEditing(null) }} />
      </Modal>

      <Modal open={!!contributingTo} onClose={() => setContributingTo(null)} title={`Add contribution to ${contributingTo?.name || ''}`}>
        {contributingTo && (
          <ContributeForm goal={contributingTo} onSaved={() => { setContributingTo(null); load() }} onCancel={() => setContributingTo(null)} />
        )}
      </Modal>

      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} busy={busy}
        title="Delete this goal?" message="This removes the goal and all recorded contributions." confirmLabel="Delete" />
    </div>
  )
}

function GoalForm({ initial, onSaved, onCancel }: { initial: any | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '')
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount || '')
  const [currentAmount, setCurrentAmount] = useState(initial?.currentAmount || '0')
  const [targetDate, setTargetDate] = useState<string>(initial?.targetDate ? new Date(initial.targetDate).toISOString().slice(0, 10) : '')
  const [color, setColor] = useState(initial?.color || '#10B981')
  const [note, setNote] = useState(initial?.note || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const isEdit = !!initial
    const res = await fetch(isEdit ? `/api/goals/${initial.id}` : '/api/goals', {
      method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, targetAmount, currentAmount, targetDate: targetDate || null, color, note: note || null }),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save'); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Goal name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Buy a laptop, Emergency fund" required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Target amount</label>
          <input className="input tabular-nums" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Current amount</label>
          <input className="input tabular-nums" inputMode="decimal" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Target date</label>
          <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Colour</label>
          <div className="flex flex-wrap gap-1.5">
            {CHART_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={clsx('w-7 h-7 rounded-md border-2', color === c ? 'border-white/60' : 'border-transparent')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="label">Note</label>
        <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create goal'}</button>
      </div>
    </form>
  )
}

function ContributeForm({ goal, onSaved, onCancel }: { goal: any; onSaved: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const res = await fetch(`/api/goals/${goal.id}/contribute`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note: note || null }),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save'); return }
    onSaved()
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Contribution amount</label>
        <input className="input tabular-nums text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
      </div>
      <div>
        <label className="label">Note (optional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add contribution'}</button>
      </div>
    </form>
  )
}
