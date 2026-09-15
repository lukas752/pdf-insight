import { z } from 'zod';
import { analysisResponseSchema, summaryResponseSchema, type Analysis } from '../lib/schema';
import {
  API_ERROR_CODES,
  apiErrorEnvelopeSchema,
  type AnalyzeRequest,
  type ApiErrorCode,
  type ClientErrorCode,
} from './types';

const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Base URL of the Worker from the build-time env; null when the build was misconfigured. */
export function readApiUrl(): string | null {
  const raw = import.meta.env.VITE_API_URL?.trim() ?? '';
  return raw.length === 0 ? null : raw.replace(/\/+$/, '');
}

function isApiErrorCode(code: string): code is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code);
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 429) {
    return 'RATE_LIMITED';
  }
  if (status === 413) {
    return 'PAYLOAD_TOO_LARGE';
  }
  if (status === 403) {
    return 'FORBIDDEN_ORIGIN';
  }
  return status >= 500 ? 'UPSTREAM_ERROR' : 'BAD_REQUEST';
}

async function readErrorEnvelope(response: Response): Promise<ApiError> {
  const fallback = codeFromStatus(response.status);
  try {
    const parsed = apiErrorEnvelopeSchema.safeParse(await response.json());
    if (parsed.success) {
      const code = parsed.data.error.code;
      return new ApiError(
        isApiErrorCode(code) ? code : fallback,
        parsed.data.error.message,
        response.status,
      );
    }
  } catch {
    // Non-JSON error body – fall through to the status-based code.
  }
  return new ApiError(fallback, `HTTP ${response.status}`, response.status);
}

/** Sends one request. Network failures and non-2xx responses become typed ApiErrors. */
async function send(
  apiUrl: string,
  request: AnalyzeRequest,
  signal: AbortSignal | undefined,
): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
  } catch (error) {
    if (signal?.aborted === true) {
      throw new ApiError('ABORTED', 'Request aborted');
    }
    if (timeout.aborted) {
      throw new ApiError('UPSTREAM_TIMEOUT', 'Request timed out');
    }
    throw new ApiError('NETWORK', error instanceof Error ? error.message : 'Network error');
  }
  if (!response.ok) {
    throw await readErrorEnvelope(response);
  }
  return response;
}

type Attempt<T> = { ok: true; data: T } | { ok: false; detail: string; body: unknown };

/** One request whose body is parsed and validated; an invalid body is reported, not thrown. */
async function attempt<T>(
  apiUrl: string,
  request: AnalyzeRequest,
  schema: z.ZodType<T>,
  signal: AbortSignal | undefined,
): Promise<Attempt<T>> {
  const response = await send(apiUrl, request, signal);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, detail: 'Response body is not JSON', body: null };
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, detail: z.prettifyError(parsed.error), body };
}

/**
 * A response that fails validation is retried exactly once; a second failure surfaces as
 * INVALID_RESPONSE. HTTP and network errors are not retried here – the user gets a retry button.
 * `adjustRetry` may derive a more specific request for the retry from the rejected body.
 */
async function requestValidated<T>(
  apiUrl: string,
  request: AnalyzeRequest,
  schema: z.ZodType<T>,
  signal: AbortSignal | undefined,
  adjustRetry: (rejectedBody: unknown) => AnalyzeRequest = () => request,
): Promise<T> {
  const first = await attempt(apiUrl, request, schema, signal);
  if (first.ok) {
    return first.data;
  }
  const second = await attempt(apiUrl, adjustRetry(first.body), schema, signal);
  if (second.ok) {
    return second.data;
  }
  throw new ApiError('INVALID_RESPONSE', second.detail);
}

/** The language the model itself reported in a rejected response, if it looks like an ISO code. */
const detectedLanguageSchema = z.object({
  document: z.object({ language: z.string().regex(/^[a-z]{2}$/) }),
});

function detectedLanguage(body: unknown): string | undefined {
  const parsed = detectedLanguageSchema.safeParse(body);
  return parsed.success ? parsed.data.document.language : undefined;
}

export function analyzeText(
  apiUrl: string,
  request: Omit<AnalyzeRequest, 'task'>,
  signal?: AbortSignal,
): Promise<Analysis> {
  const analyzeRequest: AnalyzeRequest = { ...request, task: 'analyze' };
  // If the model detected the language but wrote in another one, the retry says which to use.
  return requestValidated(apiUrl, analyzeRequest, analysisResponseSchema, signal, (rejected) => {
    const language = detectedLanguage(rejected);
    return language === undefined ? analyzeRequest : { ...analyzeRequest, language };
  });
}

export function summarizeText(
  apiUrl: string,
  request: Omit<AnalyzeRequest, 'task'>,
  signal?: AbortSignal,
): Promise<string> {
  return requestValidated(apiUrl, { ...request, task: 'summarize' }, summaryResponseSchema, signal);
}
