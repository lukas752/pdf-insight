import { messages } from './messages';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PDF_MIME_TYPE = 'application/pdf';

export type FileValidation =
  { ok: true } | { ok: false; reason: 'extension' | 'type' | 'size' | 'empty'; message: string };

/** Only the three fields we need, so the function is trivial to unit-test without a real File. */
export type FileLike = Pick<File, 'name' | 'size' | 'type'>;

export function validateFile(file: FileLike): FileValidation {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, reason: 'extension', message: messages.validation.notPdfExtension };
  }
  if (file.type !== PDF_MIME_TYPE) {
    return { ok: false, reason: 'type', message: messages.validation.notPdfType };
  }
  if (file.size === 0) {
    return { ok: false, reason: 'empty', message: messages.validation.empty };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'size', message: messages.validation.tooLarge };
  }
  return { ok: true };
}
