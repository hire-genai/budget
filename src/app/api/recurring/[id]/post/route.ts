import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { computeNextOccurrence } from '@/lib/finance'

export const dynamic = 'force-dynamic'

/** Manually post the next occurrence of a recurring transaction */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const r = await prisma.recurringTransaction.findFirst({ where: { id: params.id, userId: user.id } })
    if (!r) return apiError('Not found', 404)
    if (!r.isActive) return apiError('Recurring transaction is inactive', 400)

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: r.amount,
        type: r.type,
        currency: 'INR',
        date: r.nextOccurrence,
        accountId: r.accountId,
        categoryId: r.categoryId,
        paymentMethod: r.paymentMethod,
        needType: 'NEED',
        isFixed: true,
        description: r.name,
        recurringId: r.id,
      },
    })

    const next = computeNextOccurrence(r.nextOccurrence, r.frequency as any, r.intervalCount)
    await prisma.recurringTransaction.update({
      where: { id: r.id },
      data: { lastRunAt: new Date(), nextOccurrence: next },
    })

    return apiOk({ transaction: tx, nextOccurrence: next })
  } catch (err) {
    return handleServerError(err)
  }
}
