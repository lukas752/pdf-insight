export interface ChunkOptions {
  /** Texts up to this length are analysed in a single request. */
  threshold: number;
  /** Maximum length of one chunk. */
  size: number;
  /** Characters repeated from the end of one chunk at the start of the next. */
  overlap: number;
}

/**
 * Roughly 10k tokens per chunk. Larger chunks mean fewer requests (rate limit, speed);
 * the model handles this size comfortably.
 */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  threshold: 40_000,
  size: 30_000,
  overlap: 1_000,
};

const WHITESPACE = /\s/;

/**
 * Splits long text into overlapping chunks. Splits prefer a paragraph break, then a line
 * break, then any whitespace inside the last 40% of the window, so a chunk never ends
 * mid-word unless the text has no whitespace at all.
 */
export function chunkText(text: string, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): string[] {
  if (text.length <= options.threshold) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= options.size) {
      chunks.push(text.slice(start).trim());
      break;
    }
    const end = findSplitPoint(text, start, start + options.size);
    chunks.push(text.slice(start, end).trim());
    start = nextStart(text, start, end, options.overlap);
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function findSplitPoint(text: string, start: number, end: number): number {
  const earliestAcceptable = start + Math.floor((end - start) * 0.6);
  for (const separator of ['\n\n', '\n', ' ']) {
    const index = text.lastIndexOf(separator, end);
    if (index > earliestAcceptable) {
      return index;
    }
  }
  for (let index = end; index > start; index -= 1) {
    if (WHITESPACE.test(text.charAt(index))) {
      return index;
    }
  }
  return end;
}

function nextStart(text: string, previousStart: number, end: number, overlap: number): number {
  let start = end - overlap;
  if (start <= previousStart) {
    return end;
  }
  // Move forward to a word boundary so the overlap never begins mid-word.
  while (start < end && !WHITESPACE.test(text.charAt(start - 1))) {
    start += 1;
  }
  return start;
}
