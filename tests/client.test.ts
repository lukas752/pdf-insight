import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeText, ApiError, summarizeText } from '../src/api/client';

const validBody = {
  document: {
    fileName: 'umowa.pdf',
    pages: 2,
    language: 'pl',
    type: 'umowa',
    title: null,
    date: null,
  },
  summarySentences: ['Zdanie pierwsze.', 'Zdanie drugie.', 'Zdanie trzecie.'],
  keyPoints: ['a', 'b', 'c'],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
};

const invalidBody = { ...validBody, summarySentences: ['Za mało.'] };
const request = { fileName: 'umowa.pdf', pages: 2, text: 'Treść umowy.' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn(() => {
    const next = responses.shift();
    if (next === undefined) {
      return Promise.reject(new Error('unexpected extra request'));
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analyzeText', () => {
  it('returns the validated analysis after one successful request', async () => {
    const fetchMock = mockFetch(json(validBody));
    const result = await analyzeText('https://api.test', request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('Zdanie pierwsze. Zdanie drugie. Zdanie trzecie.');
  });

  it('posts the task and payload as JSON to /api/analyze', async () => {
    const fetchMock = mockFetch(json(validBody));
    await analyzeText('https://api.test', request);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/analyze');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ...request, task: 'analyze' });
  });

  it('retries exactly once when the first response fails validation', async () => {
    const fetchMock = mockFetch(json(invalidBody), json(validBody));
    const result = await analyzeText('https://api.test', request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.keyPoints).toEqual(['a', 'b', 'c']);
  });

  it('gives up with INVALID_RESPONSE after the second invalid response', async () => {
    const fetchMock = mockFetch(json(invalidBody), json(invalidBody), json(validBody));
    await expect(analyzeText('https://api.test', request)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries with an explicit language hint when the model wrote in the wrong language', async () => {
    const translated = {
      ...validBody,
      document: { ...validBody.document, language: 'en' },
      summarySentences: [
        'Umowa serwisowa została zawarta pierwszego września w Warszawie pomiędzy stronami.',
        'Wykonawca świadczy usługi monitoringu oraz konserwacji infrastruktury informatycznej.',
        'Wynagrodzenie ryczałtowe wynosi dwanaście tysięcy pięćset złotych netto miesięcznie.',
      ],
    };
    const englishBody = {
      ...validBody,
      document: { ...validBody.document, language: 'en' },
      summarySentences: ['First sentence.', 'Second sentence.', 'Third sentence.'],
    };
    const fetchMock = mockFetch(json(translated), json(englishBody));
    const result = await analyzeText('https://api.test', request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(secondInit.body as string)).toMatchObject({ language: 'en' });
    expect(result.summary).toBe('First sentence. Second sentence. Third sentence.');
  });

  it('treats a non-JSON body as an invalid response and retries once', async () => {
    const fetchMock = mockFetch(new Response('<html>', { status: 200 }), json(validBody));
    await analyzeText('https://api.test', request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry HTTP errors and maps the Worker error code', async () => {
    const fetchMock = mockFetch(
      json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429),
      json(validBody),
    );
    const error = await analyzeText('https://api.test', request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a status-based code when the error body is not an envelope', async () => {
    mockFetch(new Response('oops', { status: 503 }));
    await expect(analyzeText('https://api.test', request)).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });

  it('maps a network failure to NETWORK', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(analyzeText('https://api.test', request)).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('reports ABORTED when the caller aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        controller.abort();
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }),
    );
    await expect(analyzeText('https://api.test', request, controller.signal)).rejects.toMatchObject(
      {
        code: 'ABORTED',
      },
    );
  });
});

describe('summarizeText', () => {
  it('returns the joined sentences', async () => {
    mockFetch(json({ summarySentences: ['Raz.', 'Dwa.', 'Trzy.'] }));
    await expect(summarizeText('https://api.test', request)).resolves.toBe('Raz. Dwa. Trzy.');
  });
});
