/**
 * Domain errors raised by the extraction/analysis pipeline. They live here, away from
 * pdf.js, so the UI can `instanceof` them without pulling the heavy pdf.js chunk upfront.
 */

/** The file could not be parsed as a PDF (corrupt, encrypted or not a PDF at all). */
export class PdfOpenError extends Error {
  constructor(cause: unknown) {
    super('Could not open PDF', { cause });
    this.name = 'PdfOpenError';
  }
}

/** The PDF opened fine but carries (almost) no text layer – most likely a scan. */
export class ScannedPdfError extends Error {
  constructor(public readonly pages: number) {
    super('PDF has no usable text layer');
    this.name = 'ScannedPdfError';
  }
}

/** The extracted text is longer than the pipeline is willing to send in chunks. */
export class DocumentTooLongError extends Error {
  constructor(public readonly characters: number) {
    super('Document text exceeds the supported length');
    this.name = 'DocumentTooLongError';
  }
}
