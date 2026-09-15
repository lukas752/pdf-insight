import { log } from './log';

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the current window ends; meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in KV: one key per client per window. KV is eventually consistent and
 * allows about one write per second per key, so under bursts the count is approximate. When the
 * storage itself fails the limiter fails open – a demo that answers is better than one that
 * returns "Internal error" because of a storage hiccup – and the failure is logged.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  clientKey: string,
  maxRequests: number,
  windowSeconds: number,
  nowMs: number = Date.now(),
): Promise<RateLimitDecision> {
  const nowSeconds = Math.floor(nowMs / 1000);
  const windowId = Math.floor(nowSeconds / windowSeconds);
  const windowEnd = (windowId + 1) * windowSeconds;
  const key = `rl:${clientKey}:${windowId}`;
  const retryAfterSeconds = Math.max(1, windowEnd - nowSeconds);

  try {
    const current = Number.parseInt((await kv.get(key)) ?? '0', 10);
    if (current >= maxRequests) {
      return { allowed: false, retryAfterSeconds };
    }
    // KV requires a TTL of at least 60 s; the key only has to outlive its window.
    await kv.put(key, String(current + 1), { expirationTtl: Math.max(60, windowSeconds + 60) });
  } catch (error) {
    log({
      event: 'rate_limit_storage_error',
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return { allowed: true, retryAfterSeconds };
}
