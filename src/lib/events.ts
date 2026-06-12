import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// Append a row to the events table (TDD §8). Fail-open: logging must never break a
// turn. Event types per §8 + the additive ones (generation_failed, director_warning,
// mock_queue_empty, reader_disputed, mobile_gate).
export async function logEvent(
  sessionId: string,
  type: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.event.create({
      data: { sessionId, type, payload: payload as Prisma.InputJsonValue },
    })
  } catch {
    /* never block the pipeline on a logging failure */
  }
}
