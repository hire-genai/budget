'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Filter, X, Download, Upload, Pencil, Trash2, ArrowLeftRight } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { useToast } from '@/components/ui/Toast'
import { formatMoney, formatDate } from '@/lib/formatters'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/lib/constants'
import clsx from 'clsx'
import Link from 'next/link'

export default function TransactionsPage() {
  const toast = useToast()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Filters
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [needType, setNeedType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('date_desc')
  const [offset, setOffset] = useState(0)

  const [showFilters, setShowFilters] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busyDel, setBusyDel] = useState(false)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (type) p.set('type', type)
    if (accountId) p.set('accountId', accountId)
    if (categoryId) p.set('categoryId', categoryId)
    if (paymentMethod) p.set('paymentMethod', paymentMethod)
    if (needType) p.set('needType', needType)
    if (from) p.set('from', new Date(from).toISOString())
    if (to) p.set('to', new Date(to).toISOString())
    p.set('sort', sort)
    p.set('offset', String(offset))
    p.set('limit', '50')
    return p.toString()
  }, [q, type, accountId, categoryId, paymentMethod, needType, from, to, sort, offset])

  const load = useCallback(async () => {
    setLoading(true)
    const [tx, ac, ca] = await Promise.all([
      fetch('/api/transactions?' + params).then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
    setItems(tx.transactions || [])
    setTotal(tx.total || 0)
    setHasMore(!!tx.hasMore)
    setAccounts(ac.accounts || [])
    setCategories(ca.categories || [])
    setLoading(false)
  }, [params])

  useEffect(() => { load() }, [load])

  function resetFilters() {
    setQ(''); setType(''); setAccountId(''); setCategoryId('')
    setPaymentMethod(''); setNeedType(''); setFrom(''); setTo(''); setOffset(0)
  }
  const activeFilterCount = [q, type, accountId, categoryId, paymentMethod, needType, from, to].filter(Boolean).length

  async function del() {
    if (!deleting) return
    setBusyDel(true)
    const res = await fetch(`/api/transactions/${deleting.id}`, { method: 'DELETE' })
    setBusyDel(false)
    if (!res.ok) { toast.push('Unable to delete transaction', 'error'); return }
    toast.push('Transaction deleted', 'success')
    setDeleting(null)
    load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Transactions</div>
          <div className="text-sm text-text-secondary">
            {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/api/export/csv" className="btn"><Download size={14} /> Export CSV</Link>
          <button className="btn" onClick={() => alert('Import: use /api/import/csv — the UI wraps this in a wizard.')}><Upload size={14} /> Import</button>
          <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add transaction</button>
        </div>
      </header>

      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input className="input pl-9" placeholder="Search description, notes, merchant…" value={q} onChange={(e) => { setOffset(0); setQ(e.target.value) }} />
          </div>
          <select className="input max-w-[160px]" value={type} onChange={(e) => { setOffset(0); setType(e.target.value) }}>
            <option value="">All types</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <select className="input max-w-[180px]" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount (high → low)</option>
            <option value="amount_asc">Amount (low → high)</option>
          </select>
          <button className={clsx('btn', showFilters && 'border-brand-500/40 text-brand-200')} onClick={() => setShowFilters((s) => !s)}>
            <Filter size={14} />
            Filters {activeFilterCount > 0 && <span className="chip !py-0 !px-1.5 bg-brand-500/25 border-brand-500/40 text-brand-100">{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button className="btn-ghost" onClick={resetFilters}><X size={14} /> Clear</button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-bg-border">
            <div>
              <label className="label">Account</label>
              <select className="input" value={accountId} onChange={(e) => { setOffset(0); setAccountId(e.target.value) }}>
                <option value="">All</option>
                {accounts.map((a) => <option key={a.accountId ?? a.id} value={a.accountId ?? a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={categoryId} onChange={(e) => { setOffset(0); setCategoryId(e.target.value) }}>
                <option value="">All</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{(c.parentId ? '— ' : '') + c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment</label>
              <select className="input" value={paymentMethod} onChange={(e) => { setOffset(0); setPaymentMethod(e.target.value) }}>
                <option value="">All</option>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{PAYMENT_METHOD_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Need / Want</label>
              <select className="input" value={needType} onChange={(e) => { setOffset(0); setNeedType(e.target.value) }}>
                <option value="">All</option>
                <option value="NEED">Need</option>
                <option value="WANT">Want</option>
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => { setOffset(0); setFrom(e.target.value) }} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => { setOffset(0); setTo(e.target.value) }} />
            </div>
          </div>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        {loading
          ? <div className="p-6 text-sm text-text-secondary">Loading transactions…</div>
          : items.length === 0
          ? <EmptyState title="No transactions match" hint="Try clearing your filters or adding your first transaction." />
          : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Payment</th>
                    <th className="text-right">Amount</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <TypeDot type={t.type} />
                          <div className="min-w-0">
                            <div className="text-sm truncate max-w-[280px]">
                              {t.description || t.merchant?.name || (t.type === 'TRANSFER' ? `Transfer to ${t.transferAccount?.name}` : t.category?.name || 'Transaction')}
                              {t.isRefund && <span className="chip ml-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-200">Refund</span>}
                            </div>
                            {t.merchant?.name && t.description && (
                              <div className="text-xs text-text-muted">{t.merchant.name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-text-secondary">
                        {t.type === 'TRANSFER'
                          ? <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={12} />Transfer</span>
                          : (t.category?.name || '—')}
                      </td>
                      <td className="text-sm text-text-secondary">{t.account?.name}</td>
                      <td className="text-sm text-text-secondary">{PAYMENT_METHOD_LABELS[t.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? t.paymentMethod}</td>
                      <td className={clsx('text-right tabular-nums font-medium',
                        t.type === 'INCOME' ? 'text-accent-green'
                        : t.type === 'EXPENSE' ? (t.isRefund ? 'text-accent-green' : 'text-accent-red')
                        : '')}>
                        {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? (t.isRefund ? '+' : '-') : ''}
                        {formatMoney(t.amount)}
                      </td>
                      <td className="text-sm text-text-secondary whitespace-nowrap">{formatDate(t.date, 'time')}</td>
                      <td className="text-right">
                        <button className="btn-ghost !p-1.5" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                        <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(t)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {items.length > 0 && (
          <div className="flex items-center justify-between text-xs text-text-secondary p-3 border-t border-bg-border">
            <div>Showing {items.length} of {total}</div>
            <div className="flex gap-2">
              <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
              <button className="btn" disabled={!hasMore} onClick={() => setOffset(offset + 50)}>Next</button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <TransactionForm accounts={accounts} categories={categories}
          onSaved={() => { setAddOpen(false); load() }} onCancel={() => setAddOpen(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && (
          <TransactionForm
            accounts={accounts} categories={categories}
            initial={{
              id: editing.id, type: editing.type, amount: editing.amount, date: editing.date,
              accountId: editing.accountId, transferAccountId: editing.transferAccountId,
              categoryId: editing.categoryId, merchantName: editing.merchant?.name,
              paymentMethod: editing.paymentMethod, needType: editing.needType,
              isFixed: editing.isFixed, isRefund: editing.isRefund,
              description: editing.description, notes: editing.notes,
            }}
            onSaved={() => { setEditing(null); load() }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={del}
        title="Delete this transaction?"
        message="This will remove the transaction and update your account balance. This cannot be undone."
        confirmLabel="Delete"
        busy={busyDel}
      />
    </div>
  )
}

function TypeDot({ type }: { type: string }) {
  const c = type === 'INCOME' ? 'bg-emerald-500' : type === 'EXPENSE' ? 'bg-red-500' : 'bg-brand-500'
  return <span className={clsx('w-2 h-2 rounded-full shrink-0', c)} />
}
