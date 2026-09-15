import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfOpenError, ScannedPdfError } from './errors';
import { hasTextLayer, normaliseWhitespace } from './text';

// Imported with `?url` so Vite rewrites the path for the GitHub Pages base (/pdf-insight/).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ExtractedText {
  text: string;
  pages: number;
}

export type ExtractionProgress = (pagesDone: number, totalPages: number) => void;

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

/** pdf.js emits one item per text run; `hasEOL` marks the end of a visual line. */
function pageTextFromItems(items: (TextItem | TextMarkedContent)[]): string {
  let text = '';
  for (const item of items) {
    if (!isTextItem(item)) {
      continue;
    }
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text;
}

export async function extractText(
  file: Blob,
  onProgress?: ExtractionProgress,
): Promise<ExtractedText> {
  const data = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjsLib.getDocument({ data });
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    throw new PdfOpenError(error);
  }

  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(pageTextFromItems(content.items));
      onProgress?.(pageNumber, pdf.numPages);
    }

    const text = normaliseWhitespace(pageTexts.join('\n\n'));
    if (!hasTextLayer(text)) {
      throw new ScannedPdfError(pdf.numPages);
    }
    return { text, pages: pdf.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
