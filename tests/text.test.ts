import { describe, expect, it } from 'vitest';
import {
  countNonWhitespace,
  hasTextLayer,
  MIN_TEXT_CHARS,
  normaliseWhitespace,
} from '../src/lib/text';

describe('normaliseWhitespace', () => {
  it('collapses spaces, trims lines and keeps single blank lines between paragraphs', () => {
    const input = '  Umowa   serwisowa \n\n\n\n§ 1.\tPrzedmiot  \r\n\r\nTreść.  ';
    expect(normaliseWhitespace(input)).toBe('Umowa serwisowa\n\n§ 1. Przedmiot\n\nTreść.');
  });
});

describe('hasTextLayer', () => {
  it('treats fewer than the minimum non-whitespace characters as a scan', () => {
    expect(hasTextLayer('a b c')).toBe(false);
    expect(hasTextLayer('x'.repeat(MIN_TEXT_CHARS - 1))).toBe(false);
    expect(hasTextLayer(`${'x'.repeat(MIN_TEXT_CHARS)} `)).toBe(true);
  });

  it('ignores whitespace when counting', () => {
    expect(countNonWhitespace(' a\n b\tc ')).toBe(3);
  });
});
