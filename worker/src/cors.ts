/** Exact-match allowlist parsed from a comma-separated env var. No wildcards, ever. */
export function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin.length > 0),
  );
}

/** Returns the request origin when it is allowlisted, otherwise null. */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigins: ReadonlySet<string>,
): string | null {
  if (requestOrigin === null) {
    return null;
  }
  return allowedOrigins.has(requestOrigin) ? requestOrigin : null;
}

/** CORS headers echoing exactly one allowlisted origin. */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
