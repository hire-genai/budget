import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { categoryCreateSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET() {
  try {
    const user = await requireUser()
    const cats = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    })
    return apiOk({ categories: cats })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, categoryCreateSchema)
    if ('error' in parsed) return parsed.error
    const { name, parentId, kind, color, icon } = parsed.data

    let baseSlug = slugify(name)
    if (!baseSlug) baseSlug = 'category'
    let slug = baseSlug
    let n = 1
    while (await prisma.category.findFirst({ where: { userId: user.id, slug } })) {
      n += 1
      slug = `${baseSlug}-${n}`
    }

    const cat = await prisma.category.create({
      data: { userId: user.id, name, slug, parentId: parentId || null, kind, color, icon },
    })
    return apiOk({ category: cat })
  } catch (err) {
    return handleServerError(err)
  }
}
