'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardTitle, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatMoney } from '@/lib/formatters'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, CHART_COLORS } from '@/lib/constants'
import { Plus, Wallet, CreditCard, PiggyBank, Banknote, LineChart, MoreHorizontal, Pencil, Archive, Trash2, ArchiveRestore } from 'lucide-react'
import clsx from 'clsx'

function iconFor(type: string, size = 16) {
  switch (type) {
    case 'BANK': return <Banknote size={size} />
    case 'CREDIT_CARD': return <CreditCard size={size} />
    case 'CASH': return <Wallet size={size} />
    case 'INVESTMENT': return <LineChart size={size} />
    case 'WALLET': return <PiggyBank size={size} />
    default: return <MoreHorizontal size={size} />
  }
}

export default function AccountsPage() {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accounts').then((r) => r.json())
    setRows(res.accounts || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function toggleArchive(a: any) {
    await fetch(`/api/accounts/${a.accountId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: !a.archived }),
    })
    toast.push(a.archived ? 'Account restored' : 'Account archived', 'success')
    load()
  }

  async function doDelete() {
    if (!deleting) return
    setBusy(true)
    const res = await fetch(`/api/accounts/${deleting.accountId}`, { method: 'DELETE' })
    setBusy(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { toast.push(body.error || 'Unable to delete', 'error'); return }
    toast.push(body.note || 'Account deleted', 'success')
    setDeleting(null); load()
  }

  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)
  const totalBalance = active.reduce((a, b) => a + Number(b.balance), 0)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Accounts</div>
          <div className="text-sm text-text-secondary">Total balance: <span className="tabular-nums font-medium text-text-primary">{formatMoney(totalBalance)}</span></div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> Add account</button>
      </header>

      {loading
        ? <div className="text-sm text-text-secondary">Loading accounts…</div>
        : active.length === 0
        ? <Card><EmptyState title="No accounts yet" hint="Add a bank, wallet, cash, or credit card account to get started." icon={<Wallet size={16} />} /></Card>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((a) => (
              <div key={a.accountId} className="card p-5 card-hover">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: (a.color || '#6366F1') + '22', color: a.color || '#6366F1' }}>
                    {iconFor(a.type, 18)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-secondary uppercase tracking-wider text-[10px]">{ACCOUNT_TYPE_LABELS[a.type as keyof typeof ACCOUNT_TYPE_LABELS] || a.type}</div>
                    <div className="text-base font-semibold truncate">{a.name}</div>
                  </div>
                  <div className="flex">
                    <button className="btn-ghost !p-1.5" onClick={() => { setEditing(a); setOpen(true) }} title="Edit"><Pencil size={14} /></button>
                    <button className="btn-ghost !p-1.5" onClick={() => toggleArchive(a)} title="Archive"><Archive size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(a)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-text-secondary">Current balance</div>
                  <div className={clsx('text-2xl font-semibold tabular-nums mt-0.5',
                    Number(a.balance) < 0 ? 'text-accent-red' : 'text-text-primary')}>
                    {formatMoney(a.balance, a.currency)}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">Opened at {formatMoney(a.openingBalance, a.currency)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      {archived.length > 0 && (
        <div className="mt-4">
          <div className="section-title mb-3">Archived accounts</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {archived.map((a) => (
              <div key={a.accountId} className="card p-4 opacity-70">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{a.name}</div>
                  <button className="btn-ghost !p-1.5" onClick={() => toggleArchive(a)} title="Restore"><ArchiveRestore size={14} /></button>
                </div>
                <div className="text-xs text-text-secondary mt-1">Balance {formatMoney(a.balance, a.currency)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Edit account' : 'Add account'}>
        <AccountForm initial={editing} onSaved={() => { setOpen(false); setEditing(null); load() }} onCancel={() => { setOpen(false); setEditing(null) }} />
      </Modal>

      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={doDelete} busy={busy}
        title="Delete this account?"
        message="If the account has transactions it will be archived instead of deleted, so your history stays intact."
        confirmLabel="Delete" />
    </div>
  )
}

function AccountForm({ initial, onSaved, onCancel }: { initial: any | null; onSaved: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || 'BANK')
  const [openingBalance, setOpeningBalance] = useState(initial?.openingBalance || '0')
  const [color, setColor] = useState(initial?.color || CHART_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const url = isEdit ? `/api/accounts/${initial.accountId}` : '/api/accounts'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, openingBalance, color, currency: 'INR' }),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save account'); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Account name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Salary" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Opening balance</label>
          <input className="input tabular-nums" inputMode="decimal" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
        </div>
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
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add account'}</button>
      </div>
    </form>
  )
}
