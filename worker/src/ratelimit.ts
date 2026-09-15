export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the current window ends; meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in KV: one key per client per window. KV is eventually consistent, so
 * the count is approximate under bursts – good enough to protect the API budget of a demo.
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

  const current = Number.parseInt((await kv.get(key)) ?? '0', 10);
  const retryAfterSeconds = Math.max(1, windowEnd - nowSeconds);
  if (current >= maxRequests) {
    return { allowed: false, retryAfterSeconds };
  }

  // KV requires a TTL of at least 60 s; the key only has to outlive its window.
  await kv.put(key, String(current + 1), { expirationTtl: Math.max(60, windowSeconds + 60) });
  return { allowed: true, retryAfterSeconds };
}
