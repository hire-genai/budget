import { NextRequest } from 'next/server'
import { apiOk, handleServerError, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  budgetAlertsEnabled: z.boolean().optional(),
  recurringAlerts: z.boolean().optional(),
  largeTxAlert: z.boolean().optional(),
  largeTxThreshold: z.string().optional(),
  weekStart: z.number().int().min(0).max(6).optional(),
})

export async function GET() {
  try {
    const user = await requireUser()
    const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } })
    return apiOk({ user, settings })
  } catch (err) { return handleServerError(err) }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = await parseJson(req, settingsSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const userUpdate: any = {}
    if (d.name) userUpdate.name = d.name
    if (d.currency) userUpdate.currency = d.currency
    if (d.timezone) userUpdate.timezone = d.timezone
    if (Object.keys(userUpdate).length) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdate })
    }
    const settingsUpdate: any = {}
    if (d.budgetAlertsEnabled !== undefined) settingsUpdate.budgetAlertsEnabled = d.budgetAlertsEnabled
    if (d.recurringAlerts !== undefined) settingsUpdate.recurringAlerts = d.recurringAlerts
    if (d.largeTxAlert !== undefined) settingsUpdate.largeTxAlert = d.largeTxAlert
    if (d.largeTxThreshold !== undefined) settingsUpdate.largeTxThreshold = d.largeTxThreshold
    if (d.weekStart !== undefined) settingsUpdate.weekStart = d.weekStart
    if (Object.keys(settingsUpdate).length) {
      await prisma.userSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...settingsUpdate },
        update: settingsUpdate,
      })
    }
    return apiOk({ ok: true })
  } catch (err) { return handleServerError(err) }
}
