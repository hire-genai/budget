'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardTitle, EmptyState } from '@/components/ui/Card'
import { StatTile } from '@/components/dashboard/StatTile'
import { Progress } from '@/components/ui/Progress'
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/formatters'
import { Download, Printer } from 'lucide-react'
import { format, subMonths, startOfMonth } from 'date-fns'
import clsx from 'clsx'

export default function ReportsPage() {
  const [month, setMonth] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports?month=${month}`).then((r) => r.json())
    setData(res); setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  const monthOptions: string[] = []
  for (let i = 0; i < 12; i++) monthOptions.push(format(subMonths(new Date(), i), 'yyyy-MM'))

  function exportCSV() {
    const from = data.range.from.slice(0, 10)
    const to = data.range.to.slice(0, 10)
    window.location.href = `/api/export/csv?from=${from}&to=${to}`
  }

  if (loading || !data) return <div className="text-sm text-text-secondary">Loading report…</div>

  const income = Number(data.totals.income)
  const expense = Number(data.totals.expense)
  const savings = Number(data.totals.savings)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Reports</div>
          <div className="text-sm text-text-secondary">Detailed monthly breakdown with categories, budgets and merchants.</div>
        </div>
        <div className="flex gap-2">
          <select className="input max-w-[200px]" value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy')}</option>
            ))}
          </select>
          <button className="btn" onClick={exportCSV}><Download size={14} /> Export CSV</button>
          <button className="btn" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
        </div>
      </header>

      <div className="print:space-y-4 space-y-4">
        <Card>
          <div className="text-xs uppercase tracking-wider text-text-secondary">Monthly report</div>
          <div className="text-2xl font-semibold mt-1">{format(new Date(month + '-01'), 'MMMM yyyy')}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <StatTile label="Income" value={formatMoney(income)} tone="positive" />
            <StatTile label="Expense" value={formatMoney(expense)} tone="negative" />
            <StatTile label="Savings" value={formatMoney(savings)} tone={savings >= 0 ? 'positive' : 'negative'} />
            <StatTile label="Savings rate" value={`${data.totals.savingsRate.toFixed(1)}%`} tone="accent" />
          </div>
        </Card>

        <Card>
          <CardTitle title="Category breakdown" />
          {(data.category || []).length === 0
            ? <EmptyState title="No expenses this month" />
            : (
              <table className="table">
                <thead><tr><th>Category</th><th className="text-right">Spent</th><th className="text-right">% of total</th><th className="text-right">Transactions</th></tr></thead>
                <tbody>
                  {data.category.map((c: any) => (
                    <tr key={c.name}>
                      <td><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />{c.name}</div></td>
                      <td className="text-right tabular-nums">{formatMoney(c.amount)}</td>
                      <td className="text-right tabular-nums text-text-secondary">{c.pctOfTotal.toFixed(1)}%</td>
                      <td className="text-right tabular-nums text-text-secondary">{c.txCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardTitle title="Top merchants" />
            {(data.merchants || []).length === 0
              ? <EmptyState title="No merchant activity" />
              : (
                <table className="table">
                  <thead><tr><th>Merchant</th><th className="text-right">Amount</th><th className="text-right">Txns</th></tr></thead>
                  <tbody>
                    {data.merchants.map((m: any) => (
                      <tr key={m.merchantId || m.name}>
                        <td>{m.name}</td>
                        <td className="text-right tabular-nums">{formatMoney(m.amount)}</td>
                        <td className="text-right tabular-nums text-text-secondary">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </Card>

          <Card>
            <CardTitle title="Budget performance" />
            {(data.budgets || []).length === 0
              ? <EmptyState title="No budgets set" />
              : (
                <div className="space-y-3">
                  {data.budgets.map((b: any) => (
                    <div key={b.budgetId}>
                      <div className="flex justify-between text-sm mb-1">
                        <div>{b.categoryName}</div>
                        <div className="tabular-nums">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardTitle title="Needs vs Wants" />
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-text-secondary">Needs</div><div className="text-2xl font-semibold tabular-nums">{formatMoney(data.needsWants.need)}</div></div>
              <div><div className="text-xs text-text-secondary">Wants</div><div className="text-2xl font-semibold tabular-nums">{formatMoney(data.needsWants.want)}</div></div>
            </div>
          </Card>
          <Card>
            <CardTitle title="Fixed vs Variable" />
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-text-secondary">Fixed</div><div className="text-2xl font-semibold tabular-nums">{formatMoney(data.fixedVar.fixed)}</div></div>
              <div><div className="text-xs text-text-secondary">Variable</div><div className="text-2xl font-semibold tabular-nums">{formatMoney(data.fixedVar.variable)}</div></div>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle title="Account balances (current)" />
          <table className="table">
            <thead><tr><th>Account</th><th>Type</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {data.balances.filter((b: any) => !b.archived).map((b: any) => (
                <tr key={b.accountId}>
                  <td>{b.name}</td>
                  <td className="text-text-secondary text-sm">{b.type}</td>
                  <td className={clsx('text-right tabular-nums', Number(b.balance) < 0 ? 'text-accent-red' : '')}>{formatMoney(b.balance, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardTitle title="Recurring commitments" />
          {(data.recurring || []).length === 0
            ? <EmptyState title="No recurring transactions" />
            : (
              <table className="table">
                <thead><tr><th>Name</th><th>Frequency</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {data.recurring.map((r: any) => (
                    <tr key={r.name}><td>{r.name}</td><td className="text-text-secondary text-sm">{r.frequency}</td><td className="text-text-secondary text-sm">{r.type}</td><td className="text-right tabular-nums">{formatMoney(r.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>
    </div>
  )
}
