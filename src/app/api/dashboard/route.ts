import { NextRequest } from 'next/server'
import { apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  computeAccountBalances, computeNetWorth, computePeriodTotals,
  computeCategoryBreakdown, computeMonthlySeries, computeDailyTrend,
  computeTopMerchants, computeBudgetStatuses, computeInsights,
  computeUpcomingRecurring, computeNeedsVsWants, currentMonthRange,
} from '@/lib/finance'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser()
    const monthRange = currentMonthRange()

    const [
      netWorth, monthTotals, category, monthly, trend, merchants,
      budgets, insights, upcoming, needsWants, recent, goals,
    ] = await Promise.all([
      computeNetWorth(user.id),
      computePeriodTotals(user.id, monthRange),
      computeCategoryBreakdown(user.id, monthRange),
      computeMonthlySeries(user.id, 6),
      computeDailyTrend(user.id, monthRange),
      computeTopMerchants(user.id, monthRange, 6),
      computeBudgetStatuses(user.id),
      computeInsights(user.id),
      computeUpcomingRecurring(user.id, 14),
      computeNeedsVsWants(user.id, monthRange),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        include: {
          account: { select: { name: true, color: true } },
          transferAccount: { select: { name: true } },
          category: { select: { name: true, color: true } },
          merchant: { select: { name: true } },
        },
      }),
      prisma.financialGoal.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
    ])

    return apiOk({
      netWorth, monthTotals, category, monthly, trend, merchants,
      budgets, insights, upcoming, needsWants, recent, goals,
    })
  } catch (err) { return handleServerError(err) }
}
