import { messages } from '../lib/messages';

interface StateErrorProps {
  message: string;
  /** Null when the failure is not retryable (for example a validation error). */
  onRetry: (() => void) | null;
}

export function StateError({ message, onRetry }: StateErrorProps) {
  return (
    <section className="alert alert--error" role="alert">
      <p className="alert__message">{message}</p>
      {onRetry !== null && (
        <button type="button" className="button button--primary" onClick={onRetry}>
          {messages.actions.retry}
        </button>
      )}
    </section>
  );
}
