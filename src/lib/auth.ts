import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
const COOKIE_NAME = 'budget_session'
const SESSION_DAYS = 30

// ---------------------------------------------------------------------------
// OTP configuration
// ---------------------------------------------------------------------------

export const OTP_EXPIRY_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 6
export const OTP_MIN_INTERVAL_SECONDS = 30 // throttle between requests per email
export const OTP_LENGTH = 6

type SessionPayload = { userId: string; email: string }

// ---------------------------------------------------------------------------
// OTP helpers
// ---------------------------------------------------------------------------

/** Cryptographically-secure 6-digit numeric OTP. */
export function generateOtpCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const n = buf[0] % 1_000_000
  return n.toString().padStart(OTP_LENGTH, '0')
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

export async function compareOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash)
}

// ---------------------------------------------------------------------------
// Session (JWT cookie)
// ---------------------------------------------------------------------------

export async function createSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null
    return { userId: payload.userId, email: payload.email }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  return prisma.user.findUnique({ where: { id: session.userId } })
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return user
}

export const AUTH_COOKIE = COOKIE_NAME

// ---------------------------------------------------------------------------
// Email normalisation
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
