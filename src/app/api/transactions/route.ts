import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { transactionCreateSchema } from '@/lib/validators'
import { toStr } from '@/lib/money'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const p = url.searchParams

    const take = Math.min(Number(p.get('limit') ?? 50), 200)
    const skip = Math.max(Number(p.get('offset') ?? 0), 0)

    const where: Prisma.TransactionWhereInput = { userId: user.id }
    const q = p.get('q')?.trim()
    if (q) {
      where.OR = [
        { description: { contains: q } },
        { notes: { contains: q } },
        { merchant: { name: { contains: q } } },
      ]
    }
    const type = p.get('type')
    if (type && ['EXPENSE', 'INCOME', 'TRANSFER'].includes(type)) where.type = type
    const categoryId = p.get('categoryId'); if (categoryId) where.categoryId = categoryId
    const accountId = p.get('accountId'); if (accountId) where.accountId = accountId
    const merchantId = p.get('merchantId'); if (merchantId) where.merchantId = merchantId
    const paymentMethod = p.get('paymentMethod'); if (paymentMethod) where.paymentMethod = paymentMethod
    const needType = p.get('needType'); if (needType) where.needType = needType
    const from = p.get('from'); const to = p.get('to')
    if (from || to) {
      where.date = {}
      if (from) (where.date as any).gte = new Date(from)
      if (to) (where.date as any).lte = new Date(to)
    }
    const minAmount = p.get('minAmount'); const maxAmount = p.get('maxAmount')
    // amount stored as string; we can't easily numeric-filter in SQLite. Fetch and filter in-memory only when needed.

    const sort = p.get('sort') || 'date_desc'
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      sort === 'date_asc' ? { date: 'asc' } :
      sort === 'amount_desc' ? { amount: 'desc' } :
      sort === 'amount_asc' ? { amount: 'asc' } :
      { date: 'desc' }

    let [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where, orderBy: [orderBy, { createdAt: 'desc' }], skip, take,
        include: {
          account: { select: { id: true, name: true, color: true, type: true } },
          transferAccount: { select: { id: true, name: true, color: true, type: true } },
          category: { select: { id: true, name: true, color: true, parentId: true, parent: { select: { name: true, color: true } } } },
          merchant: { select: { id: true, name: true } },
          transactionTags: { include: { tag: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ])

    if (minAmount || maxAmount) {
      const minN = minAmount ? Number(minAmount) : -Infinity
      const maxN = maxAmount ? Number(maxAmount) : Infinity
      items = items.filter((t) => {
        const n = Number(t.amount)
        return n >= minN && n <= maxN
      })
    }

    return apiOk({ transactions: items, total, hasMore: skip + items.length < total })
  } catch (err) {
    return handleServerError(err)
  }
}

async function ensureMerchant(userId: string, input: { merchantId?: string | null; merchantName?: string | null }) {
  if (input.merchantId) {
    const m = await prisma.merchant.findFirst({ where: { id: input.merchantId, userId } })
    return m ? m.id : null
  }
  if (input.merchantName && input.merchantName.trim()) {
    const name = input.merchantName.trim()
    const existing = await prisma.merchant.findFirst({ where: { userId, name } })
    if (existing) return existing.id
    const created = await prisma.merchant.create({ data: { userId, name } })
    return created.id
  }
  return null
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const p = url.searchParams

    const where: Prisma.TransactionWhereInput = { userId: user.id }
    const q = p.get('q')?.trim()
    if (q) {
      where.OR = [
        { description: { contains: q } },
        { notes: { contains: q } },
        { merchant: { name: { contains: q } } },
      ]
    }
    const type = p.get('type')
    if (type && ['EXPENSE', 'INCOME', 'TRANSFER'].includes(type)) where.type = type
    const categoryId = p.get('categoryId'); if (categoryId) where.categoryId = categoryId
    const accountId = p.get('accountId'); if (accountId) where.accountId = accountId
    const merchantId = p.get('merchantId'); if (merchantId) where.merchantId = merchantId
    const paymentMethod = p.get('paymentMethod'); if (paymentMethod) where.paymentMethod = paymentMethod
    const needType = p.get('needType'); if (needType) where.needType = needType
    const from = p.get('from'); const to = p.get('to')
    if (from || to) {
      where.date = {}
      if (from) (where.date as any).gte = new Date(from)
      if (to) (where.date as any).lte = new Date(to)
    }

    // Hard safety gate: require ?confirm=DELETE to prevent accidental hits.
    if (p.get('confirm') !== 'DELETE') {
      return apiError('Pass ?confirm=DELETE to perform bulk delete', 400)
    }

    const result = await prisma.transaction.deleteMany({ where })
    return apiOk({ deleted: result.count })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, transactionCreateSchema)
    if ('error' in parsed) return parsed.error
    const data = parsed.data

    // Verify account ownership
    const acct = await prisma.account.findFirst({ where: { id: data.accountId, userId: user.id } })
    if (!acct) return apiError('Invalid account', 400)
    if (data.type === 'TRANSFER') {
      const dest = await prisma.account.findFirst({ where: { id: data.transferAccountId!, userId: user.id } })
      if (!dest) return apiError('Invalid destination account', 400)
    }
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId: user.id } })
      if (!cat) return apiError('Invalid category', 400)
    }

    const merchantId = await ensureMerchant(user.id, { merchantId: data.merchantId ?? null, merchantName: data.merchantName ?? null })

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: toStr(data.amount),
        type: data.type,
        currency: acct.currency,
        date: new Date(data.date),
        accountId: data.accountId,
        transferAccountId: data.type === 'TRANSFER' ? data.transferAccountId! : null,
        categoryId: data.type === 'TRANSFER' ? null : data.categoryId ?? null,
        merchantId: data.type === 'TRANSFER' ? null : merchantId,
        paymentMethod: data.paymentMethod,
        needType: data.needType,
        isFixed: data.isFixed,
        isRefund: data.isRefund,
        description: data.description ?? null,
        notes: data.notes ?? null,
      },
    })

    if (data.tags && data.tags.length) {
      for (const tagName of data.tags) {
        const trimmed = tagName.trim(); if (!trimmed) continue
        const tag = await prisma.tag.upsert({
          where: { userId_name: { userId: user.id, name: trimmed } },
          create: { userId: user.id, name: trimmed },
          update: {},
        })
        await prisma.transactionTag.create({ data: { transactionId: tx.id, tagId: tag.id } })
      }
    }

    return apiOk({ transaction: tx })
  } catch (err) {
    return handleServerError(err)
  }
}
