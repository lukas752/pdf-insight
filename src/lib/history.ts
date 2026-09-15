import { z } from 'zod';
import { analysisSchema, type Analysis } from './schema';

const STORAGE_KEY = 'pdf-insight:history:v1';
export const HISTORY_LIMIT = 10;

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  analyzedAt: z.iso.datetime(),
  result: analysisSchema,
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/** localStorage can be missing or throw (private mode, disabled storage), so every access is guarded. */
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRaw(): unknown {
  const storage = getStorage();
  if (storage === null) {
    return [];
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === null ? [] : (JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeEntries(entries: HistoryEntry[]): void {
  const storage = getStorage();
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked – history is a convenience, the analysis itself still works.
  }
}

/** Reads history, validating every entry with Zod and silently dropping corrupt ones. */
export function loadHistory(): HistoryEntry[] {
  const raw = readRaw();
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: HistoryEntry[] = [];
  for (const candidate of raw) {
    const parsed = historyEntrySchema.safeParse(candidate);
    if (parsed.success) {
      entries.push(parsed.data);
    }
  }
  return entries.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt)).slice(0, HISTORY_LIMIT);
}

export function createHistoryEntry(result: Analysis, now: Date = new Date()): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    fileName: result.document.fileName,
    analyzedAt: now.toISOString(),
    result,
  };
}

/** Prepends an entry, keeps the newest HISTORY_LIMIT entries and returns the new list. */
export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  const others = loadHistory().filter((existing) => existing.id !== entry.id);
  const entries = [entry, ...others].slice(0, HISTORY_LIMIT);
  writeEntries(entries);
  return entries;
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.id !== id);
  writeEntries(entries);
  return entries;
}

export function clearHistory(): HistoryEntry[] {
  writeEntries([]);
  return [];
}
