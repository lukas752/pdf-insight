import { MAX_KEY_POINTS, MAX_KEYWORDS, MIN_KEY_POINTS, type Analysis } from './schema';

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

/** The most frequent value; ties go to the value that appeared first. Deterministic. */
export function mostCommon<T extends string>(values: readonly [T, ...T[]] | readonly T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: T | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  if (best === undefined) {
    throw new Error('mostCommon needs at least one value');
  }
  return best;
}

/**
 * Deterministically merges per-chunk analyses of one document. `type` and `language` are decided
 * by majority vote (a cover page alone must not label the whole document), `title` and `date`
 * come from the first chunk that found them, lists are unioned and de-duplicated in order of
 * appearance. The caller supplies the final summary.
 */
export function mergeAnalyses(parts: readonly Analysis[], summary: string): Analysis {
  const first = parts[0];
  if (first === undefined) {
    throw new Error('mergeAnalyses needs at least one partial result');
  }

  const keyPoints = uniqueStrings(parts.flatMap((part) => part.keyPoints));

  return {
    document: {
      ...first.document,
      type: mostCommon(parts.map((part) => part.document.type)),
      language: mostCommon(parts.map((part) => part.document.language)),
      title: firstNonNull(parts.map((part) => part.document.title)),
      date: firstNonNull(parts.map((part) => part.document.date)),
    },
    summary,
    // De-duplication can only shrink the list; never let it drop below the contract minimum.
    keyPoints: (keyPoints.length >= MIN_KEY_POINTS ? keyPoints : first.keyPoints).slice(
      0,
      MAX_KEY_POINTS,
    ),
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
    keywords: uniqueStrings(parts.flatMap((part) => part.keywords)).slice(0, MAX_KEYWORDS),
  };
}
