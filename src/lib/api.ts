import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { getCurrentUser } from './auth'

export async function withAuth<T>(
  fn: (userId: string) => Promise<T>,
): Promise<T | NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return fn(user.id)
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status })
}

export function apiOk<T>(data: T) {
  return NextResponse.json(data)
}

export async function parseJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  try {
    const body = await req.json()
    const data = schema.parse(body)
    return { data }
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: apiError('Validation failed', 400, err.flatten()),
      }
    }
    return { error: apiError('Invalid JSON body', 400) }
  }
}

export function handleServerError(err: unknown) {
  console.error('[api]', err)
  const message = err instanceof Error ? err.message : 'Unknown server error'
  return apiError(message, 500)
}
