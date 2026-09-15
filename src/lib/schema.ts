import { z } from 'zod';

/**
 * Single source of truth for the analysis data contract.
 * Every TypeScript type in the app is derived from these schemas with `z.infer`.
 * The Cloudflare Worker builds its Anthropic tool schema from the same definitions.
 */

/** ISO 8601 calendar date, e.g. 2026-09-01. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 639-1 language code, e.g. pl, en. */
const ISO_LANGUAGE = /^[a-z]{2}$/;
/** ISO 4217 currency code, e.g. PLN, EUR. */
const ISO_CURRENCY = /^[A-Z]{3}$/;

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

export const MIN_SUMMARY_SENTENCES = 3;
export const MAX_SUMMARY_SENTENCES = 5;
export const MIN_KEY_POINTS = 3;
export const MAX_KEY_POINTS = 7;

/**
 * A sentence ends with `.`, `!` or `?` that is followed either by the end of the text
 * or by whitespace and the start of a new sentence (an uppercase letter, a digit or an
 * opening quote/bracket). This keeps abbreviations such as "sp. z o.o." or "np. tak"
 * and decimals such as "12.50" from being counted as sentence breaks.
 */
const SENTENCE_END = /[.!?]+(?=$|\s+[\p{Lu}\d„"«(['])/gu;

export function countSentences(text: string): number {
  const matches = text.trim().match(SENTENCE_END);
  return matches === null ? 0 : matches.length;
}

export const documentMetaSchema = z.object({
  fileName: z.string().min(1),
  pages: z.number().int().positive(),
  language: z.string().regex(ISO_LANGUAGE, { message: 'language must be an ISO 639-1 code' }),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().nullable(),
  date: z.string().regex(ISO_DATE, { message: 'date must be ISO 8601 (YYYY-MM-DD)' }).nullable(),
});

export const amountSchema = z.object({
  value: z.number(),
  currency: z.string().regex(ISO_CURRENCY, { message: 'currency must be an ISO 4217 code' }),
  context: z.string(),
});

export const dateEntrySchema = z.object({
  date: z.string().regex(ISO_DATE, { message: 'date must be ISO 8601 (YYYY-MM-DD)' }),
  context: z.string(),
});

export const analysisSchema = z.object({
  document: documentMetaSchema,
  summary: z
    .string()
    .min(1)
    .refine(
      (text) => {
        const sentences = countSentences(text);
        return sentences >= MIN_SUMMARY_SENTENCES && sentences <= MAX_SUMMARY_SENTENCES;
      },
      { message: `summary must have ${MIN_SUMMARY_SENTENCES}-${MAX_SUMMARY_SENTENCES} sentences` },
    ),
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  entities: z.object({
    organizations: z.array(z.string()),
    people: z.array(z.string()),
  }),
  amounts: z.array(amountSchema),
  dates: z.array(dateEntrySchema),
  keywords: z.array(z.string()),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type DateEntry = z.infer<typeof dateEntrySchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type DocumentType = Analysis['document']['type'];
