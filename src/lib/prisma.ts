import { PrismaClient } from '@prisma/client'

// Singleton across dev hot-reloads (and across the route modules that share one
// Node process — TDD §2 is explicit that this is not serverless).
const g = globalThis as unknown as { __wvPrisma?: PrismaClient }

export const prisma =
  g.__wvPrisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') g.__wvPrisma = prisma
