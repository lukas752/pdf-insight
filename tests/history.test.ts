import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHistory,
  createHistoryEntry,
  HISTORY_LIMIT,
  loadHistory,
  removeFromHistory,
  saveToHistory,
} from '../src/lib/history';
import type { Analysis } from '../src/lib/schema';

const result: Analysis = {
  document: {
    fileName: 'umowa.pdf',
    pages: 4,
    language: 'pl',
    type: 'umowa',
    title: null,
    date: null,
  },
  summary: 'Raz. Dwa. Trzy.',
  keyPoints: ['a', 'b', 'c'],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
};

/** Minimal in-memory Storage so tests run in Node without jsdom. */
function fakeStorage(store = new Map<string, string>()) {
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    length: 0,
  };
}

describe('history', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips an entry through storage', () => {
    const entry = createHistoryEntry(result, new Date('2026-09-15T10:00:00Z'));
    saveToHistory(entry);
    expect(loadHistory()).toEqual([entry]);
  });

  it('keeps only the newest entries up to the limit', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) {
      saveToHistory(createHistoryEntry(result, new Date(2026, 8, 1, 10, i)));
    }
    const entries = loadHistory();
    expect(entries).toHaveLength(HISTORY_LIMIT);
    const [newest, second] = entries;
    expect((newest?.analyzedAt ?? '').localeCompare(second?.analyzedAt ?? '')).toBeGreaterThan(0);
  });

  it('drops corrupt entries and keeps valid ones', () => {
    const valid = createHistoryEntry(result, new Date('2026-09-15T10:00:00Z'));
    storage.setItem(
      'pdf-insight:history:v1',
      JSON.stringify([valid, { id: 'x', fileName: 'bad.pdf' }, 'garbage', null]),
    );
    expect(loadHistory()).toEqual([valid]);
  });

  it('returns an empty list for unparsable JSON', () => {
    storage.setItem('pdf-insight:history:v1', '{not json');
    expect(loadHistory()).toEqual([]);
  });

  it('removes a single entry and clears everything', () => {
    const a = createHistoryEntry(result, new Date('2026-09-15T10:00:00Z'));
    const b = createHistoryEntry(result, new Date('2026-09-15T11:00:00Z'));
    saveToHistory(a);
    saveToHistory(b);
    expect(removeFromHistory(a.id).map((e) => e.id)).toEqual([b.id]);
    expect(clearHistory()).toEqual([]);
    expect(loadHistory()).toEqual([]);
  });

  it('does not throw when storage is unavailable or full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const entry = createHistoryEntry(result);
    expect(() => saveToHistory(entry)).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });
});
