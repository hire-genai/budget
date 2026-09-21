import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { goalUpdateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, goalUpdateSchema)
    if ('error' in parsed) return parsed.error
    const g = await prisma.financialGoal.findFirst({ where: { id: params.id, userId: user.id } })
    if (!g) return apiError('Not found', 404)
    const data = parsed.data
    const updated = await prisma.financialGoal.update({
      where: { id: g.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.targetAmount !== undefined ? { targetAmount: toStr(data.targetAmount) } : {}),
        ...(data.currentAmount !== undefined ? { currentAmount: toStr(data.currentAmount) } : {}),
        ...(data.targetDate !== undefined ? { targetDate: data.targetDate ? new Date(data.targetDate) : null } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    })
    return apiOk({ goal: updated })
  } catch (err) { return handleServerError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const g = await prisma.financialGoal.findFirst({ where: { id: params.id, userId: user.id } })
    if (!g) return apiError('Not found', 404)
    await prisma.financialGoal.delete({ where: { id: g.id } })
    return apiOk({ deleted: true })
  } catch (err) { return handleServerError(err) }
}
