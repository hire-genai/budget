'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Plus,
  Lightbulb, ChevronRight, Calendar, Target, ArrowLeftRight, Repeat,
} from 'lucide-react'
import { Card, CardTitle, EmptyState } from '@/components/ui/Card'
import { StatTile } from '@/components/dashboard/StatTile'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { IncomeExpenseBars } from '@/components/charts/IncomeExpenseBars'
import { TrendLine } from '@/components/charts/TrendLine'
import { Progress } from '@/components/ui/Progress'
import { Modal } from '@/components/ui/Modal'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { formatMoney, formatMoneyShort, formatDate, relativeDate } from '@/lib/formatters'
import clsx from 'clsx'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  async function reload() {
    setLoading(true)
    const [dash, ac, cat] = await Promise.all([
      fetch('/api/dashboard').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
    setData(dash)
    setAccounts(ac.accounts || [])
    setCategories(cat.categories || [])
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  if (loading || !data) return <DashboardSkeleton />

  const { netWorth, monthTotals, category, monthly, trend, merchants, budgets, insights, upcoming, needsWants, recent, goals } = data

  const monthlyChartData = (monthly || []).map((p: any) => ({
    label: p.label,
    income: Number(p.income),
    expense: Number(p.expense),
  }))
  const donutData = (category || []).slice(0, 8).map((c: any) => ({
    name: c.name, value: Number(c.amount), color: c.color,
  }))
  const trendData = (trend || []).map((t: any) => ({ date: t.date, amount: Number(t.amount) }))

  const nw = Number(netWorth.total)
  const income = Number(monthTotals.income)
  const expense = Number(monthTotals.expense)
  const savings = Number(monthTotals.savings)
  const savingsRate = monthTotals.savingsRate

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Dashboard</div>
          <div className="text-sm text-text-secondary">Overview for {formatDate(new Date(), 'monthYear')}</div>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add transaction
        </button>
      </header>

      {/* Row 1 — top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile label="Net worth" value={formatMoney(nw)} icon={<Wallet size={16} />} sublabel="All accounts combined" />
        <StatTile label="Income (this month)" value={formatMoney(income)} icon={<ArrowDownLeft size={16} />} tone="positive" />
        <StatTile label="Expenses (this month)" value={formatMoney(expense)} icon={<ArrowUpRight size={16} />} tone="negative" />
        <StatTile
          label="Savings"
          value={formatMoney(savings)}
          icon={<PiggyBank size={16} />}
          tone={savings >= 0 ? 'positive' : 'negative'}
          sublabel={`Savings rate ${savingsRate.toFixed(1)}%`}
        />
      </div>

      {/* Row 2 — income vs expense + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle title="Income vs Expense" subtitle="Last 6 months" right={<Link href="/analytics" className="btn-ghost">View analytics <ChevronRight size={14} /></Link>} />
          {monthlyChartData.every((p: any) => p.income === 0 && p.expense === 0) ? (
            <EmptyState title="No monthly activity yet" hint="Add income or expenses to see the trend." icon={<TrendingUp size={16} />} />
          ) : <IncomeExpenseBars data={monthlyChartData} />}
        </Card>

        <Card>
          <CardTitle title="Spending insights" subtitle="Auto-generated from your transactions" />
          {insights.length === 0 ? (
            <EmptyState title="No insights yet" hint="Add a few transactions across two months to see comparisons." icon={<Lightbulb size={16} />} />
          ) : (
            <div className="space-y-2">
              {insights.map((i: any) => (
                <div key={i.id} className={clsx('flex items-start gap-2.5 rounded-lg px-3 py-2.5 border text-sm',
                  i.tone === 'warn' && 'bg-amber-500/10 border-amber-500/25 text-amber-100',
                  i.tone === 'good' && 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100',
                  i.tone === 'info' && 'bg-brand-500/10 border-brand-500/25 text-brand-100',
                )}>
                  <Lightbulb size={14} className="mt-0.5 shrink-0 opacity-80" />
                  <div>{i.text}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3 — category donut + budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle title="Spending by category" subtitle="This month" />
          {donutData.length === 0
            ? <EmptyState title="No expenses this month" hint="Once you add expenses, we'll break them down here." />
            : (
              <>
                <CategoryDonut data={donutData} />
                <div className="mt-4 space-y-1.5">
                  {(category || []).slice(0, 6).map((c: any) => (
                    <div key={c.categoryId || c.name} className="flex items-center gap-2.5 text-sm">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                      <span className="flex-1 truncate text-text-secondary">{c.name}</span>
                      <span className="tabular-nums">{formatMoneyShort(c.amount)}</span>
                      <span className="text-text-muted w-14 text-right tabular-nums">{c.pctOfTotal.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </Card>

        <Card>
          <CardTitle title="Budget overview" subtitle="Current period" right={<Link href="/budgets" className="btn-ghost">Manage <ChevronRight size={14} /></Link>} />
          {budgets.length === 0
            ? <EmptyState title="No budgets set" hint="Create budgets by category to track your spending goals." icon={<PiggyBank size={16} />} />
            : (
              <div className="space-y-3">
                {budgets.slice(0, 5).map((b: any) => (
                  <div key={b.budgetId}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                        <span>{b.categoryName}</span>
                        {b.status === 'OVER_BUDGET' && <span className="chip border-red-500/40 bg-red-500/10 text-red-200">Over</span>}
                        {b.status === 'NEAR_LIMIT' && <span className="chip border-amber-500/40 bg-amber-500/10 text-amber-200">Near limit</span>}
                      </div>
                      <div className="tabular-nums text-text-secondary">
                        <span className={b.status === 'OVER_BUDGET' ? 'text-accent-red' : ''}>{formatMoneyShort(b.spent)}</span>
                        <span className="text-text-muted"> / {formatMoneyShort(b.amount)}</span>
                      </div>
                    </div>
                    <Progress value={Number(b.spent)} max={Number(b.amount)}
                      tone={b.status === 'OVER_BUDGET' ? 'danger' : b.status === 'NEAR_LIMIT' ? 'warn' : 'primary'} />
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>

      {/* Row 4 — trend + needs vs wants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle title="Daily spending trend" subtitle={formatDate(new Date(), 'monthYear')} />
          {trendData.every((t: any) => t.amount === 0)
            ? <EmptyState title="No spending this month" />
            : <TrendLine data={trendData} />}
        </Card>

        <Card>
          <CardTitle title="Needs vs Wants" subtitle="This month" />
          <NeedsWantsBar need={Number(needsWants.need)} want={Number(needsWants.want)} />
        </Card>
      </div>

      {/* Row 5 — top merchants + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle title="Top merchants" subtitle="This month" />
          {merchants.length === 0
            ? <EmptyState title="No merchant activity" />
            : (
              <div className="divide-y divide-bg-border/60">
                {merchants.map((m: any, i: number) => (
                  <div key={m.merchantId || i} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-bg-hover text-text-secondary text-sm font-semibold flex items-center justify-center">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{m.name}</div>
                      <div className="text-xs text-text-muted">{m.count} transaction{m.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-sm tabular-nums">{formatMoney(m.amount)}</div>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Card>
          <CardTitle title="Upcoming payments" subtitle="Next 14 days" right={<Link href="/recurring" className="btn-ghost">All <ChevronRight size={14} /></Link>} />
          {upcoming.length === 0
            ? <EmptyState title="Nothing scheduled" hint="Add recurring subscriptions and bills to plan ahead." icon={<Repeat size={16} />} />
            : (
              <div className="divide-y divide-bg-border/60">
                {upcoming.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: u.categoryColor + '22', color: u.categoryColor }}>
                      <Calendar size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{u.name}</div>
                      <div className="text-xs text-text-muted">
                        {u.categoryName ?? 'Uncategorised'} · {u.accountName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm tabular-nums">{formatMoney(u.amount)}</div>
                      <div className="text-xs text-text-muted">{relativeDate(u.nextOccurrence)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>

      {/* Row 6 — recent transactions + goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle title="Recent transactions" right={<Link href="/transactions" className="btn-ghost">See all <ChevronRight size={14} /></Link>} />
          {recent.length === 0
            ? <EmptyState title="No transactions yet" hint="Click 'Add transaction' to record your first one." />
            : (
              <div className="overflow-x-auto -mx-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Account</th>
                      <th className="text-right">Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((t: any) => (
                      <tr key={t.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <TxTypeDot type={t.type} />
                            <div>
                              <div className="text-sm">{t.description || t.merchant?.name || (t.type === 'TRANSFER' ? `Transfer to ${t.transferAccount?.name}` : t.category?.name || 'Transaction')}</div>
                              {t.merchant?.name && t.description && <div className="text-xs text-text-muted">{t.merchant.name}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="text-text-secondary text-sm">
                          {t.type === 'TRANSFER'
                            ? <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={12} /> Transfer</span>
                            : (t.category?.name || '—')}
                        </td>
                        <td className="text-text-secondary text-sm">{t.account?.name}</td>
                        <td className={clsx('text-right tabular-nums font-medium',
                          t.type === 'INCOME' ? 'text-accent-green'
                          : t.type === 'EXPENSE' ? 'text-accent-red'
                          : 'text-text-primary')}>
                          {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}
                          {formatMoney(t.amount)}
                        </td>
                        <td className="text-text-secondary text-sm whitespace-nowrap">{formatDate(t.date, 'time')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        <Card>
          <CardTitle title="Financial goals" right={<Link href="/goals" className="btn-ghost">All <ChevronRight size={14} /></Link>} />
          {goals.length === 0
            ? <EmptyState title="No goals yet" hint="Save toward things that matter — a laptop, a trip, an emergency fund." icon={<Target size={16} />} />
            : (
              <div className="space-y-3">
                {goals.map((g: any) => {
                  const pct = Number(g.targetAmount) === 0 ? 0 : Math.min(100, (Number(g.currentAmount) / Number(g.targetAmount)) * 100)
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </div>
                        <div className="tabular-nums text-text-secondary">
                          <span>{formatMoneyShort(g.currentAmount)}</span>
                          <span className="text-text-muted"> / {formatMoneyShort(g.targetAmount)}</span>
                        </div>
                      </div>
                      <Progress value={Number(g.currentAmount)} max={Number(g.targetAmount)} tone={pct >= 100 ? 'success' : 'primary'} />
                      <div className="mt-1 text-[11px] text-text-muted">
                        {pct.toFixed(0)}% saved{g.targetDate && ` · target ${formatDate(g.targetDate)}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add transaction" subtitle="Record income, an expense, or a transfer.">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onSaved={() => { setAddOpen(false); reload() }}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>
    </div>
  )
}

function TxTypeDot({ type }: { type: string }) {
  const c = type === 'INCOME' ? 'bg-emerald-500' : type === 'EXPENSE' ? 'bg-red-500' : 'bg-brand-500'
  return <span className={clsx('w-2 h-2 rounded-full shrink-0', c)} />
}

function NeedsWantsBar({ need, want }: { need: number; want: number }) {
  const total = need + want
  const needPct = total > 0 ? (need / total) * 100 : 0
  const wantPct = total > 0 ? (want / total) * 100 : 0
  return (
    <div>
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-bg-hover">
        {total > 0 && <div className="bg-brand-500" style={{ width: `${needPct}%` }} />}
        {total > 0 && <div className="bg-accent-pink" style={{ width: `${wantPct}%` }} />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-text-secondary">Needs</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(need)}</div>
          <div className="text-[11px] text-text-muted">{needPct.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">Wants</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(want)}</div>
          <div className="text-[11px] text-text-muted">{wantPct.toFixed(1)}%</div>
        </div>
      </div>
      {total === 0 && <div className="text-xs text-text-muted mt-3">No expenses to categorise yet.</div>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-bg-hover rounded-md" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-bg-card rounded-xl border border-bg-border" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-bg-card rounded-xl border border-bg-border" />
        <div className="h-72 bg-bg-card rounded-xl border border-bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 bg-bg-card rounded-xl border border-bg-border" />
        <div className="h-72 bg-bg-card rounded-xl border border-bg-border" />
      </div>
    </div>
  )
}
