import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseJson, handleServerError, apiError } from '@/lib/api'
import {
  generateOtpCode, hashOtp, normalizeEmail,
  OTP_EXPIRY_MINUTES, OTP_MIN_INTERVAL_SECONDS,
} from '@/lib/auth'
import { sendOtpEmail, isMailerConfigured } from '@/lib/mailer'
import { addMinutes, differenceInSeconds } from 'date-fns'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  name: z.string().min(2).max(80).optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, bodySchema)
    if ('error' in parsed) return parsed.error
    const { email, name } = parsed.data

    // Throttle: allow at most one OTP request every OTP_MIN_INTERVAL_SECONDS per email
    const recent = await prisma.otpToken.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    })
    if (recent && differenceInSeconds(new Date(), recent.createdAt) < OTP_MIN_INTERVAL_SECONDS) {
      const wait = OTP_MIN_INTERVAL_SECONDS - differenceInSeconds(new Date(), recent.createdAt)
      return apiError(`Please wait ${wait}s before requesting another code.`, 429)
    }

    // Determine purpose based on whether user exists
    const user = await prisma.user.findUnique({ where: { email } })
    const purpose: 'LOGIN' | 'SIGNUP' = user ? 'LOGIN' : 'SIGNUP'
    if (purpose === 'SIGNUP' && !name) {
      return apiError('Name is required to create a new account.', 400, { field: 'name' })
    }

    // Invalidate previous unused OTPs for this email
    await prisma.otpToken.updateMany({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })

    const code = generateOtpCode()
    const codeHash = await hashOtp(code)
    await prisma.otpToken.create({
      data: {
        email,
        codeHash,
        purpose,
        expiresAt: addMinutes(new Date(), OTP_EXPIRY_MINUTES),
      },
    })

    await sendOtpEmail({ to: email, code, purpose })

    return NextResponse.json({
      ok: true,
      purpose,
      // We NEVER return the OTP itself. But in dev without SMTP, surface a
      // hint so the developer knows to look at the server console.
      devHint: !isMailerConfigured()
        ? 'SMTP not configured — the OTP has been printed to the server console.'
        : undefined,
    })
  } catch (err) {
    return handleServerError(err)
  }
}
