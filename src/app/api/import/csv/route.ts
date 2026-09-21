import { NextRequest } from 'next/server'
import { apiError, apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toStr } from '@/lib/money'

export const dynamic = 'force-dynamic'

/**
 * CSV import (JSON payload).
 * Client parses the CSV, sends rows, and marks preview=true first,
 * then preview=false to commit. Rows carry an accountId; missing fields are validated.
 */

const rowSchema = z.object({
  date: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  accountId: z.string().min(1),
  transferAccountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  merchantName: z.string().optional().nullable(),
  paymentMethod: z.string().optional(),
  description: z.string().optional().nullable(),
})

const bodySchema = z.object({
  preview: z.boolean().default(true),
  rows: z.array(z.record(z.string())).max(2000),
  mapping: z.object({
    accountId: z.string(),  // default account to fall back on
    dateFormat: z.string().optional(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid payload', 400, parsed.error.flatten())
    const { preview, rows, mapping } = parsed.data

    const acct = await prisma.account.findFirst({ where: { id: mapping.accountId, userId: user.id } })
    if (!acct) return apiError('Invalid target account', 400)

    const validated: Array<{ ok: boolean; row: any; error?: string }> = []
    for (const raw of rows) {
      const attempt = {
        date: raw['Date'] || raw['date'],
        amount: raw['Amount'] || raw['amount'],
        type: (raw['Type'] || raw['type'] || 'EXPENSE').toString().toUpperCase(),
        accountId: mapping.accountId,
        merchantName: raw['Merchant'] || raw['merchant'] || null,
        description: raw['Description'] || raw['description'] || null,
        paymentMethod: (raw['Payment Method'] || raw['paymentMethod'] || 'UPI').toString().toUpperCase().replace(/\s+/g, '_'),
      }
      try {
        const r = rowSchema.parse(attempt)
        const amt = Number(r.amount)
        if (!isFinite(amt) || amt <= 0) throw new Error('Invalid amount')
        const d = new Date(r.date)
        if (isNaN(d.getTime())) throw new Error('Invalid date')
        validated.push({ ok: true, row: { ...r, amount: amt, date: d.toISOString() } })
      } catch (err) {
        validated.push({ ok: false, row: attempt, error: err instanceof Error ? err.message : 'Invalid' })
      }
    }

    if (preview) {
      return apiOk({
        preview: true,
        totalRows: rows.length,
        validRows: validated.filter((v) => v.ok).length,
        invalidRows: validated.filter((v) => !v.ok).length,
        rows: validated,
      })
    }

    // Commit
    let inserted = 0
    for (const v of validated) {
      if (!v.ok) continue
      let merchantId: string | null = null
      const name = (v.row.merchantName || '').trim()
      if (name) {
        const merchant = await prisma.merchant.upsert({
          where: { userId_name: { userId: user.id, name } },
          create: { userId: user.id, name }, update: {},
        })
        merchantId = merchant.id
      }
      await prisma.transaction.create({
        data: {
          userId: user.id,
          amount: toStr(v.row.amount),
          type: v.row.type,
          currency: acct.currency,
          date: new Date(v.row.date),
          accountId: v.row.accountId,
          merchantId,
          paymentMethod: v.row.paymentMethod,
          description: v.row.description,
        },
      })
      inserted += 1
    }

    return apiOk({ preview: false, inserted, invalid: validated.filter((v) => !v.ok).length })
  } catch (err) {
    return handleServerError(err)
  }
}
