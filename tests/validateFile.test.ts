import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES, validateFile } from '../src/lib/validateFile';

function fakeFile(name: string, size: number, type: string) {
  return { name, size, type };
}

describe('validateFile', () => {
  it('accepts a PDF under 10 MB', () => {
    expect(validateFile(fakeFile('umowa.pdf', 512 * 1024, 'application/pdf'))).toEqual({
      ok: true,
    });
  });

  it('accepts an upper-case .PDF extension', () => {
    expect(validateFile(fakeFile('UMOWA.PDF', 1024, 'application/pdf'))).toEqual({ ok: true });
  });

  it('accepts a PDF whose MIME type the browser could not determine', () => {
    expect(validateFile(fakeFile('umowa.pdf', 1024, '')).ok).toBe(true);
    expect(validateFile(fakeFile('umowa.pdf', 1024, 'application/x-pdf')).ok).toBe(true);
  });

  it('accepts a file of exactly 10 MB', () => {
    expect(validateFile(fakeFile('a.pdf', MAX_FILE_SIZE_BYTES, 'application/pdf')).ok).toBe(true);
  });

  it('rejects a 12 MB PDF because of size', () => {
    const result = validateFile(fakeFile('duzy.pdf', 12 * 1024 * 1024, 'application/pdf'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('size');
      expect(result.message).toContain('10 MB');
    }
  });

  it('rejects a .docx by extension', () => {
    const result = validateFile(
      fakeFile(
        'pismo.docx',
        1024,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('extension');
    }
  });

  it('rejects a file with a .pdf name but a non-PDF MIME type', () => {
    const result = validateFile(fakeFile('podejrzany.pdf', 1024, 'text/html'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('type');
    }
  });

  it('rejects an empty file', () => {
    const result = validateFile(fakeFile('pusty.pdf', 0, 'application/pdf'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('empty');
    }
  });

  it('returns a Polish message for every failure', () => {
    const failures = [
      validateFile(fakeFile('x.txt', 10, 'text/plain')),
      validateFile(fakeFile('x.pdf', 10, 'text/plain')),
      validateFile(fakeFile('x.pdf', 0, 'application/pdf')),
      validateFile(fakeFile('x.pdf', MAX_FILE_SIZE_BYTES + 1, 'application/pdf')),
    ];
    for (const failure of failures) {
      expect(failure.ok).toBe(false);
      if (!failure.ok) {
        expect(failure.message.length).toBeGreaterThan(10);
      }
    }
  });
});
