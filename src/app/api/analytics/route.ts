import { NextRequest } from 'next/server'
import { apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  computeCategoryBreakdown, computeMonthlySeries, computeTopMerchants,
  computePaymentMethodBreakdown, computeDayOfWeek, computeFixedVsVariable,
  computeNeedsVsWants, computePeriodTotals, monthRange, currentMonthRange,
  computeDailyTrend, lastNMonthsRange,
} from '@/lib/finance'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

function rangeFromQuery(url: URL) {
  const preset = url.searchParams.get('preset')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from && to) return { from: new Date(from), to: new Date(to) }
  switch (preset) {
    case 'last_month': return monthRange(subMonths(new Date(), 1))
    case 'last_3_months': return lastNMonthsRange(3)
    case 'last_6_months': return lastNMonthsRange(6)
    case 'ytd': return { from: new Date(new Date().getFullYear(), 0, 1), to: new Date() }
    case 'this_month':
    default:
      return currentMonthRange()
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const range = rangeFromQuery(url)

    // Also compute previous same-length window for comparison.
    const spanMs = range.to.getTime() - range.from.getTime()
    const prevRange = { from: new Date(range.from.getTime() - spanMs - 1), to: new Date(range.from.getTime() - 1) }

    const [
      totals, prevTotals, category, incomeCategory, monthly, merchants,
      paymentMethods, dayOfWeek, fixedVar, needsWants, dailyTrend,
    ] = await Promise.all([
      computePeriodTotals(user.id, range),
      computePeriodTotals(user.id, prevRange),
      computeCategoryBreakdown(user.id, range, { type: 'EXPENSE' }),
      computeCategoryBreakdown(user.id, range, { type: 'INCOME' }),
      computeMonthlySeries(user.id, 12),
      computeTopMerchants(user.id, range, 12),
      computePaymentMethodBreakdown(user.id, range),
      computeDayOfWeek(user.id, range),
      computeFixedVsVariable(user.id, range),
      computeNeedsVsWants(user.id, range),
      computeDailyTrend(user.id, range),
    ])

    return apiOk({
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals, prevTotals,
      category, incomeCategory, monthly, merchants,
      paymentMethods, dayOfWeek, fixedVar, needsWants, dailyTrend,
    })
  } catch (err) { return handleServerError(err) }
}
