import { NextRequest } from 'next/server'
import { apiError, apiOk, handleServerError, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toStr } from '@/lib/money'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const rowSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  type: z.enum(['EXPENSE', 'INCOME']),
  categoryId: z.string().nullable().optional(),
})

const bodySchema = z.object({
  accountId: z.string().min(1),
  transactions: z.array(rowSchema).min(1).max(2000),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, bodySchema)
    if ('error' in parsed) return parsed.error
    const { accountId, transactions } = parsed.data

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    })
    if (!account) return apiError('Invalid account', 400)

    const uniqueCategoryIds = Array.from(
      new Set(transactions.map((t) => t.categoryId).filter((v): v is string => !!v)),
    )
    const validCategories = uniqueCategoryIds.length
      ? await prisma.category.findMany({
          where: { userId: user.id, id: { in: uniqueCategoryIds } },
          select: { id: true, kind: true },
        })
      : []
    const validCategoryMap = new Map(validCategories.map((c) => [c.id, c.kind]))

    let inserted = 0
    for (const row of transactions) {
      const date = new Date(row.date)
      if (isNaN(date.getTime())) continue

      const categoryKind = row.categoryId ? validCategoryMap.get(row.categoryId) : undefined
      const safeCategoryId =
        row.categoryId && categoryKind === row.type ? row.categoryId : null

      await prisma.transaction.create({
        data: {
          userId: user.id,
          amount: toStr(row.amount),
          type: row.type,
          currency: account.currency,
          date,
          accountId: account.id,
          categoryId: safeCategoryId,
          paymentMethod: 'BANK_TRANSFER',
          needType: 'NEED',
          description: row.description.trim(),
        },
      })
      inserted += 1
    }

    return apiOk({ inserted, total: transactions.length })
  } catch (err) {
    return handleServerError(err)
  }
}
