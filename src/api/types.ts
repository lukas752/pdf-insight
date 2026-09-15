import { z } from 'zod';
import { analysisSchema } from '../lib/schema';

/**
 * A single request never carries more text than this; longer documents are chunked
 * client-side. The Worker enforces the same cap and rejects (never truncates) beyond it.
 */
export const MAX_REQUEST_TEXT_CHARS = 60_000;

export const analyzeRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  pages: z.number().int().positive(),
  /** `analyze` extracts data from document text; `summarize` condenses per-chunk summaries. */
  task: z.enum(['analyze', 'summarize']),
  text: z.string().min(1).max(MAX_REQUEST_TEXT_CHARS),
  /** ISO 639-1 code of the document, known after the first chunk; used by `summarize`. */
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/** Response of the `summarize` task – reuses the 3–5 sentence rule from the analysis schema. */
export const summaryResponseSchema = z.object({
  summary: analysisSchema.shape.summary,
});

export type SummaryResponse = z.infer<typeof summaryResponseSchema>;

/** Normalised error envelope returned by the Worker for every non-2xx response. */
export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'TEXT_TOO_LONG',
  'RATE_LIMITED',
  'FORBIDDEN_ORIGIN',
  'UPSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Client-side failure categories added on top of the Worker's codes. */
export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'INVALID_RESPONSE' | 'ABORTED';
