import { z } from 'zod';

/**
 * Single source of truth for the analysis data contract.
 * Every TypeScript type in the app is derived from these schemas with `z.infer`.
 */

/** ISO 639-1 language code, e.g. pl, en. */
const ISO_LANGUAGE = /^[a-z]{2}$/;
/** ISO 4217 currency code, e.g. PLN, EUR. */
const ISO_CURRENCY = /^[A-Z]{3}$/;

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

export const MIN_SUMMARY_SENTENCES = 3;
export const MAX_SUMMARY_SENTENCES = 5;
export const MIN_KEY_POINTS = 3;
export const MAX_KEY_POINTS = 7;
export const MAX_KEYWORDS = 10;

/** Calendar date in ISO 8601 (YYYY-MM-DD); rejects impossible dates such as 2026-13-45. */
const isoDate = z.iso.date();

export const documentMetaSchema = z.object({
  fileName: z.string().min(1),
  pages: z.number().int().positive(),
  language: z.string().regex(ISO_LANGUAGE, { message: 'language must be an ISO 639-1 code' }),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().nullable(),
  date: isoDate.nullable(),
});

export const amountSchema = z.object({
  value: z.number(),
  currency: z.string().regex(ISO_CURRENCY, { message: 'currency must be an ISO 4217 code' }),
  context: z.string(),
});

export const dateEntrySchema = z.object({
  date: isoDate,
  context: z.string(),
});

/**
 * The 3–5 sentence rule is enforced structurally: the model returns the summary as a list of
 * sentences, so the count is exact. Counting full stops in free text is unreliable for Polish
 * ("art. 5 ust. 2", "ok. 500 zł", "sp. z o.o.") and would reject correct summaries.
 */
export const summarySentencesSchema = z
  .array(z.string().trim().min(1))
  .min(MIN_SUMMARY_SENTENCES)
  .max(MAX_SUMMARY_SENTENCES);

export function joinSentences(sentences: readonly string[]): string {
  return sentences.join(' ');
}

const analysisFieldsSchema = z.object({
  document: documentMetaSchema,
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  entities: z.object({
    organizations: z.array(z.string()),
    people: z.array(z.string()),
  }),
  amounts: z.array(amountSchema),
  dates: z.array(dateEntrySchema),
  keywords: z.array(z.string()),
});

/** The public contract: what the app renders, stores in history and exports as JSON. */
export const analysisSchema = analysisFieldsSchema.extend({
  summary: z.string().min(1),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type DateEntry = z.infer<typeof dateEntrySchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type DocumentType = Analysis['document']['type'];

/** What the Worker returns for the `analyze` task, converted into the public contract. */
export const analysisResponseSchema = analysisFieldsSchema
  .extend({ summarySentences: summarySentencesSchema })
  .transform(({ summarySentences, ...rest }): Analysis => ({
    ...rest,
    summary: joinSentences(summarySentences),
  }));

/** What the Worker returns for the `summarize` task, converted into one summary string. */
export const summaryResponseSchema = z
  .object({ summarySentences: summarySentencesSchema })
  .transform((response) => joinSentences(response.summarySentences));
