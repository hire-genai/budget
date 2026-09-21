import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { transactionPartialSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const tx = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        account: true, transferAccount: true,
        category: true, merchant: true,
        transactionTags: { include: { tag: true } },
      },
    })
    if (!tx) return apiError('Not found', 404)
    return apiOk({ transaction: tx })
  } catch (err) { return handleServerError(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, transactionPartialSchema)
    if ('error' in parsed) return parsed.error
    const data = parsed.data
    const existing = await prisma.transaction.findFirst({ where: { id: params.id, userId: user.id } })
    if (!existing) return apiError('Not found', 404)

    if (data.accountId) {
      const acct = await prisma.account.findFirst({ where: { id: data.accountId, userId: user.id } })
      if (!acct) return apiError('Invalid account', 400)
    }
    if (data.transferAccountId) {
      const dest = await prisma.account.findFirst({ where: { id: data.transferAccountId, userId: user.id } })
      if (!dest) return apiError('Invalid destination account', 400)
    }

    const updated = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        ...(data.amount !== undefined ? { amount: toStr(data.amount) } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
        ...(data.transferAccountId !== undefined ? { transferAccountId: data.transferAccountId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.needType !== undefined ? { needType: data.needType } : {}),
        ...(data.isFixed !== undefined ? { isFixed: data.isFixed } : {}),
        ...(data.isRefund !== undefined ? { isRefund: data.isRefund } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    })
    return apiOk({ transaction: updated })
  } catch (err) { return handleServerError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const existing = await prisma.transaction.findFirst({ where: { id: params.id, userId: user.id } })
    if (!existing) return apiError('Not found', 404)
    await prisma.transaction.delete({ where: { id: existing.id } })
    return apiOk({ deleted: true })
  } catch (err) { return handleServerError(err) }
}
