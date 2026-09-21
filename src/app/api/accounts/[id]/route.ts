import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { accountUpdateSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, accountUpdateSchema)
    if ('error' in parsed) return parsed.error
    const acct = await prisma.account.findFirst({ where: { id: params.id, userId: user.id } })
    if (!acct) return apiError('Not found', 404)
    const updated = await prisma.account.update({ where: { id: acct.id }, data: parsed.data })
    return apiOk({ account: updated })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const acct = await prisma.account.findFirst({ where: { id: params.id, userId: user.id } })
    if (!acct) return apiError('Not found', 404)
    const txCount = await prisma.transaction.count({
      where: { userId: user.id, OR: [{ accountId: acct.id }, { transferAccountId: acct.id }] },
    })
    if (txCount > 0) {
      // Never orphan transactions — archive instead.
      await prisma.account.update({ where: { id: acct.id }, data: { archived: true } })
      return apiOk({ archived: true, note: 'Account had transactions and was archived instead of deleted.' })
    }
    await prisma.account.delete({ where: { id: acct.id } })
    return apiOk({ deleted: true })
  } catch (err) {
    return handleServerError(err)
  }
}
