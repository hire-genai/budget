import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { budgetUpdateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, budgetUpdateSchema)
    if ('error' in parsed) return parsed.error
    const b = await prisma.budget.findFirst({ where: { id: params.id, userId: user.id } })
    if (!b) return apiError('Not found', 404)
    const updated = await prisma.budget.update({
      where: { id: b.id },
      data: {
        ...(parsed.data.amount !== undefined ? { amount: toStr(parsed.data.amount) } : {}),
        ...(parsed.data.period !== undefined ? { period: parsed.data.period } : {}),
        ...(parsed.data.rollover !== undefined ? { rollover: parsed.data.rollover } : {}),
      },
    })
    return apiOk({ budget: updated })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const b = await prisma.budget.findFirst({ where: { id: params.id, userId: user.id } })
    if (!b) return apiError('Not found', 404)
    await prisma.budget.delete({ where: { id: b.id } })
    return apiOk({ deleted: true })
  } catch (err) {
    return handleServerError(err)
  }
}
