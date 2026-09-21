import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiOk, parseJson, handleServerError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { categoryUpdateSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, categoryUpdateSchema)
    if ('error' in parsed) return parsed.error
    const cat = await prisma.category.findFirst({ where: { id: params.id, userId: user.id } })
    if (!cat) return apiError('Not found', 404)
    const updated = await prisma.category.update({ where: { id: cat.id }, data: parsed.data })
    return apiOk({ category: updated })
  } catch (err) {
    return handleServerError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const cat = await prisma.category.findFirst({ where: { id: params.id, userId: user.id } })
    if (!cat) return apiError('Not found', 404)

    // Detach transactions rather than deleting them.
    await prisma.transaction.updateMany({ where: { userId: user.id, categoryId: cat.id }, data: { categoryId: null } })
    // Detach child categories (promote to top level)
    await prisma.category.updateMany({ where: { userId: user.id, parentId: cat.id }, data: { parentId: null } })
    await prisma.category.delete({ where: { id: cat.id } })
    return apiOk({ deleted: true })
  } catch (err) {
    return handleServerError(err)
  }
}
