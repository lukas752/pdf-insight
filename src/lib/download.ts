/** "umowa.pdf" → "umowa-analiza.json" */
export function analysisFileName(pdfFileName: string): string {
  const base = pdfFileName.replace(/\.pdf$/i, '').trim() || 'dokument';
  return `${base}-analiza.json`;
}

/** Triggers a browser download of pretty-printed JSON via a temporary object URL. */
export function downloadJson(fileName: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoke after the click has been handled so the browser can still read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
