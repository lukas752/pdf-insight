import { analyzeText, ApiError, summarizeText } from '../api/client';
import { chunkText } from './chunk';
import { mapWithConcurrency } from './concurrency';
import { DocumentTooLongError } from './errors';
import { mergeAnalyses, mostCommon } from './merge';
import { analysisSchema, type Analysis } from './schema';

/** Roughly 100 dense pages. Beyond this a document would need more requests than the rate limit allows. */
export const MAX_DOCUMENT_CHARS = 300_000;
const CHUNK_CONCURRENCY = 4;
/** Matches the Worker's request schema. */
const MAX_FILE_NAME_CHARS = 255;

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
  // pdf.js is large, so it is loaded on first use instead of with the app shell.
  const { extractText } = await import('./pdf');
  const { text, pages } = await extractText(
    file,
    (page, total) => onProgress({ phase: 'extracting', page, total }),
    signal,
  );
  if (text.length > MAX_DOCUMENT_CHARS) {
    throw new DocumentTooLongError(text.length);
  }

  const chunks = chunkText(text);
  const base = { fileName: file.name.slice(0, MAX_FILE_NAME_CHARS), pages };
  let done = 0;
  onProgress({ phase: 'analyzing', done, total: chunks.length });

  // The first failing chunk stops the rest, so no quota is spent on a result that is discarded.
  const chunkAbort = new AbortController();
  const chunkSignal =
    signal === undefined ? chunkAbort.signal : AbortSignal.any([signal, chunkAbort.signal]);

  const partials = await mapWithConcurrency(
    chunks,
    CHUNK_CONCURRENCY,
    async (chunk) => {
      try {
        const result = await analyzeText(apiUrl, { ...base, text: chunk }, chunkSignal);
        done += 1;
        onProgress({ phase: 'analyzing', done, total: chunks.length });
        return result;
      } catch (error) {
        chunkAbort.abort();
        throw error;
      }
    },
    chunkSignal,
  );

  const first = partials[0];
  if (first === undefined) {
    throw new ApiError('INVALID_RESPONSE', 'No analysis produced');
  }

  let summary = first.summary;
  if (partials.length > 1) {
    onProgress({ phase: 'summarizing' });
    summary = await summarizeText(
      apiUrl,
      {
        ...base,
        language: mostCommon(partials.map((partial) => partial.document.language)),
        text: partials.map((partial) => partial.summary).join('\n\n'),
      },
      signal,
    );
  }

  // Merging de-duplicates lists (also for a single chunk); the result is re-validated so the UI
  // never renders anything outside the contract.
  const merged = analysisSchema.safeParse(mergeAnalyses(partials, summary));
  if (!merged.success) {
    throw new ApiError('INVALID_RESPONSE', 'Merged result failed validation');
  }
  return merged.data;
}
