import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { goalContributionSchema } from '@/lib/validators'
import { add, toStr, m } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, goalContributionSchema)
    if ('error' in parsed) return parsed.error
    const g = await prisma.financialGoal.findFirst({ where: { id: params.id, userId: user.id } })
    if (!g) return apiError('Not found', 404)

    const contrib = await prisma.financialGoalContribution.create({
      data: { goalId: g.id, amount: toStr(parsed.data.amount), note: parsed.data.note ?? null },
    })
    const newAmount = add(g.currentAmount, parsed.data.amount)
    await prisma.financialGoal.update({ where: { id: g.id }, data: { currentAmount: toStr(newAmount) } })

    return apiOk({ contribution: contrib, currentAmount: toStr(newAmount) })
  } catch (err) { return handleServerError(err) }
}
