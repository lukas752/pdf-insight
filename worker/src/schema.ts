import { z } from 'zod';

/** Mirrors MAX_REQUEST_TEXT_CHARS on the frontend. Longer text is rejected, never truncated. */
export const MAX_TEXT_CHARS = 60_000;

export const analyzeRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  pages: z.number().int().positive(),
  task: z.enum(['analyze', 'summarize']),
  text: z.string().min(1).max(MAX_TEXT_CHARS),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
