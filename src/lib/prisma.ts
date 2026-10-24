import { PrismaClient } from '@prisma/client'

// Singleton Prisma client for Next.js:
//  - In dev, HMR re-evaluates modules; we cache the client on globalThis so
//    hot reloads reuse the same connection pool instead of leaking new ones.
//  - When running against Neon's pooler (pgbouncer=true in DATABASE_URL),
//    prepared statements are disabled so transaction-pooling can't close
//    connections mid-query.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Clean shutdown so the pool is closed when the Node process exits.
// Prevents "Error { kind: Closed }" from stacking up across hot reloads.
if (process.env.NODE_ENV !== 'production') {
  const existing = (globalForPrisma as any)._prismaCleanup
  if (!existing) {
    const cleanup = async () => {
      try { await prisma.$disconnect() } catch { /* noop */ }
    }
    process.once('beforeExit', cleanup)
    process.once('SIGINT', cleanup)
    process.once('SIGTERM', cleanup)
    ;(globalForPrisma as any)._prismaCleanup = true
  }
}
