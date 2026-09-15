import { z } from 'zod';
import { analysisSchema, type Analysis } from '../lib/schema';
import {
  API_ERROR_CODES,
  apiErrorEnvelopeSchema,
  summaryResponseSchema,
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

async function postAnalyze(
  apiUrl: string,
  request: AnalyzeRequest,
  signal: AbortSignal | undefined,
): Promise<unknown> {
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
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'Response body is not JSON', response.status);
  }
}

/**
 * Posts a request and validates the body against `schema`. A response that fails validation
 * is retried exactly once; a second failure surfaces as INVALID_RESPONSE.
 */
async function requestValidated<T>(
  apiUrl: string,
  request: AnalyzeRequest,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const first = schema.safeParse(await postAnalyze(apiUrl, request, signal));
  if (first.success) {
    return first.data;
  }
  const second = schema.safeParse(await postAnalyze(apiUrl, request, signal));
  if (second.success) {
    return second.data;
  }
  throw new ApiError('INVALID_RESPONSE', z.prettifyError(second.error));
}

export function analyzeText(
  apiUrl: string,
  request: Omit<AnalyzeRequest, 'task'>,
  signal?: AbortSignal,
): Promise<Analysis> {
  return requestValidated(apiUrl, { ...request, task: 'analyze' }, analysisSchema, signal);
}

export async function summarizeText(
  apiUrl: string,
  request: Omit<AnalyzeRequest, 'task'>,
  signal?: AbortSignal,
): Promise<string> {
  const response = await requestValidated(
    apiUrl,
    { ...request, task: 'summarize' },
    summaryResponseSchema,
    signal,
  );
  return response.summary;
}
