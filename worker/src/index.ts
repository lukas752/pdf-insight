import Anthropic from '@anthropic-ai/sdk';
import { corsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from './cors';
import { log } from './log';
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_TOOL_INPUT_SCHEMA,
  ANALYSIS_TOOL_NAME,
  buildAnalysisUserMessage,
  buildSummaryUserMessage,
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_TOOL_INPUT_SCHEMA,
  SUMMARY_TOOL_NAME,
} from './prompt';
import { checkRateLimit } from './ratelimit';
import { analyzeRequestSchema, MAX_TEXT_CHARS, type AnalyzeRequest } from './schema';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT: KVNamespace;
}

type ErrorCode =
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'FORBIDDEN_ORIGIN'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'TEXT_TOO_LONG'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL';

const MAX_BODY_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 8_192;
const DEFAULT_RATE_LIMIT_MAX = 20;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 600;

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly extraHeaders: Record<string, string> = {},
  ) {
    super(message);
  }
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function errorResponse(error: HttpError, headers: Record<string, string>): Response {
  return jsonResponse({ error: { code: error.code, message: error.message } }, error.status, {
    ...headers,
    ...error.extraHeaders,
  });
}

function positiveIntFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Reads the body while counting bytes, so a lying Content-Length cannot bypass the cap. */
async function readBodyWithLimit(request: Request, limit: number): Promise<string> {
  const declared = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (declared > limit) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${limit} bytes`);
  }
  if (request.body === null) {
    throw new HttpError(400, 'BAD_REQUEST', 'Missing request body');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${limit} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function parseAnalyzeRequest(request: Request): Promise<AnalyzeRequest> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'BAD_REQUEST', 'Content-Type must be application/json');
  }

  const raw = await readBodyWithLimit(request, MAX_BODY_BYTES);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Body is not valid JSON');
  }

  // Report the text cap with its own code so the frontend can explain it precisely.
  if (isRecord(body) && typeof body.text === 'string' && body.text.length > MAX_TEXT_CHARS) {
    throw new HttpError(413, 'TEXT_TOO_LONG', `text exceeds ${MAX_TEXT_CHARS} characters`);
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body does not match the expected shape');
  }
  return parsed.data;
}

/** Calls Claude with a forced tool and returns the tool input as untyped JSON. */
async function callModel(env: Env, payload: AnalyzeRequest): Promise<unknown> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  const summarize = payload.task === 'summarize';
  const toolName = summarize ? SUMMARY_TOOL_NAME : ANALYSIS_TOOL_NAME;

  try {
    const response = await client.messages.create(
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: summarize ? SUMMARY_SYSTEM_PROMPT : ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: summarize
              ? buildSummaryUserMessage(payload.text, payload.language ?? 'pl')
              : buildAnalysisUserMessage(payload.text),
          },
        ],
        tools: [
          {
            name: toolName,
            description: summarize
              ? 'Emit the final summary of the document.'
              : 'Emit the structured analysis of the document.',
            strict: true,
            input_schema: summarize ? SUMMARY_TOOL_INPUT_SCHEMA : ANALYSIS_TOOL_INPUT_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
      },
      { signal: controller.signal },
    );

    const toolUse = response.content.find(
      (block) => block.type === 'tool_use' && block.name === toolName,
    );
    if (toolUse === undefined || toolUse.type !== 'tool_use') {
      throw new HttpError(502, 'UPSTREAM_ERROR', 'Model returned no structured output');
    }
    return toolUse.input;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new HttpError(504, 'UPSTREAM_TIMEOUT', 'AI request timed out');
    }
    if (error instanceof Anthropic.APIError) {
      // Never forward the upstream body – it may contain request details.
      throw new HttpError(
        502,
        'UPSTREAM_ERROR',
        `AI service error (status ${error.status ?? 'n/a'})`,
      );
    }
    throw new HttpError(502, 'UPSTREAM_ERROR', 'AI service unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/** The model never has to copy metadata the Worker already knows for certain. */
function withDocumentMeta(result: unknown, payload: AnalyzeRequest): unknown {
  if (!isRecord(result) || !isRecord(result.document)) {
    return result;
  }
  return {
    ...result,
    document: { ...result.document, fileName: payload.fileName, pages: payload.pages },
  };
}

async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const origin = resolveAllowedOrigin(request.headers.get('Origin'), allowedOrigins);
  if (origin === null) {
    // Deliberately no CORS headers: the browser will block the response.
    throw new HttpError(403, 'FORBIDDEN_ORIGIN', 'Origin not allowed');
  }
  const headers = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST', {
      ...headers,
      Allow: 'POST, OPTIONS',
    });
  }

  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limit = await checkRateLimit(
    env.RATE_LIMIT,
    clientIp,
    positiveIntFromEnv(env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    positiveIntFromEnv(env.RATE_LIMIT_WINDOW_SECONDS, DEFAULT_RATE_LIMIT_WINDOW_SECONDS),
  );
  if (!limit.allowed) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many requests', {
      ...headers,
      'Retry-After': String(limit.retryAfterSeconds),
    });
  }

  const payload = await parseAnalyzeRequest(request);
  const result = await callModel(env, payload);
  const body = payload.task === 'analyze' ? withDocumentMeta(result, payload) : result;
  return jsonResponse(body, 200, headers);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    let response: Response;
    let code: string | undefined;

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        response = jsonResponse({ status: 'ok' }, 200, {});
      } else if (url.pathname === '/api/analyze') {
        response = await handleAnalyze(request, env);
      } else {
        throw new HttpError(404, 'NOT_FOUND', 'Not found');
      }
    } catch (error) {
      const httpError =
        error instanceof HttpError ? error : new HttpError(500, 'INTERNAL', 'Internal error');
      code = httpError.code;
      // Only errors raised after the origin check carry CORS headers (inside extraHeaders).
      response = errorResponse(httpError, {});
    }

    log({
      method: request.method,
      path: url.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...(code === undefined ? {} : { code }),
    });
    return response;
  },
} satisfies ExportedHandler<Env>;
