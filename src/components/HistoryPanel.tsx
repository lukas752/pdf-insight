import { formatRelativeTime } from '../lib/format';
import type { HistoryEntry } from '../lib/history';
import { messages } from '../lib/messages';

interface HistoryPanelProps {
  entries: readonly HistoryEntry[];
  activeId: string | null;
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({
  entries,
  activeId,
  onRestore,
  onDelete,
  onClear,
}: HistoryPanelProps) {
  return (
    <section className="history" aria-labelledby="history-heading">
      <div className="history__header">
        <h2 id="history-heading" className="history__heading">
          {messages.history.heading}
        </h2>
        {entries.length > 0 && (
          <button type="button" className="button button--ghost" onClick={onClear}>
            {messages.actions.clearHistory}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="muted history__empty">{messages.history.empty}</p>
      ) : (
        <ul className="history__list">
          {entries.map((entry) => {
            const active = entry.id === activeId;
            return (
              <li
                key={entry.id}
                className={`history__item ${active ? 'history__item--active' : ''}`}
              >
                <button
                  type="button"
                  className="history__restore"
                  aria-label={messages.actions.restoreEntry(entry.fileName)}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onRestore(entry)}
                >
                  <span className="history__file">{entry.fileName}</span>
                  <span className="history__meta">
                    <span className={`badge badge--small badge--${entry.result.document.type}`}>
                      {messages.documentTypes[entry.result.document.type]}
                    </span>
                    {' · '}
                    {messages.history.pages(entry.result.document.pages)}
                    {' · '}
                    <time dateTime={entry.analyzedAt}>{formatRelativeTime(entry.analyzedAt)}</time>
                  </span>
                </button>
                <button
                  type="button"
                  className="history__delete"
                  aria-label={messages.actions.deleteEntry(entry.fileName)}
                  onClick={() => onDelete(entry.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
