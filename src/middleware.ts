import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret')
const AUTH_COOKIE = 'budget_session'

const PUBLIC_PATHS = ['/login', '/api/auth/request-otp', '/api/auth/verify-otp', '/api/auth/logout']
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/robots', '/sitemap']

async function isValidToken(token: string) {
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()
  if (PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next()

  const token = req.cookies.get(AUTH_COOKIE)?.value

  const authed = token ? await isValidToken(token) : false

  if (!authed) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
