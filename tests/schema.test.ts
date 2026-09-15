import { describe, expect, it } from 'vitest';
import {
  analysisResponseSchema,
  analysisSchema,
  summaryResponseSchema,
  type Analysis,
} from '../src/lib/schema';

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

const threeSentences = [
  'Umowa dotyczy usług serwisowych IT zgodnie z art. 5 ust. 2 regulaminu.',
  'Stroną jest Przykład sp. z o.o. z siedzibą przy ul. Kwiatowej 12.',
  'Wynagrodzenie wynosi ok. 12 500 zł netto miesięcznie.',
];

/** Returns a deep copy with one nested field replaced, so each test mutates its own object. */
function withChange(change: (draft: Analysis) => void): unknown {
  const draft = structuredClone(validAnalysis);
  change(draft);
  return draft;
}

/** The Worker's response shape: the contract minus `summary`, plus `summarySentences`. */
function workerResponse(sentences: string[]): unknown {
  const { summary, ...rest } = structuredClone(validAnalysis);
  void summary;
  return { ...rest, summarySentences: sentences };
}

describe('analysisSchema (public contract)', () => {
  it('accepts a valid payload', () => {
    expect(analysisSchema.safeParse(validAnalysis).success).toBe(true);
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

  it('rejects an impossible calendar date even in ISO layout', () => {
    const payload = withChange((d) => {
      d.document.date = '2026-13-45';
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

  it('rejects an empty summary', () => {
    const payload = withChange((d) => {
      d.summary = '';
    });
    expect(analysisSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a non-integer page count', () => {
    const payload = withChange((d) => {
      d.document.pages = 2.5;
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
});

describe('analysisResponseSchema (Worker response → contract)', () => {
  it('accepts 3 sentences and joins them into `summary`', () => {
    const parsed = analysisResponseSchema.safeParse(workerResponse(threeSentences));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.summary).toBe(threeSentences.join(' '));
      expect('summarySentences' in parsed.data).toBe(false);
      expect(analysisSchema.safeParse(parsed.data).success).toBe(true);
    }
  });

  it('accepts 5 sentences', () => {
    const five = [...threeSentences, 'Umowa trwa 12 miesięcy.', 'Kary umowne są ograniczone.'];
    expect(analysisResponseSchema.safeParse(workerResponse(five)).success).toBe(true);
  });

  it('rejects 2 sentences', () => {
    expect(
      analysisResponseSchema.safeParse(workerResponse(threeSentences.slice(0, 2))).success,
    ).toBe(false);
  });

  it('rejects 6 sentences', () => {
    const six = [...threeSentences, 'Cztery.', 'Pięć.', 'Sześć.'];
    expect(analysisResponseSchema.safeParse(workerResponse(six)).success).toBe(false);
  });

  it('rejects a blank sentence', () => {
    expect(
      analysisResponseSchema.safeParse(workerResponse([...threeSentences.slice(0, 2), '   ']))
        .success,
    ).toBe(false);
  });

  it('rejects a plain `summary` string in place of the sentence list', () => {
    expect(analysisResponseSchema.safeParse(validAnalysis).success).toBe(false);
  });
});

describe('summaryResponseSchema', () => {
  it('returns the joined summary for 3–5 sentences', () => {
    const parsed = summaryResponseSchema.safeParse({ summarySentences: threeSentences });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe(threeSentences.join(' '));
    }
  });

  it('rejects 6 sentences', () => {
    const six = [...threeSentences, 'Cztery.', 'Pięć.', 'Sześć.'];
    expect(summaryResponseSchema.safeParse({ summarySentences: six }).success).toBe(false);
  });
});
