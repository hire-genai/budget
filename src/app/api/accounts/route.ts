import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { accountCreateSchema } from '@/lib/validators'
import { computeAccountBalances } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    const balances = await computeAccountBalances(user.id)
    return apiOk({ accounts: balances })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, accountCreateSchema)
    if ('error' in parsed) return parsed.error
    const acct = await prisma.account.create({
      data: { ...parsed.data, userId: user.id },
    })
    return apiOk({ account: acct })
  } catch (err) {
    return handleServerError(err)
  }
}
