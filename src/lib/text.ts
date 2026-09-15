/** Below this many non-whitespace characters we treat the PDF as a scan without a text layer. */
export const MIN_TEXT_CHARS = 200;

export function countNonWhitespace(text: string): number {
  return text.replace(/\s/g, '').length;
}

export function hasTextLayer(text: string): boolean {
  return countNonWhitespace(text) >= MIN_TEXT_CHARS;
}

/**
 * Collapses runs of spaces, trims every line and keeps at most one blank line between
 * paragraphs, so paragraph breaks survive while page-layout noise disappears.
 */
export function normaliseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
