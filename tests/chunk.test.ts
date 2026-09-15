import { describe, expect, it } from 'vitest';
import { chunkText, DEFAULT_CHUNK_OPTIONS, type ChunkOptions } from '../src/lib/chunk';

const options: ChunkOptions = { threshold: 120, size: 100, overlap: 20 };

/** 20 distinct short paragraphs separated by blank lines. */
const paragraphs = Array.from({ length: 20 }, (_, i) => `Akapit ${i + 1} słowo alfa${i + 1}.`);
const longText = paragraphs.join('\n\n');

function isBoundary(text: string, index: number): boolean {
  return index <= 0 || index >= text.length || /\s/.test(text.charAt(index));
}

describe('chunkText', () => {
  it('returns the text unchanged when it is under the threshold', () => {
    expect(chunkText('Krótki tekst.', options)).toEqual(['Krótki tekst.']);
    expect(chunkText('x'.repeat(DEFAULT_CHUNK_OPTIONS.threshold))).toHaveLength(1);
  });

  it('splits long text into several chunks no longer than the configured size', () => {
    const chunks = chunkText(longText, options);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(options.size);
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it('never starts or ends a chunk in the middle of a word', () => {
    const chunks = chunkText(longText, options);
    for (const chunk of chunks) {
      const start = longText.indexOf(chunk);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(isBoundary(longText, start - 1)).toBe(true);
      expect(isBoundary(longText, start + chunk.length)).toBe(true);
    }
  });

  it('prefers paragraph boundaries when they exist in the window', () => {
    const chunks = chunkText(longText, options);
    // Every chunk except the last should end exactly where a paragraph ends.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.endsWith('.')).toBe(true);
    }
  });

  it('covers every paragraph of the source text', () => {
    const chunks = chunkText(longText, options);
    for (const paragraph of paragraphs) {
      expect(chunks.some((chunk) => chunk.includes(paragraph))).toBe(true);
    }
  });

  it('overlaps consecutive chunks', () => {
    const chunks = chunkText(longText, options);
    for (let i = 0; i < chunks.length - 1; i += 1) {
      const current = chunks[i];
      const next = chunks[i + 1];
      if (current === undefined || next === undefined) {
        throw new Error('chunk index out of range');
      }
      const currentEnd = longText.indexOf(current) + current.length;
      expect(longText.indexOf(next)).toBeLessThan(currentEnd);
    }
  });

  it('still terminates on text without any whitespace', () => {
    const noSpaces = 'a'.repeat(450);
    const chunks = chunkText(noSpaces, options);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('').length).toBeGreaterThanOrEqual(noSpaces.length);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(options.size);
    }
  });

  it('is deterministic', () => {
    expect(chunkText(longText, options)).toEqual(chunkText(longText, options));
  });
});
