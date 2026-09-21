import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { budgetCreateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'
import { computeBudgetStatuses } from '@/lib/finance'
import { startOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    const [budgets, statuses] = await Promise.all([
      prisma.budget.findMany({
        where: { userId: user.id },
        include: { category: true },
        orderBy: { startsOn: 'desc' },
      }),
      computeBudgetStatuses(user.id),
    ])
    return apiOk({ budgets, statuses })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, budgetCreateSchema)
    if ('error' in parsed) return parsed.error
    const cat = await prisma.category.findFirst({ where: { id: parsed.data.categoryId, userId: user.id } })
    if (!cat) return apiError('Invalid category', 400)
    const startsOn = parsed.data.startsOn ? new Date(parsed.data.startsOn) : startOfMonth(new Date())

    const created = await prisma.budget.upsert({
      where: {
        userId_categoryId_period_startsOn: {
          userId: user.id,
          categoryId: parsed.data.categoryId,
          period: parsed.data.period,
          startsOn,
        },
      },
      create: {
        userId: user.id,
        categoryId: parsed.data.categoryId,
        amount: toStr(parsed.data.amount),
        period: parsed.data.period,
        rollover: parsed.data.rollover,
        startsOn,
      },
      update: { amount: toStr(parsed.data.amount), rollover: parsed.data.rollover },
    })
    return apiOk({ budget: created })
  } catch (err) {
    return handleServerError(err)
  }
}
