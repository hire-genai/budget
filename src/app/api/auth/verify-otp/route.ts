import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseJson, handleServerError, apiError } from '@/lib/api'
import {
  compareOtp, createSession, setSessionCookie,
  normalizeEmail, OTP_MAX_ATTEMPTS,
} from '@/lib/auth'
import { seedNewUserDefaults } from '@/lib/seedDefaults'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  code: z.string().regex(/^\d{4,8}$/, 'Enter the numeric code you received'),
  name: z.string().min(2).max(80).optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, bodySchema)
    if ('error' in parsed) return parsed.error
    const { email, code, name } = parsed.data

    const token = await prisma.otpToken.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!token) return apiError('No active code — please request a new one.', 400)
    if (token.expiresAt.getTime() < Date.now()) {
      return apiError('This code has expired — please request a new one.', 400)
    }
    if (token.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } })
      return apiError('Too many attempts — please request a new code.', 429)
    }

    const ok = await compareOtp(code, token.codeHash)
    if (!ok) {
      await prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      })
      return apiError('Invalid code — please try again.', 400)
    }

    // Consume the token
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    })

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      if (token.purpose !== 'SIGNUP' || !name) {
        return apiError('Name is required to create a new account.', 400, { field: 'name' })
      }
      user = await prisma.user.create({
        data: {
          email, name,
          emailVerifiedAt: new Date(),
          settings: { create: {} },
        },
      })
      await seedNewUserDefaults(user.id)
    } else if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      })
    }

    // Housekeeping: purge expired tokens for this email
    await prisma.otpToken.deleteMany({
      where: { email, OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
    })

    const jwt = await createSession({ userId: user.id, email: user.email })
    await setSessionCookie(jwt)

    return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) {
    return handleServerError(err)
  }
}
