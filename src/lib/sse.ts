// Minimal SSE writer over a ReadableStream controller. Events are framed as
//   event: <type>\ndata: <json>\n\n
// which the test harness's parser (tests/contract/helpers.ts) consumes.

export interface SseWriter {
  emit: (type: string, data: unknown) => void
  close: () => void
  closed: () => boolean
}

export function makeSse(controller: ReadableStreamDefaultController): SseWriter {
  const enc = new TextEncoder()
  let isClosed = false
  return {
    emit(type, data) {
      if (isClosed) return
      try {
        controller.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
      } catch {
        isClosed = true
      }
    },
    close() {
      if (isClosed) return
      isClosed = true
      try {
        controller.close()
      } catch {
        /* already closed */
      }
    },
    closed() {
      return isClosed
    },
  }
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}
