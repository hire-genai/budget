import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { recurringUpdateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, recurringUpdateSchema)
    if ('error' in parsed) return parsed.error
    const r = await prisma.recurringTransaction.findFirst({ where: { id: params.id, userId: user.id } })
    if (!r) return apiError('Not found', 404)
    const data = parsed.data
    const updated = await prisma.recurringTransaction.update({
      where: { id: r.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.amount !== undefined ? { amount: toStr(data.amount) } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
        ...(data.intervalCount !== undefined ? { intervalCount: data.intervalCount } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
        ...(data.autoPost !== undefined ? { autoPost: data.autoPost } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    return apiOk({ recurring: updated })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const r = await prisma.recurringTransaction.findFirst({ where: { id: params.id, userId: user.id } })
    if (!r) return apiError('Not found', 404)
    await prisma.recurringTransaction.delete({ where: { id: r.id } })
    return apiOk({ deleted: true })
  } catch (err) {
    return handleServerError(err)
  }
}
