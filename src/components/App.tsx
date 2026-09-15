import { useEffect, useRef, useState } from 'react';
import { ApiError, readApiUrl } from '../api/client';
import { analyzeFile, type AnalysisProgress } from '../lib/analyze';
import { DocumentTooLongError, PdfOpenError, ScannedPdfError } from '../lib/errors';
import { analysisFileName, downloadJson } from '../lib/download';
import {
  clearHistory,
  createHistoryEntry,
  loadHistory,
  removeFromHistory,
  saveToHistory,
  type HistoryEntry,
} from '../lib/history';
import { messages } from '../lib/messages';
import type { Analysis } from '../lib/schema';
import { validateFile } from '../lib/validateFile';
import { DropZone } from './DropZone';
import { HistoryPanel } from './HistoryPanel';
import { PrivacyNotice } from './PrivacyNotice';
import { ResultView } from './ResultView';
import { StateEmpty } from './StateEmpty';
import { StateError } from './StateError';
import { StateLoading } from './StateLoading';

/** The whole UI is driven by this one discriminated union – never by a pile of booleans. */
export type Status =
  | { kind: 'empty' }
  | { kind: 'extracting'; progress: number }
  | { kind: 'analyzing'; done: number; total: number }
  | { kind: 'summarizing' }
  | { kind: 'done'; result: Analysis; historyId: string | null }
  | { kind: 'error'; message: string; retryable: boolean };

export type LoadingStatus = Extract<Status, { kind: 'extracting' | 'analyzing' | 'summarizing' }>;

function describeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ScannedPdfError) {
    return { message: messages.errors.scanned, retryable: false };
  }
  if (error instanceof PdfOpenError) {
    return { message: messages.errors.corruptPdf, retryable: false };
  }
  if (error instanceof DocumentTooLongError) {
    return { message: messages.errors.textTooLong, retryable: false };
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK':
        return { message: messages.errors.network, retryable: true };
      case 'RATE_LIMITED':
        return { message: messages.errors.rateLimited, retryable: true };
      case 'INVALID_RESPONSE':
        return { message: messages.errors.invalidResponse, retryable: true };
      case 'TEXT_TOO_LONG':
      case 'PAYLOAD_TOO_LARGE':
        return { message: messages.errors.textTooLong, retryable: false };
      case 'UPSTREAM_TIMEOUT':
      case 'UPSTREAM_ERROR':
      case 'INTERNAL':
        return { message: messages.errors.server, retryable: true };
      default:
        return { message: messages.errors.unknown, retryable: false };
    }
  }
  return { message: messages.errors.unknown, retryable: true };
}

function statusFromProgress(progress: AnalysisProgress): Status {
  switch (progress.phase) {
    case 'extracting':
      return {
        kind: 'extracting',
        progress: progress.total === 0 ? 0 : progress.page / progress.total,
      };
    case 'analyzing':
      return { kind: 'analyzing', done: progress.done, total: progress.total };
    case 'summarizing':
      return { kind: 'summarizing' };
  }
}

/** Text for the polite live region. Errors are announced by their own role="alert" instead. */
function liveText(status: Status): string {
  switch (status.kind) {
    case 'empty':
    case 'error':
      return '';
    case 'extracting':
      return messages.status.extractingStart;
    case 'analyzing':
      return messages.status.analyzing;
    case 'summarizing':
      return messages.status.analyzingSummary;
    case 'done':
      return messages.status.done;
  }
}

export function App() {
  const apiUrl = readApiUrl();
  if (apiUrl === null) {
    return (
      <main className="app app--config-error">
        <h1>{messages.app.title}</h1>
        <p role="alert" className="alert alert--error">
          {messages.errors.missingApiUrl}
        </p>
      </main>
    );
  }
  return <Analyzer apiUrl={apiUrl} />;
}

function Analyzer({ apiUrl }: { apiUrl: string }) {
  const [status, setStatus] = useState<Status>({ kind: 'empty' });
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [lastFile, setLastFile] = useState<File | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  async function runAnalysis(file: File): Promise<void> {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLastFile(file);
    setStatus({ kind: 'extracting', progress: 0 });

    try {
      const result = await analyzeFile(
        file,
        apiUrl,
        (progress) => {
          if (!controller.signal.aborted) {
            setStatus(statusFromProgress(progress));
          }
        },
        controller.signal,
      );
      if (controller.signal.aborted) {
        return;
      }
      const entry = createHistoryEntry(result);
      setHistory(saveToHistory(entry));
      setStatus({ kind: 'done', result, historyId: entry.id });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setStatus({ kind: 'error', ...describeError(error) });
    }
  }

  function handleFile(file: File): void {
    const validation = validateFile(file);
    if (!validation.ok) {
      setStatus({ kind: 'error', message: validation.message, retryable: false });
      return;
    }
    void runAnalysis(file);
  }

  function handleRetry(): void {
    if (lastFile !== null) {
      void runAnalysis(lastFile);
    }
  }

  function handleReset(): void {
    controllerRef.current?.abort();
    setLastFile(null);
    setStatus({ kind: 'empty' });
    // The button that was clicked disappears with the result; keep focus in the page.
    dropZoneRef.current?.focus();
  }

  function handleRestore(entry: HistoryEntry): void {
    controllerRef.current?.abort();
    setLastFile(null);
    setStatus({ kind: 'done', result: entry.result, historyId: entry.id });
  }

  function handleDelete(id: string): void {
    setHistory(removeFromHistory(id));
  }

  function handleClearHistory(): void {
    setHistory(clearHistory());
  }

  function handleDownload(result: Analysis): void {
    downloadJson(analysisFileName(result.document.fileName), result);
  }

  const busy =
    status.kind === 'extracting' || status.kind === 'analyzing' || status.kind === 'summarizing';

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {messages.app.skipToContent}
      </a>
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M7 2.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5zm6.5 1.5V8H18M8.5 12.5h7m-7 3.5h5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="app__title">{messages.app.title}</h1>
        </div>
        <p className="app__tagline">{messages.app.tagline}</p>
      </header>

      <div className="visually-hidden" role="status" aria-live="polite">
        {liveText(status)}
      </div>

      <div className="layout">
        <main className="main" id="main">
          <DropZone ref={dropZoneRef} onFile={handleFile} disabled={busy} />
          <PrivacyNotice />

          {status.kind === 'empty' && <StateEmpty />}
          {(status.kind === 'extracting' ||
            status.kind === 'analyzing' ||
            status.kind === 'summarizing') && <StateLoading status={status} />}
          {status.kind === 'error' && (
            <StateError
              message={status.message}
              onRetry={status.retryable && lastFile !== null ? handleRetry : null}
            />
          )}
          {status.kind === 'done' && (
            <ResultView
              result={status.result}
              onDownload={() => handleDownload(status.result)}
              onReset={handleReset}
            />
          )}
        </main>

        <aside className="sidebar">
          <HistoryPanel
            entries={history}
            activeId={status.kind === 'done' ? status.historyId : null}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onClear={handleClearHistory}
          />
        </aside>
      </div>

      <footer className="app__footer">{messages.app.footer}</footer>
    </div>
  );
}
