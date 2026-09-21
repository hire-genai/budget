import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { goalCreateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    const goals = await prisma.financialGoal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { contributions: { orderBy: { createdAt: 'desc' } } },
    })
    return apiOk({ goals })
  } catch (err) { return handleServerError(err) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, goalCreateSchema)
    if ('error' in parsed) return parsed.error
    const g = await prisma.financialGoal.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        targetAmount: toStr(parsed.data.targetAmount),
        currentAmount: toStr(parsed.data.currentAmount),
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        color: parsed.data.color, icon: parsed.data.icon, note: parsed.data.note ?? null,
      },
    })
    return apiOk({ goal: g })
  } catch (err) { return handleServerError(err) }
}
