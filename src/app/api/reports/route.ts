import { NextRequest } from 'next/server'
import { apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computePeriodTotals, computeCategoryBreakdown, computeTopMerchants,
  computeBudgetStatuses, computeNeedsVsWants, computeFixedVsVariable,
  computeAccountBalances, monthRange,
} from '@/lib/finance'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const monthParam = url.searchParams.get('month') // e.g. "2026-03"
    let refDate = new Date()
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      refDate = new Date(y, m - 1, 15)
    }
    const range = monthRange(refDate)

    const [totals, category, merchants, budgets, needsWants, fixedVar, balances, recurring] = await Promise.all([
      computePeriodTotals(user.id, range),
      computeCategoryBreakdown(user.id, range, { type: 'EXPENSE' }),
      computeTopMerchants(user.id, range, 10),
      computeBudgetStatuses(user.id, refDate),
      computeNeedsVsWants(user.id, range),
      computeFixedVsVariable(user.id, range),
      computeAccountBalances(user.id),
      prisma.recurringTransaction.findMany({
        where: { userId: user.id, isActive: true },
        select: { name: true, amount: true, frequency: true, type: true },
      }),
    ])

    return apiOk({
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals, category, merchants, budgets, needsWants, fixedVar, balances, recurring,
    })
  } catch (err) { return handleServerError(err) }
}
