import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const user = await requireUser()
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where: any = { userId: user.id }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const items = await prisma.transaction.findMany({
    where, orderBy: { date: 'desc' },
    include: {
      account: true, transferAccount: true, category: true, merchant: true,
    },
  })

  const header = ['Date', 'Type', 'Amount', 'Currency', 'Account', 'Transfer To', 'Category', 'Merchant', 'Payment Method', 'Need/Want', 'Description', 'Notes']
  const lines = [header.join(',')]
  for (const t of items) {
    lines.push([
      t.date.toISOString(),
      t.type,
      t.amount,
      t.currency,
      csvEscape(t.account?.name),
      csvEscape(t.transferAccount?.name),
      csvEscape(t.category?.name),
      csvEscape(t.merchant?.name),
      t.paymentMethod,
      t.needType,
      csvEscape(t.description),
      csvEscape(t.notes),
    ].join(','))
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
