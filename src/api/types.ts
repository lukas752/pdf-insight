import { z } from 'zod';

/**
 * A single request never carries more text than this; longer documents are chunked
 * client-side. The Worker enforces the same cap and rejects (never truncates) beyond it.
 */
export const MAX_REQUEST_TEXT_CHARS = 60_000;

/** Body of POST /api/analyze. The Worker validates it with its own Zod schema. */
export interface AnalyzeRequest {
  fileName: string;
  pages: number;
  /** `analyze` extracts data from document text; `summarize` condenses per-chunk summaries. */
  task: 'analyze' | 'summarize';
  text: string;
  /** ISO 639-1 code of the document, known after the first chunk; used by `summarize`. */
  language?: string;
}

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
