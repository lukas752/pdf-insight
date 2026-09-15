import { analyzeText, ApiError, summarizeText } from '../api/client';
import { chunkText } from './chunk';
import { mapWithConcurrency } from './concurrency';
import { mergeAnalyses } from './merge';
import { DocumentTooLongError } from './errors';
import { analysisSchema, type Analysis } from './schema';

/** Roughly 100 dense pages. Beyond this a document would need more requests than the rate limit allows. */
export const MAX_DOCUMENT_CHARS = 300_000;
const CHUNK_CONCURRENCY = 4;

export type AnalysisProgress =
  | { phase: 'extracting'; page: number; total: number }
  | { phase: 'analyzing'; done: number; total: number }
  | { phase: 'summarizing' };

/**
 * Full pipeline for one file: extract text in the browser, split long text into chunks,
 * analyse the chunks (a few in parallel), then merge and write one final summary.
 */
export async function analyzeFile(
  file: File,
  apiUrl: string,
  onProgress: (progress: AnalysisProgress) => void,
  signal?: AbortSignal,
): Promise<Analysis> {
  // pdf.js is ~1 MB, so it is loaded on first use instead of with the app shell.
  const { extractText } = await import('./pdf');
  const { text, pages } = await extractText(file, (page, total) => {
    onProgress({ phase: 'extracting', page, total });
  });
  if (text.length > MAX_DOCUMENT_CHARS) {
    throw new DocumentTooLongError(text.length);
  }

  const chunks = chunkText(text);
  const base = { fileName: file.name, pages };
  let done = 0;
  onProgress({ phase: 'analyzing', done, total: chunks.length });

  const partials = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    const result = await analyzeText(apiUrl, { ...base, text: chunk }, signal);
    done += 1;
    onProgress({ phase: 'analyzing', done, total: chunks.length });
    return result;
  });

  const first = partials[0];
  if (first === undefined) {
    throw new ApiError('INVALID_RESPONSE', 'No analysis produced');
  }
  if (partials.length === 1) {
    return first;
  }

  onProgress({ phase: 'summarizing' });
  const summary = await summarizeText(
    apiUrl,
    {
      ...base,
      language: first.document.language,
      text: partials.map((partial) => partial.summary).join('\n\n'),
    },
    signal,
  );

  // The merged object is re-validated so the UI never renders anything outside the contract.
  const merged = analysisSchema.safeParse(mergeAnalyses(partials, summary));
  if (!merged.success) {
    throw new ApiError('INVALID_RESPONSE', 'Merged result failed validation');
  }
  return merged.data;
}
