import { describe, expect, it } from 'vitest';
import { mergeAnalyses } from '../src/lib/merge';
import { analysisSchema, type Analysis } from '../src/lib/schema';

type PartialInput = Omit<Partial<Analysis>, 'document'> & {
  document?: Partial<Analysis['document']>;
};

function partial({ document, ...rest }: PartialInput): Analysis {
  return {
    document: {
      fileName: 'umowa.pdf',
      pages: 60,
      language: 'pl',
      type: 'umowa',
      title: null,
      date: null,
      ...document,
    },
    summary: 'Zdanie pierwsze. Zdanie drugie. Zdanie trzecie.',
    keyPoints: ['Punkt A', 'Punkt B', 'Punkt C'],
    entities: { organizations: [], people: [] },
    amounts: [],
    dates: [],
    keywords: [],
    ...rest,
  };
}

const finalSummary =
  'Dokument to umowa serwisowa. Obowiązuje 12 miesięcy. Wynagrodzenie jest ryczałtowe.';

describe('mergeAnalyses', () => {
  it('takes document metadata from the first chunk and the supplied summary', () => {
    const merged = mergeAnalyses(
      [
        partial({ document: { title: 'Umowa serwisowa', date: '2026-09-01', type: 'umowa' } }),
        partial({ document: { title: 'Załącznik', date: '2026-10-01', type: 'inne', pages: 60 } }),
      ],
      finalSummary,
    );
    expect(merged.document.title).toBe('Umowa serwisowa');
    expect(merged.document.date).toBe('2026-09-01');
    expect(merged.document.type).toBe('umowa');
    expect(merged.summary).toBe(finalSummary);
  });

  it('falls back to a later chunk for title and date when the first chunk has none', () => {
    const merged = mergeAnalyses(
      [partial({}), partial({ document: { title: 'Raport roczny', date: '2026-01-31' } })],
      finalSummary,
    );
    expect(merged.document.title).toBe('Raport roczny');
    expect(merged.document.date).toBe('2026-01-31');
  });

  it('unions and de-duplicates organizations, people and keywords case-insensitively', () => {
    const merged = mergeAnalyses(
      [
        partial({
          entities: { organizations: ['Przykład sp. z o.o.', 'ACME'], people: ['Jan Kowalski'] },
          keywords: ['serwis', 'SLA'],
        }),
        partial({
          entities: {
            organizations: ['przykład sp. z o.o.', 'Beta S.A.'],
            people: ['Anna Nowak', 'jan kowalski'],
          },
          keywords: ['sla', 'umowa'],
        }),
      ],
      finalSummary,
    );
    expect(merged.entities.organizations).toEqual(['Przykład sp. z o.o.', 'ACME', 'Beta S.A.']);
    expect(merged.entities.people).toEqual(['Jan Kowalski', 'Anna Nowak']);
    expect(merged.keywords).toEqual(['serwis', 'SLA', 'umowa']);
  });

  it('caps key points at 7 keeping the earliest ones', () => {
    const merged = mergeAnalyses(
      [
        partial({ keyPoints: ['1', '2', '3', '4', '5'] }),
        partial({ keyPoints: ['5', '6', '7', '8', '9'] }),
      ],
      finalSummary,
    );
    expect(merged.keyPoints).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('de-duplicates amounts on value + currency + context and dates on date + context', () => {
    const merged = mergeAnalyses(
      [
        partial({
          amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
          dates: [{ date: '2026-10-01', context: 'termin płatności' }],
        }),
        partial({
          amounts: [
            { value: 12500, currency: 'PLN', context: 'Wynagrodzenie' },
            { value: 12500, currency: 'PLN', context: 'kara umowna' },
            { value: 12500, currency: 'EUR', context: 'wynagrodzenie' },
          ],
          dates: [
            { date: '2026-10-01', context: 'termin płatności' },
            { date: '2026-10-01', context: 'początek umowy' },
          ],
        }),
      ],
      finalSummary,
    );
    expect(merged.amounts).toHaveLength(3);
    expect(merged.dates).toHaveLength(2);
  });

  it('produces a result that still satisfies the analysis schema', () => {
    const merged = mergeAnalyses(
      [partial({}), partial({ keyPoints: ['X', 'Y', 'Z'] })],
      finalSummary,
    );
    expect(analysisSchema.safeParse(merged).success).toBe(true);
  });

  it('is deterministic', () => {
    const parts = [partial({ keywords: ['b', 'a'] }), partial({ keywords: ['c', 'a'] })];
    expect(mergeAnalyses(parts, finalSummary)).toEqual(mergeAnalyses(parts, finalSummary));
  });

  it('throws when given no partial results', () => {
    expect(() => mergeAnalyses([], finalSummary)).toThrow();
  });
});
