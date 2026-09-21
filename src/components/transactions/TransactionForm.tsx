'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, TRANSACTION_TYPES } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import { CalendarDays, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'

type Account = { id: string; name: string; type: string; color: string; currency: string }
type Category = { id: string; name: string; parentId: string | null; kind: 'EXPENSE' | 'INCOME' | string; color: string }

export type TransactionFormInitial = {
  id?: string
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER'
  amount: string
  date: string
  accountId: string
  transferAccountId?: string | null
  categoryId?: string | null
  merchantName?: string | null
  paymentMethod: string
  needType: 'NEED' | 'WANT'
  isFixed: boolean
  isRefund: boolean
  description?: string | null
  notes?: string | null
}

export function TransactionForm({
  accounts, categories, initial, onSaved, onCancel,
}: {
  accounts: Account[]
  categories: Category[]
  initial?: Partial<TransactionFormInitial>
  onSaved: () => void
  onCancel?: () => void
}) {
  const toast = useToast()

  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>(initial?.type ?? 'EXPENSE')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [date, setDate] = useState<string>(() =>
    initial?.date ? new Date(initial.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  )
  const [accountId, setAccountId] = useState<string>(initial?.accountId ?? accounts[0]?.id ?? '')
  const [transferAccountId, setTransferAccountId] = useState<string>(initial?.transferAccountId ?? '')
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '')
  const [merchantName, setMerchantName] = useState<string>(initial?.merchantName ?? '')
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.paymentMethod ?? 'UPI')
  const [needType, setNeedType] = useState<'NEED' | 'WANT'>(initial?.needType ?? 'NEED')
  const [isFixed, setIsFixed] = useState<boolean>(!!initial?.isFixed)
  const [isRefund, setIsRefund] = useState<boolean>(!!initial?.isRefund)
  const [description, setDescription] = useState<string>(initial?.description ?? '')
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const kindFilter = type === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const relevantCategories = useMemo(
    () => categories.filter((c) => c.kind === kindFilter),
    [categories, kindFilter],
  )

  // Group by parent for the selector
  const grouped = useMemo(() => {
    const roots = relevantCategories.filter((c) => !c.parentId)
    return roots.map((r) => ({
      root: r,
      children: relevantCategories.filter((c) => c.parentId === r.id),
    }))
  }, [relevantCategories])

  useEffect(() => {
    // Reset category if it no longer matches the type
    if (categoryId && !relevantCategories.some((c) => c.id === categoryId)) {
      setCategoryId('')
    }
  }, [categoryId, relevantCategories])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!accountId) { setErr('Select an account'); return }
    if (type === 'TRANSFER' && (!transferAccountId || transferAccountId === accountId)) {
      setErr('Select a different destination account for the transfer')
      return
    }
    const numeric = Number(amount)
    if (!isFinite(numeric) || numeric <= 0) { setErr('Enter a valid amount greater than zero'); return }
    setBusy(true)
    try {
      const body = {
        type, amount, date: new Date(date).toISOString(), accountId,
        transferAccountId: type === 'TRANSFER' ? transferAccountId : null,
        categoryId: type === 'TRANSFER' ? null : (categoryId || null),
        merchantName: type === 'TRANSFER' ? null : merchantName || null,
        paymentMethod, needType, isFixed, isRefund,
        description: description || null, notes: notes || null,
      }
      const url = initial?.id ? `/api/transactions/${initial.id}` : '/api/transactions'
      const method = initial?.id ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setErr(b.error || 'Unable to save transaction')
        return
      }
      toast.push(initial?.id ? 'Transaction updated' : 'Transaction added', 'success')
      onSaved()
    } catch {
      setErr('Network error — please retry.')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {TRANSACTION_TYPES.map((t) => {
          const Icon = t === 'EXPENSE' ? ArrowUpRight : t === 'INCOME' ? ArrowDownLeft : ArrowLeftRight
          const active = type === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={clsx(
                'flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                active
                  ? t === 'EXPENSE' ? 'bg-red-500/15 border-red-500/40 text-red-200'
                    : t === 'INCOME' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                  : 'border-bg-border text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              )}>
              <Icon size={14} />
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount</label>
          <input className="input tabular-nums text-lg" inputMode="decimal" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Date &amp; time</label>
          <div className="relative">
            <input className="input pr-9" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            <CalendarDays size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{type === 'TRANSFER' ? 'From account' : 'Account'}</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {type === 'TRANSFER' ? (
          <div>
            <label className="label">To account</label>
            <select className="input" value={transferAccountId} onChange={(e) => setTransferAccountId(e.target.value)}>
              <option value="">Select destination</option>
              {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {grouped.map((g) => (
                <optgroup key={g.root.id} label={g.root.name}>
                  <option value={g.root.id}>{g.root.name} (parent)</option>
                  {g.children.map((c) => <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      {type !== 'TRANSFER' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Merchant</label>
            <input className="input" placeholder="e.g. Swiggy, Amazon…" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
        </div>
      )}

      {type === 'EXPENSE' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Need / Want</label>
            <div className="grid grid-cols-2 gap-2">
              {(['NEED', 'WANT'] as const).map((n) => (
                <button key={n} type="button" onClick={() => setNeedType(n)}
                  className={clsx('py-2 rounded-lg border text-sm',
                    needType === n
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                      : 'border-bg-border text-text-secondary hover:bg-bg-hover')}>
                  {n === 'NEED' ? 'Need' : 'Want'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
              Fixed expense
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} />
              Refund
            </label>
          </div>
        </div>
      )}

      <div>
        <label className="label">Description</label>
        <input className="input" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[70px]" placeholder="Additional details (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : initial?.id ? 'Save changes' : 'Save transaction'}
        </button>
      </div>
    </form>
  )
}
