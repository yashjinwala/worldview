// Zod schemas for the structured Haiku roles (Reader, Generator-map, Profiler,
// Safety, Sharpen). Handed to the SDK via zodOutputFormat so real-mode responses are
// schema-enforced (TDD §7) — the SDK strips API-unsupported constraints and validates
// the full schema client-side. Nullable (not optional) fields keep the JSON-schema
// shape strict. Artifact-fill reuses the per-template schemas in src/templates/schemas.ts.

// Authored with the zod v4 API (the subpath zod 3.25 ships) because the SDK's
// zodOutputFormat runs zod/v4's toJSONSchema. These are new schemas, not the
// frozen-tested template schemas (which stay on the zod v3 API).
import { z } from 'zod/v4'

export const ReaderSchema = z.object({
  appetite: z.enum(['leaning_in', 'neutral', 'restless']),
  proximityToClose: z.number(),
  justClosed: z.boolean(),
  closedLoopId: z.string().nullable(),
  conversationNodeId: z.string().nullable(),
  positionShift: z.string().nullable(),
  inferredPosition: z.string().nullable(),
  synthesisAnswer: z.string().nullable(),
  evidence: z.string(),
})

export const GeneratorMapSchema = z.object({
  nodes: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      hookQuestion: z.string(),
    })
  ),
})

export const ProfilerSchema = z.object({
  data: z.object({
    modesThatLand: z.object({
      explain: z.number(),
      challenge: z.number(),
      provoke: z.number(),
      socratic: z.number(),
      support: z.number(),
    }),
    pacing: z.enum(['fast', 'moderate', 'deliberate']),
    styleNotes: z.array(z.string()),
    clickPatterns: z.array(z.string()),
    interests: z.array(z.string()),
    vocabularyLevel: z.enum(['plain', 'comfortable', 'technical']),
  }),
  resumeSummary: z.string(),
})

export const SafetySchema = z.object({
  flag: z.boolean(),
  category: z.enum(['fabrication', 'advice', 'distress']).nullable(),
  note: z.string().nullable(),
})

export const SharpenSchema = z.object({
  sharpened: z.string(),
})
