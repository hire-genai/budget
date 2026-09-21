import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { recurringCreateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'
import { computeNextOccurrence } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    const items = await prisma.recurringTransaction.findMany({
      where: { userId: user.id },
      include: { account: true, category: true },
      orderBy: [{ isActive: 'desc' }, { nextOccurrence: 'asc' }],
    })
    return apiOk({ recurring: items })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, recurringCreateSchema)
    if ('error' in parsed) return parsed.error
    const data = parsed.data
    const acct = await prisma.account.findFirst({ where: { id: data.accountId, userId: user.id } })
    if (!acct) return apiError('Invalid account', 400)
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId: user.id } })
      if (!cat) return apiError('Invalid category', 400)
    }
    const start = new Date(data.startDate)
    const created = await prisma.recurringTransaction.create({
      data: {
        userId: user.id,
        name: data.name,
        amount: toStr(data.amount),
        type: data.type,
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        paymentMethod: data.paymentMethod,
        frequency: data.frequency,
        intervalCount: data.intervalCount,
        startDate: start,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextOccurrence: start,
        autoPost: data.autoPost,
        notes: data.notes ?? null,
      },
    })
    return apiOk({ recurring: created })
  } catch (err) {
    return handleServerError(err)
  }
}
