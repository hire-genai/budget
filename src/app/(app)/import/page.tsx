'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Upload, FileText, Sparkles, Loader2, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, Trash2, Folder, Home, TrendingUp,
  PiggyBank, Smile, ArrowDownToLine, Wallet, ChevronRight,
  ChevronDown, Flag, Check, type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatMoney } from '@/lib/formatters'
import {
  GROUPS, GroupKey, categorySlugToGroup, evalGroupStatus,
  monthKeyFromISODate, monthLabel, groupByKey,
} from '@/lib/groups'

type Account = {
  accountId: string
  name: string
  type?: string
  color?: string
  currency?: string
}

type Category = {
  id: string
  name: string
  slug: string
  kind: 'EXPENSE' | 'INCOME'
  color: string
  parentId: string | null
  icon?: string
}

type Row = {
  id: string
  date: string               // YYYY-MM-DD
  description: string
  amount: number
  type: 'EXPENSE' | 'INCOME'
  categoryId: string | null
  confidence: number
  flagged?: boolean
}

type Step = 'upload' | 'review' | 'done'

const GROUP_ICONS: Record<GroupKey, LucideIcon> = {
  INCOME: ArrowDownToLine,
  FIXED: Home,
  INVEST: TrendingUp,
  SAVINGS: PiggyBank,
  GUILT_FREE: Smile,
}

export default function ImportPage() {
  const toast = useToast()
  const [step, setStep] = useState<Step>('upload')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)

  const [rows, setRows] = useState<Row[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [committing, setCommitting] = useState(false)
  const [activeMonth, setActiveMonth] = useState<string>('')
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(new Set(['FIXED', 'INCOME']))
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  const [pickerForRow, setPickerForRow] = useState<string | null>(null)
  const [insertedCount, setInsertedCount] = useState(0)

  // Duplicate-month warning
  const [pendingData, setPendingData] = useState<any | null>(null)
  const [duplicateMonths, setDuplicateMonths] = useState<Array<{ month: string; count: number }>>([])

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((j) => {
        const list: Account[] = j.accounts || []
        setAccounts(list)
        if (list.length && !accountId) setAccountId(list[0].accountId)
      })
      .catch(() => toast.push('Could not load accounts', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Derive available months from the rows
  const monthsAvailable = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => set.add(monthKeyFromISODate(r.date)))
    return Array.from(set).sort().reverse()
  }, [rows])

  // Rows filtered to the active month ("" = all)
  const monthRows = useMemo(() => {
    if (!activeMonth) return rows
    return rows.filter((r) => monthKeyFromISODate(r.date) === activeMonth)
  }, [rows, activeMonth])

  // Group each row into one of the 5 fixed groups.
  const rowGroup = useCallback(
    (r: Row): GroupKey => {
      const cat = r.categoryId ? catById.get(r.categoryId) : null
      return categorySlugToGroup(cat?.slug ?? null, r.type)
    },
    [catById],
  )

  const totals = useMemo(() => {
    const t: Record<GroupKey, number> = { INCOME: 0, FIXED: 0, INVEST: 0, SAVINGS: 0, GUILT_FREE: 0 }
    monthRows.forEach((r) => { t[rowGroup(r)] += r.amount })
    const net = t.INCOME - (t.FIXED + t.INVEST + t.SAVINGS + t.GUILT_FREE)
    return { ...t, NET: net }
  }, [monthRows, rowGroup])

  const needsReviewCount = useMemo(
    () => rows.filter((r) => !r.categoryId || r.confidence < 0.7).length,
    [rows],
  )

  function acceptParsedData(data: any) {
    const newRows: Row[] = (data.transactions as Row[]).map((r) => ({ ...r, flagged: false }))
    setRows(newRows)
    setCategories(data.categories || [])
    const months = new Set<string>()
    newRows.forEach((r) => months.add(monthKeyFromISODate(r.date)))
    const sortedMonths = Array.from(months).sort().reverse()
    setActiveMonth(sortedMonths[0] || '')
    setStep('review')
    toast.push(`Parsed ${data.total} transactions`, 'success')
  }

  const parse = useCallback(async () => {
    if (!file || !accountId) {
      toast.push('Please select an account and upload a file', 'error')
      return
    }
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('accountId', accountId)
      const res = await fetch('/api/import/statement/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.push(data?.error || 'Parsing failed', 'error')
        return
      }
      if (!data.transactions?.length) {
        toast.push('No transactions were found', 'error')
        return
      }
      const dups: Array<{ month: string; count: number }> = data.duplicates || []
      if (dups.length > 0) {
        // Hold the parsed data back; show the warning first.
        setPendingData(data)
        setDuplicateMonths(dups)
        return
      }
      acceptParsedData(data)
    } catch {
      toast.push('Something went wrong talking to the AI', 'error')
    } finally {
      setParsing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, accountId, toast])

  function confirmProceedWithDuplicates() {
    if (!pendingData) return
    acceptParsedData(pendingData)
    setPendingData(null)
    setDuplicateMonths([])
  }
  function cancelDuplicateImport() {
    setPendingData(null)
    setDuplicateMonths([])
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function assignCategory(id: string, categoryId: string | null) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (!categoryId) return { ...r, categoryId: null, confidence: 0 }
        const cat = catById.get(categoryId)
        if (!cat) return r
        // auto-flip EXPENSE/INCOME to match the picked category's kind
        return { ...r, categoryId, confidence: 1, type: cat.kind }
      }),
    )
    setPickerForRow(null)
  }
  function toggleFlag(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, flagged: !r.flagged } : r)))
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }
  function toggleGroup(key: GroupKey) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function toggleSub(key: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const commit = useCallback(async () => {
    if (!rows.length) return
    setCommitting(true)
    try {
      const payload = {
        accountId,
        transactions: rows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          categoryId: r.categoryId,
        })),
      }
      const res = await fetch('/api/import/statement/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.push(data?.error || 'Import failed', 'error')
        return
      }
      setInsertedCount(data.inserted)
      setStep('done')
      toast.push(`Imported ${data.inserted} transactions`, 'success')
    } finally {
      setCommitting(false)
    }
  }, [rows, accountId, toast])

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-400" />
            Import statement with AI
          </div>
          <div className="text-sm text-text-secondary mt-0.5">
            Upload a bank statement. Gemini extracts the transactions, buckets them
            into the five Conscious Spending groups, and shows your month at a glance.
          </div>
        </div>
        <Stepper step={step} />
      </header>

      {step === 'upload' && (
        <UploadStep
          accounts={accounts}
          accountId={accountId}
          setAccountId={setAccountId}
          file={file}
          setFile={setFile}
          parsing={parsing}
          onNext={parse}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          rows={rows}
          monthRows={monthRows}
          categories={categories}
          catById={catById}
          totals={totals}
          monthsAvailable={monthsAvailable}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          needsReviewCount={needsReviewCount}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
          openSubs={openSubs}
          toggleSub={toggleSub}
          rowGroup={rowGroup}
          assignCategory={assignCategory}
          updateRow={updateRow}
          removeRow={removeRow}
          toggleFlag={toggleFlag}
          pickerForRow={pickerForRow}
          setPickerForRow={setPickerForRow}
          onBack={() => setStep('upload')}
          onCommit={commit}
          committing={committing}
          accountName={accounts.find((a) => a.accountId === accountId)?.name || ''}
        />
      )}

      {/* Duplicate-month warning modal */}
      <Modal
        open={duplicateMonths.length > 0}
        onClose={cancelDuplicateImport}
        title="Statement already imported?"
        subtitle={`You have transactions in this account for the same month(s) as this upload.`}
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-100">
              This account <span className="font-semibold">
                {accounts.find((a) => a.accountId === accountId)?.name}
              </span> already has transactions for the following month{duplicateMonths.length === 1 ? '' : 's'}:
            </div>
          </div>

          <ul className="space-y-2">
            {duplicateMonths.map((d) => (
              <li
                key={d.month}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-hover border border-bg-border"
              >
                <span className="text-sm font-semibold">{monthLabel(d.month)}</span>
                <span className="text-xs text-text-muted">
                  {d.count} existing transaction{d.count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>

          <div className="text-xs text-text-secondary">
            If you continue, you may create <strong>duplicates</strong>. If you've already imported this statement, click Cancel.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn" onClick={cancelDuplicateImport}>Cancel upload</button>
            <button className="btn-primary" onClick={confirmProceedWithDuplicates}>
              Proceed anyway
            </button>
          </div>
        </div>
      </Modal>

      {step === 'done' && (
        <Card>
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-emerald-300" />
            </div>
            <div className="text-lg font-semibold">Imported {insertedCount} transactions</div>
            <div className="text-sm text-text-secondary mt-1">
              They are now visible on your transactions page.
            </div>
            <div className="flex gap-2 mt-5">
              <button
                className="btn"
                onClick={() => {
                  setStep('upload')
                  setFile(null)
                  setRows([])
                  setCategories([])
                  setInsertedCount(0)
                }}
              >
                Import another
              </button>
              <a className="btn-primary" href="/transactions">
                Go to transactions <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   STEPPER
   ============================================================ */
function Stepper({ step }: { step: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Done' },
  ]
  const idx = steps.findIndex((s) => s.key === step)
  return (
    <div className="hidden md:flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={clsx(
              'w-6 h-6 rounded-full border flex items-center justify-center font-semibold',
              i < idx && 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
              i === idx && 'bg-brand-500/20 border-brand-500/40 text-brand-100',
              i > idx && 'bg-bg-hover border-bg-border text-text-muted',
            )}
          >
            {i + 1}
          </div>
          <div className={clsx(i === idx ? 'text-text-primary font-medium' : 'text-text-muted')}>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="w-6 h-px bg-bg-border mx-1" />}
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   UPLOAD STEP
   ============================================================ */
function UploadStep({
  accounts, accountId, setAccountId, file, setFile, parsing, onNext,
}: {
  accounts: Account[]
  accountId: string
  setAccountId: (v: string) => void
  file: File | null
  setFile: (f: File | null) => void
  parsing: boolean
  onNext: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }
  function drop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  return (
    <Card className="space-y-4">
      <div>
        <label className="label">Target account</label>
        <select
          className="input"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.length === 0 && <option value="">No accounts — create one first</option>}
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Statement file</label>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={drop}
          className={clsx(
            'relative block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-bg-border hover:border-brand-500/40',
          )}
        >
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
            onChange={pick}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <Upload size={20} className="text-brand-400" />
            </div>
            {file ? (
              <>
                <div className="text-sm font-medium flex items-center gap-2">
                  <FileText size={14} /> {file.name}
                </div>
                <div className="text-xs text-text-muted">
                  {(file.size / 1024).toFixed(0)} KB — click to replace
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium">Drop a PDF, CSV or TXT here</div>
                <div className="text-xs text-text-muted">or click to browse. Max 15 MB.</div>
              </>
            )}
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        {parsing && (
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Large PDFs can take 1–3 minutes. Please keep this tab open.
          </div>
        )}
        <div className="ml-auto">
          <button className="btn-primary" disabled={!file || parsing} onClick={onNext}>
            {parsing ? (
              <><Loader2 size={14} className="animate-spin" /> Parsing with Gemini…</>
            ) : (
              <>Parse with AI <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ============================================================
   REVIEW STEP — HTML-style 5 group layout + KPI + month pills
   ============================================================ */
function ReviewStep(props: {
  rows: Row[]
  monthRows: Row[]
  categories: Category[]
  catById: Map<string, Category>
  totals: Record<GroupKey, number> & { NET: number }
  monthsAvailable: string[]
  activeMonth: string
  setActiveMonth: (m: string) => void
  needsReviewCount: number
  openGroups: Set<GroupKey>
  toggleGroup: (k: GroupKey) => void
  openSubs: Set<string>
  toggleSub: (k: string) => void
  rowGroup: (r: Row) => GroupKey
  assignCategory: (id: string, categoryId: string | null) => void
  updateRow: (id: string, patch: Partial<Row>) => void
  removeRow: (id: string) => void
  toggleFlag: (id: string) => void
  pickerForRow: string | null
  setPickerForRow: (id: string | null) => void
  onBack: () => void
  onCommit: () => void
  committing: boolean
  accountName: string
}) {
  const {
    rows, monthRows, categories, catById, totals, monthsAvailable, activeMonth,
    setActiveMonth, needsReviewCount, openGroups, toggleGroup, openSubs, toggleSub,
    rowGroup, assignCategory, updateRow, removeRow, toggleFlag,
    pickerForRow, setPickerForRow, onBack, onCommit, committing, accountName,
  } = props

  // Build sub-group layout: Group → Map<categoryId|'uncat', Row[]>
  const grouped = useMemo(() => {
    const out: Record<GroupKey, Map<string, Row[]>> = {
      INCOME: new Map(), FIXED: new Map(), INVEST: new Map(),
      SAVINGS: new Map(), GUILT_FREE: new Map(),
    }
    monthRows.forEach((r) => {
      const g = rowGroup(r)
      const key = r.categoryId || '__uncat__'
      const bucket = out[g].get(key) || []
      bucket.push(r)
      out[g].set(key, bucket)
    })
    return out
  }, [monthRows, rowGroup])

  return (
    <div className="space-y-4">
      {/* Month pills */}
      {monthsAvailable.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted mr-1">Month:</span>
          <MonthPill active={activeMonth === ''} onClick={() => setActiveMonth('')}>
            All ({rows.length})
          </MonthPill>
          {monthsAvailable.map((m) => (
            <MonthPill
              key={m}
              active={activeMonth === m}
              onClick={() => setActiveMonth(m)}
            >
              {monthLabel(m)}
            </MonthPill>
          ))}
        </div>
      )}

      {/* KPI Dashboard — 6 tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-2xl bg-gradient-to-br from-brand-500/5 to-brand-500/10 border border-brand-500/15">
        <KpiTile
          groupKey="INCOME"
          label="Income"
          value={totals.INCOME}
          income={totals.INCOME}
          amount={totals.INCOME}
        />
        <KpiTile
          groupKey="FIXED"
          label="Fixed"
          value={totals.FIXED}
          income={totals.INCOME}
          amount={totals.FIXED}
        />
        <KpiTile
          groupKey="INVEST"
          label="Invest"
          value={totals.INVEST}
          income={totals.INCOME}
          amount={totals.INVEST}
        />
        <KpiTile
          groupKey="SAVINGS"
          label="Savings"
          value={totals.SAVINGS}
          income={totals.INCOME}
          amount={totals.SAVINGS}
        />
        <KpiTile
          groupKey="GUILT_FREE"
          label="Guilt-Free"
          value={totals.GUILT_FREE}
          income={totals.INCOME}
          amount={totals.GUILT_FREE}
        />
        <NetTile value={totals.NET} />
      </div>

      {/* Account strip */}
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <Wallet size={12} />
          <span>Account:</span>
          <span className="font-medium text-text-primary">{accountName}</span>
          <span className="text-text-muted">•</span>
          <span>{monthRows.length} shown of {rows.length}</span>
        </div>
        {needsReviewCount > 0 && (
          <div className="flex items-center gap-1 text-amber-300">
            <AlertCircle size={12} />
            {needsReviewCount} need{needsReviewCount === 1 ? 's' : ''} review
          </div>
        )}
      </div>

      {/* 2-column group cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          {(['INCOME', 'INVEST'] as GroupKey[]).map((key) => (
            <GroupCard
              key={key}
              groupKey={key}
              rows={monthRows.filter((r) => rowGroup(r) === key)}
              subMap={grouped[key]}
              catById={catById}
              categories={categories}
              totals={totals}
              open={openGroups.has(key)}
              onToggle={() => toggleGroup(key)}
              openSubs={openSubs}
              toggleSub={toggleSub}
              assignCategory={assignCategory}
              updateRow={updateRow}
              removeRow={removeRow}
              toggleFlag={toggleFlag}
              pickerForRow={pickerForRow}
              setPickerForRow={setPickerForRow}
            />
          ))}
        </div>
        <div className="space-y-3">
          {(['FIXED', 'SAVINGS', 'GUILT_FREE'] as GroupKey[]).map((key) => (
            <GroupCard
              key={key}
              groupKey={key}
              rows={monthRows.filter((r) => rowGroup(r) === key)}
              subMap={grouped[key]}
              catById={catById}
              categories={categories}
              totals={totals}
              open={openGroups.has(key)}
              onToggle={() => toggleGroup(key)}
              openSubs={openSubs}
              toggleSub={toggleSub}
              assignCategory={assignCategory}
              updateRow={updateRow}
              removeRow={removeRow}
              toggleFlag={toggleFlag}
              pickerForRow={pickerForRow}
              setPickerForRow={setPickerForRow}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <button className="btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="btn-primary" disabled={!rows.length || committing} onClick={onCommit}>
          {committing ? (
            <><Loader2 size={14} className="animate-spin" /> Importing…</>
          ) : (
            <>Import {rows.length} transaction{rows.length === 1 ? '' : 's'} <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   KPI TILE
   ============================================================ */
function KpiTile({
  groupKey, label, value, income, amount,
}: {
  groupKey: GroupKey
  label: string
  value: number
  income: number
  amount: number
}) {
  const g = groupByKey(groupKey)
  const Icon = GROUP_ICONS[groupKey]
  const st = evalGroupStatus(groupKey, amount, income)
  const glow =
    st.status === 'good' ? 'border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
    : st.status === 'warn' ? 'border-amber-500/50 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]'
    : st.status === 'bad' ? 'border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
    : 'border-bg-border'
  const badge =
    st.status === 'good' ? 'bg-emerald-500/20 text-emerald-200'
    : st.status === 'warn' ? 'bg-amber-500/20 text-amber-200'
    : st.status === 'bad' ? 'bg-red-500/20 text-red-200'
    : 'bg-bg-hover text-text-muted'

  return (
    <div className={clsx('relative bg-bg-card border rounded-xl p-3 transition-all', glow)}>
      {st.pct !== null && groupKey !== 'INCOME' && (
        <div className={clsx('absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1', badge)}>
          {st.status === 'good' && <Check size={8} />}
          {st.status === 'bad' && <AlertCircle size={8} />}
          {st.label} · {st.targetLabel}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
        <Icon size={11} style={{ color: g.color }} />
        {label}
      </div>
      <div className="text-base font-bold mt-1 tabular-nums" style={{ color: groupKey === 'INCOME' ? '#10B981' : undefined }}>
        {formatMoney(value)}
      </div>
      <div className="text-[9px] text-text-muted mt-0.5">{g.target.label === '—' ? 'Net monthly' : `Target ${g.target.label}`}</div>
    </div>
  )
}

function NetTile({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <div className="relative bg-bg-card border border-bg-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
        <Wallet size={11} className="text-text-primary" />
        Net Flow
      </div>
      <div className={clsx('text-base font-bold mt-1 tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
        {positive ? '+' : '-'}{formatMoney(Math.abs(value))}
      </div>
      <div className="text-[9px] text-text-muted mt-0.5">Income − spend</div>
    </div>
  )
}

/* ============================================================
   GROUP CARD
   ============================================================ */
function GroupCard({
  groupKey, rows, subMap, catById, categories, totals, open, onToggle,
  openSubs, toggleSub, assignCategory, updateRow, removeRow, toggleFlag,
  pickerForRow, setPickerForRow,
}: {
  groupKey: GroupKey
  rows: Row[]
  subMap: Map<string, Row[]>
  catById: Map<string, Category>
  categories: Category[]
  totals: Record<GroupKey, number> & { NET: number }
  open: boolean
  onToggle: () => void
  openSubs: Set<string>
  toggleSub: (k: string) => void
  assignCategory: (id: string, categoryId: string | null) => void
  updateRow: (id: string, patch: Partial<Row>) => void
  removeRow: (id: string) => void
  toggleFlag: (id: string) => void
  pickerForRow: string | null
  setPickerForRow: (id: string | null) => void
}) {
  const g = groupByKey(groupKey)
  const Icon = GROUP_ICONS[groupKey]
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const st = evalGroupStatus(groupKey, total, totals.INCOME)
  const glow =
    st.status === 'good' ? 'border-emerald-500/40'
    : st.status === 'warn' ? 'border-amber-500/40'
    : st.status === 'bad' ? 'border-red-500/40'
    : 'border-bg-border'
  const pctPillCls =
    st.status === 'good' ? 'bg-emerald-500/20 text-emerald-200'
    : st.status === 'warn' ? 'bg-amber-500/20 text-amber-200'
    : st.status === 'bad' ? 'bg-red-500/20 text-red-200'
    : 'bg-bg-hover text-text-muted'

  return (
    <div className={clsx('bg-bg-card border rounded-xl overflow-hidden', glow)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg-hover/40 transition-colors"
        style={{ borderLeft: `3px solid ${g.color}` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {open ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${g.color}20` }}
          >
            <Icon size={14} style={{ color: g.color }} />
          </div>
          <div className="min-w-0 text-left">
            <div className="text-sm font-semibold truncate">{g.label}</div>
            <div className="text-[10px] text-text-muted">
              {rows.length} transaction{rows.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {g.target.label !== '—' && (
            <span className="hidden sm:inline-flex text-[9px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded-full border border-bg-border">
              🎯 {g.target.label}
            </span>
          )}
          {st.pct !== null && groupKey !== 'INCOME' && (
            <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', pctPillCls)}>
              {st.label}
            </span>
          )}
          <span className="text-sm font-bold tabular-nums" style={{ color: groupKey === 'INCOME' ? '#10B981' : undefined }}>
            {formatMoney(total)}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {rows.length === 0 ? (
            <div className="text-xs text-text-muted py-3 text-center">No transactions in this group</div>
          ) : (
            Array.from(subMap.entries()).map(([catKey, subRows]) => (
              <SubBlock
                key={catKey}
                catKey={catKey}
                subRows={subRows}
                catById={catById}
                categories={categories}
                open={openSubs.has(`${groupKey}:${catKey}`)}
                onToggle={() => toggleSub(`${groupKey}:${catKey}`)}
                assignCategory={assignCategory}
                updateRow={updateRow}
                removeRow={removeRow}
                toggleFlag={toggleFlag}
                pickerForRow={pickerForRow}
                setPickerForRow={setPickerForRow}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   SUB BLOCK (per sub-category inside a group)
   ============================================================ */
function SubBlock({
  catKey, subRows, catById, categories, open, onToggle, assignCategory,
  updateRow, removeRow, toggleFlag, pickerForRow, setPickerForRow,
}: {
  catKey: string
  subRows: Row[]
  catById: Map<string, Category>
  categories: Category[]
  open: boolean
  onToggle: () => void
  assignCategory: (id: string, categoryId: string | null) => void
  updateRow: (id: string, patch: Partial<Row>) => void
  removeRow: (id: string) => void
  toggleFlag: (id: string) => void
  pickerForRow: string | null
  setPickerForRow: (id: string | null) => void
}) {
  const cat = catKey !== '__uncat__' ? catById.get(catKey) : null
  const subName = cat?.name || 'Uncategorized'
  const subTotal = subRows.reduce((s, r) => s + r.amount, 0)
  const isIncomeRow = subRows.length > 0 && subRows[0].type === 'INCOME'

  return (
    <div className="border border-dashed border-bg-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-bg-hover/30 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={11} className="text-text-muted" /> : <ChevronRight size={11} className="text-text-muted" />}
          {cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />}
          <span className="text-xs font-medium truncate">{subName}</span>
          <span className="text-[10px] text-text-muted bg-bg-card px-1.5 rounded-full">{subRows.length}</span>
        </div>
        <span className={clsx('text-xs font-bold tabular-nums', isIncomeRow && 'text-emerald-400')}>
          {isIncomeRow ? '+' : ''}{formatMoney(subTotal)}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-bg-border/60">
          {subRows.map((r) => (
            <TxRow
              key={r.id}
              row={r}
              categories={categories}
              catById={catById}
              assignCategory={assignCategory}
              updateRow={updateRow}
              removeRow={removeRow}
              toggleFlag={toggleFlag}
              pickerOpen={pickerForRow === r.id}
              setPickerOpen={(on) => setPickerForRow(on ? r.id : null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   TX ROW
   ============================================================ */
function TxRow({
  row, categories, catById, assignCategory, updateRow, removeRow, toggleFlag,
  pickerOpen, setPickerOpen,
}: {
  row: Row
  categories: Category[]
  catById: Map<string, Category>
  assignCategory: (id: string, categoryId: string | null) => void
  updateRow: (id: string, patch: Partial<Row>) => void
  removeRow: (id: string) => void
  toggleFlag: (id: string) => void
  pickerOpen: boolean
  setPickerOpen: (on: boolean) => void
}) {
  const cat = row.categoryId ? catById.get(row.categoryId) : null
  const catName = cat?.name || 'Pick category'
  const isLowConf = !row.categoryId || row.confidence < 0.7
  const isIncome = row.type === 'INCOME'

  return (
    <div className="px-2.5 py-2 hover:bg-bg-hover/30 transition-colors">
      <div className="flex items-center gap-2">
        <input
          className="input !py-1 !px-2 !text-xs w-[110px] shrink-0"
          type="date"
          value={row.date}
          onChange={(e) => updateRow(row.id, { date: e.target.value })}
        />
        <input
          className="input !py-1 !px-2 !text-sm flex-1 min-w-0"
          value={row.description}
          onChange={(e) => updateRow(row.id, { description: e.target.value })}
        />
        <input
          className={clsx(
            'input !py-1 !px-2 !text-sm text-right w-24 tabular-nums shrink-0',
            isIncome && '!text-emerald-400',
          )}
          type="number"
          step="0.01"
          value={row.amount}
          onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) || 0 })}
        />

        <CategoryPicker
          row={row}
          categories={categories}
          open={pickerOpen}
          setOpen={setPickerOpen}
          onPick={(id) => assignCategory(row.id, id)}
          catLabel={catName}
          isLowConf={isLowConf}
        />

        <button
          className={clsx(
            'w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors',
            row.flagged
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'border-bg-border text-text-muted hover:border-red-500/40 hover:text-red-300',
          )}
          onClick={() => toggleFlag(row.id)}
          title="Flag for later"
        >
          <Flag size={11} />
        </button>
        <button
          className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300 shrink-0"
          onClick={() => removeRow(row.id)}
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function CategoryPicker({
  row, categories, open, setOpen, onPick, catLabel, isLowConf,
}: {
  row: Row
  categories: Category[]
  open: boolean
  setOpen: (on: boolean) => void
  onPick: (id: string | null) => void
  catLabel: string
  isLowConf: boolean
}) {
  // Group categories by GroupKey for the dropdown
  const grouped = useMemo(() => {
    const map: Record<GroupKey, Category[]> = {
      INCOME: [], FIXED: [], INVEST: [], SAVINGS: [], GUILT_FREE: [],
    }
    categories.forEach((c) => {
      const key = categorySlugToGroup(c.slug, c.kind)
      map[key].push(c)
    })
    return map
  }, [categories])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest(`[data-picker-id="${row.id}"]`)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, row.id, setOpen])

  return (
    <div className="relative shrink-0" data-picker-id={row.id}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors max-w-[140px]',
          isLowConf
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20'
            : 'bg-bg-hover border-bg-border text-text-secondary hover:bg-bg-hover/60',
        )}
        title={catLabel}
      >
        <Folder size={10} />
        <span className="truncate">{catLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-[320px] overflow-y-auto bg-bg-card border border-bg-border rounded-lg shadow-pop p-1">
          <button
            onClick={() => onPick(null)}
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-bg-hover text-text-muted"
          >
            — Uncategorized —
          </button>
          {GROUPS.map((g) => {
            const list = grouped[g.key]
            if (!list.length) return null
            return (
              <div key={g.key} className="mt-1">
                <div className="px-2 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-text-muted border-t border-bg-border">
                  {g.label}
                </div>
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    className={clsx(
                      'w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs rounded hover:bg-bg-hover',
                      row.categoryId === c.id && 'bg-brand-500/15 text-brand-100 font-semibold',
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="truncate">{(c.parentId ? '— ' : '') + c.name}</span>
                    {row.categoryId === c.id && <Check size={10} className="ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   SMALL BITS
   ============================================================ */
function MonthPill({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
        active
          ? 'bg-brand-600 border-brand-500 text-white shadow-[0_6px_14px_-8px_rgba(99,102,241,0.6)]'
          : 'bg-bg-card border-bg-border text-text-secondary hover:border-brand-500/40',
      )}
    >
      {children}
    </button>
  )
}
