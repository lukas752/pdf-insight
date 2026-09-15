import { describe, expect, it } from 'vitest';
import { analysisSchema, countSentences, type Analysis } from '../src/lib/schema';

const validAnalysis: Analysis = {
  document: {
    fileName: 'umowa.pdf',
    pages: 4,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa serwisowa',
    date: '2026-09-01',
  },
  summary:
    'Umowa określa zasady świadczenia usług serwisowych. Zleceniobiorcą jest Przykład sp. z o.o. z siedzibą w Warszawie. Wynagrodzenie wynosi 12.500 zł miesięcznie.',
  keyPoints: ['Okres umowy 12 mies.', 'Płatność do 10. dnia miesiąca', 'SLA 99,5%'],
  entities: {
    organizations: ['Przykład sp. z o.o.'],
    people: [],
  },
  amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
  dates: [{ date: '2026-10-01', context: 'termin płatności' }],
  keywords: ['serwis', 'SLA'],
};

/** Returns a deep copy with one nested field replaced, so each test mutates its own object. */
function withChange(change: (draft: Analysis) => void): unknown {
  const draft = structuredClone(validAnalysis);
  change(draft);
  return draft;
}

describe('analysisSchema', () => {
  it('accepts a valid payload', () => {
    const result = analysisSchema.safeParse(validAnalysis);
    expect(result.success).toBe(true);
  });

  it('rejects a document type outside the enum', () => {
    const payload = withChange((d) => {
      (d.document as { type: string }).type = 'paragon';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a non-ISO document date', () => {
    const payload = withChange((d) => {
      d.document.date = '01.09.2026';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a non-ISO date entry', () => {
    const payload = withChange((d) => {
      d.dates = [{ date: '1 października 2026', context: 'termin' }];
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects fewer than 3 key points', () => {
    const payload = withChange((d) => {
      d.keyPoints = ['jeden', 'dwa'];
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects more than 7 key points', () => {
    const payload = withChange((d) => {
      d.keyPoints = ['1', '2', '3', '4', '5', '6', '7', '8'];
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a 3-letter language code', () => {
    const payload = withChange((d) => {
      d.document.language = 'pol';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a 2-letter currency code', () => {
    const payload = withChange((d) => {
      d.amounts = [{ value: 10, currency: 'PL', context: 'kwota' }];
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a payload without entities', () => {
    const payload = withChange((d) => {
      delete (d as Partial<Analysis>).entities;
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts null title and null date', () => {
    const payload = withChange((d) => {
      d.document.title = null;
      d.document.date = null;
    });
    expect(analysisSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts empty arrays for entities, amounts, dates and keywords', () => {
    const payload = withChange((d) => {
      d.entities = { organizations: [], people: [] };
      d.amounts = [];
      d.dates = [];
      d.keywords = [];
    });
    expect(analysisSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects a summary with 2 sentences', () => {
    const payload = withChange((d) => {
      d.summary = 'Pierwsze zdanie. Drugie zdanie.';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a summary with 6 sentences', () => {
    const payload = withChange((d) => {
      d.summary = 'Raz. Dwa. Trzy. Cztery. Pięć. Sześć.';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a non-integer page count', () => {
    const payload = withChange((d) => {
      d.document.pages = 2.5;
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });
});

describe('countSentences', () => {
  it('counts plain sentences ended with . ! and ?', () => {
    expect(countSentences('Pierwsze. Drugie! Trzecie?')).toBe(3);
  });

  it('does not count a decimal point as a sentence break', () => {
    expect(countSentences('Kwota wynosi 12.50 zł. Płatność w terminie 14 dni.')).toBe(2);
  });

  it('does not count "sp. z o.o." as sentence breaks', () => {
    expect(countSentences('Stroną jest Przykład sp. z o.o. z Warszawy. Umowa trwa rok.')).toBe(2);
  });

  it('does not count lowercase abbreviations such as "np." or "tj."', () => {
    expect(countSentences('Dokument zawiera załączniki, np. cennik. Obowiązuje od jutra.')).toBe(2);
  });

  it('counts a sentence that starts with a digit or a Polish capital letter', () => {
    expect(
      countSentences('Umowa trwa rok. 12 rat płatnych co miesiąc. Świadczenie jest stałe.'),
    ).toBe(3);
  });

  it('treats an ellipsis as a single sentence end', () => {
    expect(countSentences('To jeszcze nie koniec... Ale już blisko.')).toBe(2);
  });

  it('returns 0 for text without terminal punctuation', () => {
    expect(countSentences('Brak kropki na końcu')).toBe(0);
  });
});
