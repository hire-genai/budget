import { NextRequest } from 'next/server'
import { apiError, apiOk, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStatementWithGemini, type GeminiCategory } from '@/lib/gemini'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large PDFs

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel', // some browsers send this for .csv
])
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()

    const form = await req.formData()
    const file = form.get('file')
    const accountId = (form.get('accountId') as string | null)?.trim() ?? ''

    if (!file || !(file instanceof File)) {
      return apiError('No file uploaded', 400)
    }
    if (!accountId) return apiError('accountId is required', 400)

    const mime = (file.type || 'application/octet-stream').toLowerCase()
    const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isCsv =
      mime === 'text/csv' ||
      mime === 'application/vnd.ms-excel' ||
      file.name.toLowerCase().endsWith('.csv')
    const isText = mime === 'text/plain' || file.name.toLowerCase().endsWith('.txt')

    if (!isPdf && !isCsv && !isText && !ALLOWED_MIME.has(mime)) {
      return apiError('Only PDF, CSV, or plain-text statements are supported', 400)
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError('File is too large (max 15 MB)', 400)
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    })
    if (!account) return apiError('Invalid account', 400)

    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      select: { id: true, slug: true, name: true, kind: true, color: true, parentId: true, icon: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    })

    const buf = Buffer.from(await file.arrayBuffer())
    const base64 = buf.toString('base64')

    const effectiveMime = isPdf
      ? 'application/pdf'
      : isCsv
        ? 'text/csv'
        : 'text/plain'

    const geminiCats: GeminiCategory[] = categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      kind: (c.kind as 'EXPENSE' | 'INCOME') ?? 'EXPENSE',
    }))

    const { transactions, modelUsed } = await parseStatementWithGemini({
      fileData: base64,
      mimeType: effectiveMime,
      categories: geminiCats,
    })

    const bySlug = new Map(categories.map((c) => [c.slug, c]))
    const enriched = transactions.map((t, idx) => {
      const suggested = t.suggestedCategorySlug ? bySlug.get(t.suggestedCategorySlug) : null
      // Guard: never assign an EXPENSE txn to an INCOME category and vice versa
      const safeSuggested =
        suggested && suggested.kind === t.type ? suggested : null
      return {
        id: `tmp_${idx}`,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        categoryId: safeSuggested?.id ?? null,
        confidence: t.confidence,
      }
    })

    // Duplicate detection — check if any transactions already exist for this
    // account in the months covered by the uploaded statement.
    const monthKeys = Array.from(
      new Set(enriched.map((t) => t.date.slice(0, 7))),
    ).sort()

    const duplicates: Array<{ month: string; count: number }> = []
    if (monthKeys.length > 0) {
      const minMonth = monthKeys[0]
      const maxMonth = monthKeys[monthKeys.length - 1]
      const [minY, minM] = minMonth.split('-').map(Number)
      const [maxY, maxM] = maxMonth.split('-').map(Number)
      const rangeStart = new Date(Date.UTC(minY, minM - 1, 1))
      const rangeEnd = new Date(Date.UTC(maxY, maxM, 1)) // first day of month AFTER maxMonth

      const existing = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          accountId: account.id,
          date: { gte: rangeStart, lt: rangeEnd },
        },
        select: { date: true },
      })

      const byMonth = new Map<string, number>()
      existing.forEach((e) => {
        const key = e.date.toISOString().slice(0, 7)
        byMonth.set(key, (byMonth.get(key) || 0) + 1)
      })
      monthKeys.forEach((k) => {
        const count = byMonth.get(k) || 0
        if (count > 0) duplicates.push({ month: k, count })
      })
    }

    return apiOk({
      transactions: enriched,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        kind: c.kind,
        color: c.color,
        parentId: c.parentId,
        icon: c.icon,
      })),
      account: { id: account.id, name: account.name, currency: account.currency },
      modelUsed,
      total: enriched.length,
      duplicates,
    })
  } catch (err) {
    return handleServerError(err)
  }
}
