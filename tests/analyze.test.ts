import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHUNK_OPTIONS } from '../src/lib/chunk';

const extractText = vi.fn();
vi.mock('../src/lib/pdf', () => ({ extractText }));

const { analyzeFile } = await import('../src/lib/analyze');

function workerBody(marker: string) {
  return {
    document: { fileName: 'x', pages: 1, language: 'pl', type: 'umowa', title: null, date: null },
    summarySentences: [`Fragment ${marker} raz.`, 'Zdanie dwa.', 'Zdanie trzy.'],
    keyPoints: [`Punkt ${marker}`, 'Wspólny punkt', 'Inny punkt'],
    entities: { organizations: ['ACME'], people: [] },
    amounts: [],
    dates: [],
    keywords: ['umowa'],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Text long enough for several chunks: paragraphs of ~100 chars, ~8 chunks with default options. */
const longText = Array.from({ length: 2_200 }, (_, i) => `Akapit ${i} ${'x'.repeat(90)}.`).join(
  '\n\n',
);
const file = new File(['%PDF'], 'dlugi.pdf', { type: 'application/pdf' });

describe('analyzeFile', () => {
  beforeEach(() => {
    extractText.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('analyses a short document with a single request and no summarize call', async () => {
    extractText.mockResolvedValue({ text: 'Krótki tekst umowy.', pages: 1 });
    const fetchMock = vi.fn(() => Promise.resolve(json(workerBody('A'))));
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeFile(file, 'https://api.test', () => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.document.fileName).toBe('x');
    expect(result.summary).toBe('Fragment A raz. Zdanie dwa. Zdanie trzy.');
  });

  it('chunks a long document, merges the parts and asks for one final summary', async () => {
    extractText.mockResolvedValue({ text: longText, pages: 65 });
    const tasks: string[] = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { task: string; text: string };
      tasks.push(body.task);
      if (body.task === 'summarize') {
        return Promise.resolve(
          json({ summarySentences: ['Całość raz.', 'Całość dwa.', 'Całość trzy.'] }),
        );
      }
      expect(body.text.length).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.size);
      return Promise.resolve(json(workerBody(String(tasks.length))));
    });
    vi.stubGlobal('fetch', fetchMock);
    const phases: string[] = [];

    const result = await analyzeFile(file, 'https://api.test', (p) => phases.push(p.phase));

    const analyzeCalls = tasks.filter((t) => t === 'analyze').length;
    expect(analyzeCalls).toBeGreaterThan(1);
    expect(tasks.filter((t) => t === 'summarize')).toHaveLength(1);
    expect(result.summary).toBe('Całość raz. Całość dwa. Całość trzy.');
    expect(result.keyPoints.length).toBeLessThanOrEqual(7);
    expect(result.entities.organizations).toEqual(['ACME']);
    expect(phases).toContain('analyzing');
    expect(phases).toContain('summarizing');
  });

  it('stops sending remaining chunks after the first failure', async () => {
    extractText.mockResolvedValue({ text: longText, pages: 65 });
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return Promise.resolve(json({ error: { code: 'RATE_LIMITED', message: 'slow down' } }, 429));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeFile(file, 'https://api.test', () => undefined)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    // Only the first batch (concurrency limit) is ever dispatched.
    expect(calls).toBeLessThanOrEqual(4);
  });
});
