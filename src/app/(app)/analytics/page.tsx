'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardTitle, EmptyState } from '@/components/ui/Card'
import { StatTile } from '@/components/dashboard/StatTile'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { IncomeExpenseBars } from '@/components/charts/IncomeExpenseBars'
import { TrendLine } from '@/components/charts/TrendLine'
import { formatMoney, formatMoneyShort } from '@/lib/formatters'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import clsx from 'clsx'

const PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'last_6_months', label: 'Last 6 months' },
  { key: 'ytd', label: 'This year' },
]

export default function AnalyticsPage() {
  const [preset, setPreset] = useState('this_month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/analytics?preset=${preset}`).then((r) => r.json())
    setData(res); setLoading(false)
  }, [preset])
  useEffect(() => { load() }, [load])

  if (loading || !data) return <div className="text-sm text-text-secondary">Loading analytics…</div>

  const income = Number(data.totals.income)
  const expense = Number(data.totals.expense)
  const savings = Number(data.totals.savings)
  const prevExpense = Number(data.prevTotals.expense)
  const expenseDelta = prevExpense === 0 ? 0 : ((expense - prevExpense) / prevExpense) * 100

  const donut = (data.category || []).slice(0, 10).map((c: any) => ({ name: c.name, value: Number(c.amount), color: c.color }))
  const monthly = (data.monthly || []).map((p: any) => ({ label: p.label, income: Number(p.income), expense: Number(p.expense) }))
  const trend = (data.dailyTrend || []).map((p: any) => ({ date: p.date, amount: Number(p.amount) }))

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Analytics</div>
          <div className="text-sm text-text-secondary">Deep dive into your income, spending, and behaviour.</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={clsx('px-3 py-1.5 text-xs rounded-lg border',
                preset === p.key
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                  : 'border-bg-border text-text-secondary hover:text-text-primary hover:bg-bg-hover')}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Income" value={formatMoney(income)} tone="positive" />
        <StatTile label="Expense" value={formatMoney(expense)} tone="negative"
          delta={prevExpense > 0 ? { pct: expenseDelta, label: 'vs prev' } : undefined} />
        <StatTile label="Savings" value={formatMoney(savings)} tone={savings >= 0 ? 'positive' : 'negative'} />
        <StatTile label="Savings rate" value={`${data.totals.savingsRate.toFixed(1)}%`} tone="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle title="Monthly income vs expense" subtitle="Last 12 months" />
          <IncomeExpenseBars data={monthly} />
        </Card>
        <Card>
          <CardTitle title="Category breakdown" />
          {donut.length === 0 ? <EmptyState title="No expenses in this range" /> : (
            <>
              <CategoryDonut data={donut} />
              <div className="mt-4 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(data.category || []).map((c: any) => (
                  <div key={c.name} className="flex items-center gap-2.5 text-sm">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle title="Daily spending trend" />
          <TrendLine data={trend} />
        </Card>
        <Card>
          <CardTitle title="Needs vs Wants" />
          <SplitBar
            left={{ label: 'Needs', value: Number(data.needsWants.need), color: '#6366F1' }}
            right={{ label: 'Wants', value: Number(data.needsWants.want), color: '#EC4899' }}
          />
          <div className="mt-6" />
          <CardTitle title="Fixed vs Variable" />
          <SplitBar
            left={{ label: 'Fixed', value: Number(data.fixedVar.fixed), color: '#14B8A6' }}
            right={{ label: 'Variable', value: Number(data.fixedVar.variable), color: '#F59E0B' }}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle title="Top merchants" />
          {(data.merchants || []).length === 0
            ? <EmptyState title="No merchant activity" />
            : (
              <div className="divide-y divide-bg-border/60">
                {data.merchants.map((m: any) => (
                  <div key={m.merchantId || m.name} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-bg-hover text-text-secondary text-sm font-semibold flex items-center justify-center">{m.name.slice(0, 1).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{m.name}</div>
                      <div className="text-xs text-text-muted">{m.count} transactions</div>
                    </div>
                    <div className="text-sm tabular-nums font-medium">{formatMoney(m.amount)}</div>
                  </div>
                ))}
              </div>
            )}
        </Card>
        <Card>
          <CardTitle title="Payment methods" />
          {(data.paymentMethods || []).length === 0
            ? <EmptyState title="No spending yet" />
            : (
              <div className="space-y-2">
                {data.paymentMethods.map((p: any) => (
                  <div key={p.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <div>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}</div>
                      <div className="tabular-nums text-text-secondary"><span className="text-text-primary">{formatMoney(p.amount)}</span> · {p.pctOfTotal.toFixed(1)}%</div>
                    </div>
                    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, p.pctOfTotal)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>

      <Card>
        <CardTitle title="Spending by day of week" />
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data.dayOfWeek.map((d: any) => ({ ...d, amount: Number(d.amount) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E232E" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v: number) => formatMoneyShort(v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ backgroundColor: '#141822', borderColor: '#1E232E', borderRadius: 10 }} />
              <Bar dataKey="amount" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function SplitBar({ left, right }: { left: { label: string; value: number; color: string }; right: { label: string; value: number; color: string } }) {
  const total = left.value + right.value
  const lp = total > 0 ? (left.value / total) * 100 : 0
  const rp = total > 0 ? (right.value / total) * 100 : 0
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-hover">
        {total > 0 && <div style={{ width: `${lp}%`, backgroundColor: left.color }} />}
        {total > 0 && <div style={{ width: `${rp}%`, backgroundColor: right.color }} />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="flex items-center gap-1.5 text-text-secondary text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: left.color }} />{left.label}</div>
          <div className="font-semibold tabular-nums">{formatMoney(left.value)} <span className="text-text-muted text-xs font-normal">· {lp.toFixed(1)}%</span></div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-text-secondary text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: right.color }} />{right.label}</div>
          <div className="font-semibold tabular-nums">{formatMoney(right.value)} <span className="text-text-muted text-xs font-normal">· {rp.toFixed(1)}%</span></div>
        </div>
      </div>
    </div>
  )
}
