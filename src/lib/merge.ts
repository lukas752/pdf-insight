import { MAX_KEY_POINTS, type Analysis } from './schema';

function normaliseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Removes empty and duplicate strings (case- and whitespace-insensitive), keeping first occurrences. */
function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normaliseKey(trimmed);
    if (trimmed.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function uniqueBy<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyOf(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function firstNonNull(values: readonly (string | null)[]): string | null {
  return values.find((value) => value !== null) ?? null;
}

/**
 * Deterministically merges per-chunk analyses of one document. Metadata comes from the first
 * chunk (title and date fall back to the first chunk that found them); lists are unioned and
 * de-duplicated in order of appearance. The caller supplies the final summary, which is
 * produced by a separate summarisation call over the per-chunk summaries.
 */
export function mergeAnalyses(parts: readonly Analysis[], summary: string): Analysis {
  const first = parts[0];
  if (first === undefined) {
    throw new Error('mergeAnalyses needs at least one partial result');
  }

  return {
    document: {
      ...first.document,
      title: firstNonNull(parts.map((part) => part.document.title)),
      date: firstNonNull(parts.map((part) => part.document.date)),
    },
    summary,
    keyPoints: uniqueStrings(parts.flatMap((part) => part.keyPoints)).slice(0, MAX_KEY_POINTS),
    entities: {
      organizations: uniqueStrings(parts.flatMap((part) => part.entities.organizations)),
      people: uniqueStrings(parts.flatMap((part) => part.entities.people)),
    },
    amounts: uniqueBy(
      parts.flatMap((part) => part.amounts),
      (amount) => `${amount.value}|${amount.currency}|${normaliseKey(amount.context)}`,
    ),
    dates: uniqueBy(
      parts.flatMap((part) => part.dates),
      (entry) => `${entry.date}|${normaliseKey(entry.context)}`,
    ),
    keywords: uniqueStrings(parts.flatMap((part) => part.keywords)),
  };
}
