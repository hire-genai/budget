/**
 * Finance calculation service.
 *
 * All financial aggregation goes through here. The critical invariants:
 *
 *   1. TRANSFER transactions never contribute to income or expense totals.
 *   2. Money moves *between accounts* on transfers (from account -1, to +1).
 *   3. Credit-card purchases show as expenses on the credit-card account.
 *      Paying the credit card from a bank account is a TRANSFER (not an expense).
 *   4. Refunds (isRefund=true) reduce the EXPENSE total for the affected
 *      category rather than counting as income.
 *   5. All arithmetic uses Decimal — never native JS floats.
 */

import { prisma } from './prisma'
import { m, add, sub, toStr, type Money } from './money'
import Decimal from 'decimal.js'
import {
  startOfMonth, endOfMonth, subMonths, format,
  startOfDay, endOfDay, addDays, addWeeks, addMonths, addQuarters, addYears,
  differenceInCalendarDays, startOfWeek, endOfWeek, isBefore,
} from 'date-fns'
import type { Frequency } from './constants'

// ---------------------------------------------------------------------------
// Date-range helpers
// ---------------------------------------------------------------------------

export type Range = { from: Date; to: Date }

export function monthRange(d: Date): Range {
  return { from: startOfMonth(d), to: endOfMonth(d) }
}

export function currentMonthRange(): Range {
  return monthRange(new Date())
}

export function lastNMonthsRange(n: number): Range {
  const today = new Date()
  return {
    from: startOfMonth(subMonths(today, n - 1)),
    to: endOfMonth(today),
  }
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export type AccountBalance = {
  accountId: string
  name: string
  type: string
  currency: string
  color: string
  balance: string
  openingBalance: string
  archived: boolean
}

/**
 * Compute the current balance for every account of a user.
 *
 * Balance formula per account A:
 *   opening
 *   + income into A
 *   - expenses from A
 *   + transfers where A is the destination
 *   - transfers where A is the source
 */
export async function computeAccountBalances(userId: string): Promise<AccountBalance[]> {
  const [accounts, tx] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: [{ archived: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { userId },
      select: {
        amount: true,
        type: true,
        accountId: true,
        transferAccountId: true,
        isRefund: true,
      },
    }),
  ])

  const balances = new Map<string, Money>()
  for (const a of accounts) balances.set(a.id, m(a.openingBalance))

  for (const t of tx) {
    const amt = m(t.amount)
    if (t.type === 'EXPENSE') {
      // A refund is money coming BACK — it should increase the account balance.
      if (t.isRefund) {
        balances.set(t.accountId, add(balances.get(t.accountId) ?? 0, amt))
      } else {
        balances.set(t.accountId, sub(balances.get(t.accountId) ?? 0, amt))
      }
    } else if (t.type === 'INCOME') {
      balances.set(t.accountId, add(balances.get(t.accountId) ?? 0, amt))
    } else if (t.type === 'TRANSFER' && t.transferAccountId) {
      balances.set(t.accountId, sub(balances.get(t.accountId) ?? 0, amt))
      balances.set(t.transferAccountId, add(balances.get(t.transferAccountId) ?? 0, amt))
    }
  }

  return accounts.map((a) => ({
    accountId: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    color: a.color,
    balance: toStr(balances.get(a.id) ?? 0),
    openingBalance: a.openingBalance,
    archived: a.archived,
  }))
}

/**
 * Net worth = sum of all non-archived, non-credit-card account balances
 *   minus the outstanding credit-card debt (negative CC balance = money owed).
 *
 * We keep it simple: net worth is the arithmetic sum of every non-archived
 * account balance. Credit-card outstanding will naturally show as negative.
 */
export async function computeNetWorth(userId: string): Promise<{ total: string; byAccount: AccountBalance[] }> {
  const balances = await computeAccountBalances(userId)
  const total = balances
    .filter((b) => !b.archived)
    .reduce<Money>((acc, b) => add(acc, b.balance), new Decimal(0))
  return { total: toStr(total), byAccount: balances }
}

// ---------------------------------------------------------------------------
// Period aggregates (income, expense, savings, savings rate)
// ---------------------------------------------------------------------------

export type PeriodTotals = {
  income: string
  expense: string
  savings: string        // income - expense
  savingsRate: number    // percentage
  transactions: number
}

export async function computePeriodTotals(userId: string, range: Range): Promise<PeriodTotals> {
  const tx = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: range.from, lte: range.to },
    },
    select: { amount: true, type: true, isRefund: true },
  })

  let income = new Decimal(0)
  let expense = new Decimal(0)

  for (const t of tx) {
    if (t.type === 'INCOME') {
      income = income.plus(m(t.amount))
    } else if (t.type === 'EXPENSE') {
      // Refunds reduce expenses rather than adding income.
      if (t.isRefund) {
        expense = expense.minus(m(t.amount))
      } else {
        expense = expense.plus(m(t.amount))
      }
    }
    // TRANSFER intentionally ignored — internal money movement.
  }

  const savings = income.minus(expense)
  const savingsRate = income.isZero() ? 0 : savings.div(income).mul(100).toDecimalPlaces(1).toNumber()

  return {
    income: toStr(income),
    expense: toStr(expense),
    savings: toStr(savings),
    savingsRate,
    transactions: tx.length,
  }
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

export type CategoryBreakdown = {
  categoryId: string | null
  parentId: string | null
  name: string
  color: string
  amount: string
  txCount: number
  pctOfTotal: number
}

export async function computeCategoryBreakdown(
  userId: string,
  range: Range,
  opts: { type?: 'EXPENSE' | 'INCOME' } = { type: 'EXPENSE' },
): Promise<CategoryBreakdown[]> {
  const type = opts.type ?? 'EXPENSE'
  const tx = await prisma.transaction.findMany({
    where: {
      userId,
      type,
      date: { gte: range.from, lte: range.to },
    },
    select: {
      amount: true,
      isRefund: true,
      categoryId: true,
      category: {
        select: { id: true, name: true, color: true, parentId: true, parent: { select: { id: true, name: true, color: true } } },
      },
    },
  })

  // Roll up to parent-level for the top-level chart.
  const byParent = new Map<string | null, { name: string; color: string; amount: Money; count: number; parentId: string | null }>()
  let total = new Decimal(0)

  for (const t of tx) {
    const cat = t.category
    const key = cat?.parentId ? cat.parentId : cat?.id ?? null
    const name = cat?.parent?.name ?? cat?.name ?? 'Uncategorised'
    const color = cat?.parent?.color ?? cat?.color ?? '#6B7280'
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    const cur = byParent.get(key)
    if (cur) {
      cur.amount = cur.amount.plus(amt)
      cur.count += 1
    } else {
      byParent.set(key, { name, color, amount: amt, count: 1, parentId: null })
    }
    total = total.plus(amt)
  }

  const rows: CategoryBreakdown[] = []
  for (const [id, v] of byParent) {
    const pct = total.isZero() ? 0 : v.amount.div(total).mul(100).toDecimalPlaces(1).toNumber()
    rows.push({
      categoryId: id,
      parentId: null,
      name: v.name,
      color: v.color,
      amount: toStr(v.amount),
      txCount: v.count,
      pctOfTotal: pct,
    })
  }
  rows.sort((a, b) => Number(b.amount) - Number(a.amount))
  return rows
}

// ---------------------------------------------------------------------------
// Monthly income vs expense series
// ---------------------------------------------------------------------------

export type MonthlySeriesPoint = {
  monthKey: string // e.g. "2026-03"
  label: string   // "Mar '26"
  income: string
  expense: string
  savings: string
}

export async function computeMonthlySeries(userId: string, months = 6): Promise<MonthlySeriesPoint[]> {
  const range = lastNMonthsRange(months)
  const tx = await prisma.transaction.findMany({
    where: { userId, date: { gte: range.from, lte: range.to } },
    select: { amount: true, type: true, date: true, isRefund: true },
  })

  const buckets = new Map<string, { income: Money; expense: Money }>()
  const today = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(today, i)
    const key = format(d, 'yyyy-MM')
    buckets.set(key, { income: new Decimal(0), expense: new Decimal(0) })
  }

  for (const t of tx) {
    const key = format(t.date, 'yyyy-MM')
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (t.type === 'INCOME') bucket.income = bucket.income.plus(m(t.amount))
    else if (t.type === 'EXPENSE') {
      if (t.isRefund) bucket.expense = bucket.expense.minus(m(t.amount))
      else bucket.expense = bucket.expense.plus(m(t.amount))
    }
  }

  const out: MonthlySeriesPoint[] = []
  for (const [key, v] of buckets) {
    const [year, month] = key.split('-').map(Number)
    const label = format(new Date(year, month - 1, 1), "MMM ''yy")
    out.push({
      monthKey: key,
      label,
      income: toStr(v.income),
      expense: toStr(v.expense),
      savings: toStr(v.income.minus(v.expense)),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Daily spending trend
// ---------------------------------------------------------------------------

export type DailyPoint = { date: string; amount: string }

export async function computeDailyTrend(userId: string, range: Range): Promise<DailyPoint[]> {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: { amount: true, date: true, isRefund: true },
  })

  const days = new Map<string, Money>()
  const totalDays = differenceInCalendarDays(range.to, range.from) + 1
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(range.from, i)
    days.set(format(d, 'yyyy-MM-dd'), new Decimal(0))
  }
  for (const t of tx) {
    const key = format(t.date, 'yyyy-MM-dd')
    const cur = days.get(key) ?? new Decimal(0)
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    days.set(key, cur.plus(amt))
  }
  return Array.from(days.entries()).map(([date, amount]) => ({
    date, amount: toStr(amount),
  }))
}

// ---------------------------------------------------------------------------
// Merchant breakdown
// ---------------------------------------------------------------------------

export type MerchantRow = { merchantId: string | null; name: string; amount: string; count: number }

export async function computeTopMerchants(userId: string, range: Range, limit = 8): Promise<MerchantRow[]> {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: {
      amount: true, isRefund: true,
      merchantId: true, merchant: { select: { id: true, name: true } },
    },
  })
  const map = new Map<string | null, { name: string; amount: Money; count: number }>()
  for (const t of tx) {
    const key = t.merchant?.id ?? null
    const name = t.merchant?.name ?? '(No merchant)'
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    const cur = map.get(key)
    if (cur) { cur.amount = cur.amount.plus(amt); cur.count += 1 }
    else map.set(key, { name, amount: amt, count: 1 })
  }
  return Array.from(map.entries())
    .map(([id, v]) => ({ merchantId: id, name: v.name, amount: toStr(v.amount), count: v.count }))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Payment method breakdown
// ---------------------------------------------------------------------------

export async function computePaymentMethodBreakdown(userId: string, range: Range) {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: { amount: true, isRefund: true, paymentMethod: true },
  })
  const map = new Map<string, Money>()
  let total = new Decimal(0)
  for (const t of tx) {
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    map.set(t.paymentMethod, (map.get(t.paymentMethod) ?? new Decimal(0)).plus(amt))
    total = total.plus(amt)
  }
  return Array.from(map.entries()).map(([method, amount]) => ({
    method,
    amount: toStr(amount),
    pctOfTotal: total.isZero() ? 0 : amount.div(total).mul(100).toDecimalPlaces(1).toNumber(),
  })).sort((a, b) => Number(b.amount) - Number(a.amount))
}

// ---------------------------------------------------------------------------
// Day of week analysis
// ---------------------------------------------------------------------------

export async function computeDayOfWeek(userId: string, range: Range) {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: { amount: true, isRefund: true, date: true },
  })
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const totals: Money[] = labels.map(() => new Decimal(0))
  const counts = labels.map(() => 0)
  for (const t of tx) {
    const dow = new Date(t.date).getDay()
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    totals[dow] = totals[dow].plus(amt)
    counts[dow] += 1
  }
  return labels.map((label, i) => ({ label, amount: toStr(totals[i]), count: counts[i] }))
}

// ---------------------------------------------------------------------------
// Fixed vs variable / Needs vs Wants
// ---------------------------------------------------------------------------

export async function computeFixedVsVariable(userId: string, range: Range) {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: { amount: true, isRefund: true, isFixed: true },
  })
  let fixed = new Decimal(0), variable = new Decimal(0)
  for (const t of tx) {
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    if (t.isFixed) fixed = fixed.plus(amt); else variable = variable.plus(amt)
  }
  return { fixed: toStr(fixed), variable: toStr(variable) }
}

export async function computeNeedsVsWants(userId: string, range: Range) {
  const tx = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: range.from, lte: range.to } },
    select: { amount: true, isRefund: true, needType: true },
  })
  let need = new Decimal(0), want = new Decimal(0)
  for (const t of tx) {
    const amt = t.isRefund ? m(t.amount).negated() : m(t.amount)
    if (t.needType === 'WANT') want = want.plus(amt); else need = need.plus(amt)
  }
  return { need: toStr(need), want: toStr(want) }
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export type BudgetStatus = {
  budgetId: string
  categoryId: string
  categoryName: string
  categoryColor: string
  amount: string
  spent: string
  remaining: string
  usagePct: number
  status: 'HEALTHY' | 'NEAR_LIMIT' | 'OVER_BUDGET'
  period: string
  periodStart: string
  periodEnd: string
}

export async function computeBudgetStatuses(userId: string, referenceDate = new Date()): Promise<BudgetStatus[]> {
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      startsOn: { lte: endOfMonth(referenceDate) },
    },
    include: { category: true },
    orderBy: { startsOn: 'desc' },
  })

  const results: BudgetStatus[] = []
  const seenCategoryIds = new Set<string>()

  for (const b of budgets) {
    // Prefer the most recent budget per category that has already started.
    if (seenCategoryIds.has(b.categoryId)) continue
    if (b.startsOn.getTime() > referenceDate.getTime()) continue
    seenCategoryIds.add(b.categoryId)

    let periodStart: Date, periodEnd: Date
    if (b.period === 'WEEKLY') {
      periodStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
      periodEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })
    } else if (b.period === 'YEARLY') {
      periodStart = new Date(referenceDate.getFullYear(), 0, 1)
      periodEnd = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59)
    } else {
      periodStart = startOfMonth(referenceDate)
      periodEnd = endOfMonth(referenceDate)
    }

    // include child categories too
    const childCats = await prisma.category.findMany({
      where: { userId, parentId: b.categoryId },
      select: { id: true },
    })
    const catIds = [b.categoryId, ...childCats.map((c) => c.id)]

    const tx = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        categoryId: { in: catIds },
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { amount: true, isRefund: true },
    })

    let spent = new Decimal(0)
    for (const t of tx) {
      spent = t.isRefund ? spent.minus(m(t.amount)) : spent.plus(m(t.amount))
    }

    const amount = m(b.amount)
    const remaining = amount.minus(spent)
    const usagePct = amount.isZero() ? 0 : spent.div(amount).mul(100).toDecimalPlaces(1).toNumber()
    const status = usagePct >= 100 ? 'OVER_BUDGET' : usagePct >= 80 ? 'NEAR_LIMIT' : 'HEALTHY'

    results.push({
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? 'Category',
      categoryColor: b.category?.color ?? '#6366F1',
      amount: toStr(amount),
      spent: toStr(spent),
      remaining: toStr(remaining),
      usagePct,
      status,
      period: b.period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Recurring transactions: compute next occurrence
// ---------------------------------------------------------------------------

export function computeNextOccurrence(current: Date, frequency: Frequency, interval = 1): Date {
  switch (frequency) {
    case 'DAILY':     return addDays(current, interval)
    case 'WEEKLY':    return addWeeks(current, interval)
    case 'MONTHLY':   return addMonths(current, interval)
    case 'QUARTERLY': return addQuarters(current, interval)
    case 'YEARLY':    return addYears(current, interval)
  }
}

// ---------------------------------------------------------------------------
// Dashboard insights
// ---------------------------------------------------------------------------

export type Insight = { id: string; text: string; tone: 'info' | 'warn' | 'good' }

export async function computeInsights(userId: string): Promise<Insight[]> {
  const insights: Insight[] = []

  const thisMonth = currentMonthRange()
  const lastMonth = monthRange(subMonths(new Date(), 1))
  const [thisT, lastT] = await Promise.all([
    computePeriodTotals(userId, thisMonth),
    computePeriodTotals(userId, lastMonth),
  ])

  const thisExp = m(thisT.expense)
  const lastExp = m(lastT.expense)
  if (!lastExp.isZero()) {
    const diff = thisExp.minus(lastExp)
    const pct = diff.div(lastExp).mul(100).toDecimalPlaces(1).toNumber()
    if (Math.abs(pct) >= 5) {
      insights.push({
        id: 'mom-expense',
        text: pct > 0
          ? `You have spent ${toStr(diff)} more this month than last (${pct.toFixed(1)}% higher).`
          : `You have spent ${toStr(diff.abs())} less this month than last (${Math.abs(pct).toFixed(1)}% lower).`,
        tone: pct > 0 ? 'warn' : 'good',
      })
    }
  }

  // Category share
  const catBreak = await computeCategoryBreakdown(userId, thisMonth)
  const top = catBreak[0]
  if (top && top.pctOfTotal >= 15) {
    insights.push({
      id: 'top-cat',
      text: `${top.name} represents ${top.pctOfTotal.toFixed(1)}% of your spending this month (${top.amount}).`,
      tone: 'info',
    })
  }

  // Category-level MoM comparison
  const lastCatBreak = await computeCategoryBreakdown(userId, lastMonth)
  const lastByName = new Map(lastCatBreak.map((r) => [r.name, m(r.amount)]))
  for (const c of catBreak.slice(0, 5)) {
    const prev = lastByName.get(c.name)
    if (!prev || prev.isZero()) continue
    const cur = m(c.amount)
    const diff = cur.minus(prev)
    const pct = diff.div(prev).mul(100).toDecimalPlaces(1).toNumber()
    if (Math.abs(pct) >= 20 && !cur.isZero()) {
      insights.push({
        id: `cat-mom-${c.categoryId}`,
        text: pct > 0
          ? `${c.name} spending is up ${pct.toFixed(1)}% vs last month.`
          : `${c.name} spending is down ${Math.abs(pct).toFixed(1)}% vs last month.`,
        tone: pct > 0 ? 'warn' : 'good',
      })
    }
  }

  // Budget usage
  const budgets = await computeBudgetStatuses(userId)
  for (const b of budgets) {
    if (b.status === 'OVER_BUDGET') {
      insights.push({
        id: `budget-over-${b.budgetId}`,
        text: `Your ${b.categoryName} budget is exceeded — spent ${b.spent} of ${b.amount}.`,
        tone: 'warn',
      })
    } else if (b.status === 'NEAR_LIMIT') {
      insights.push({
        id: `budget-near-${b.budgetId}`,
        text: `Your ${b.categoryName} budget is ${b.usagePct.toFixed(0)}% used.`,
        tone: 'info',
      })
    }
  }

  // Savings rate
  const sr = thisT.savingsRate
  if (m(thisT.income).greaterThan(0)) {
    if (sr >= 20) {
      insights.push({ id: 'savings-good', text: `You're saving ${sr}% of your income this month — great pace.`, tone: 'good' })
    } else if (sr < 0) {
      insights.push({ id: 'savings-neg', text: `You're spending more than you earn this month.`, tone: 'warn' })
    }
  }

  return insights.slice(0, 6)
}

// ---------------------------------------------------------------------------
// Upcoming recurring payments
// ---------------------------------------------------------------------------

export async function computeUpcomingRecurring(userId: string, withinDays = 14) {
  const now = new Date()
  const horizon = addDays(now, withinDays)
  const rec = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      isActive: true,
      nextOccurrence: { gte: startOfDay(now), lte: endOfDay(horizon) },
    },
    include: { account: true, category: true },
    orderBy: { nextOccurrence: 'asc' },
  })
  return rec.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    type: r.type,
    frequency: r.frequency,
    accountName: r.account?.name ?? '',
    categoryName: r.category?.name ?? null,
    categoryColor: r.category?.color ?? '#6B7280',
    nextOccurrence: r.nextOccurrence.toISOString(),
    daysUntil: differenceInCalendarDays(r.nextOccurrence, now),
  }))
}

// ---------------------------------------------------------------------------
// Isolation helper — every relation lookup must be scoped by userId
// ---------------------------------------------------------------------------

export function scoped<T extends { userId: string }>(userId: string, extra: Partial<T> = {}): T {
  return { userId, ...extra } as T
}

export { isBefore } // re-export for callers
