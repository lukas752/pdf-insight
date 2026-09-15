import { describe, expect, it } from 'vitest';
import { analysisFileName } from '../src/lib/download';

describe('analysisFileName', () => {
  it('replaces the .pdf extension with -analiza.json', () => {
    expect(analysisFileName('umowa.pdf')).toBe('umowa-analiza.json');
    expect(analysisFileName('RAPORT.PDF')).toBe('RAPORT-analiza.json');
  });

  it('uses a default base name for an empty name', () => {
    expect(analysisFileName('.pdf')).toBe('dokument-analiza.json');
  });
});
