import { messages } from '../lib/messages';
import type { LoadingStatus } from './App';

interface StateLoadingProps {
  status: LoadingStatus;
}

function describe(status: LoadingStatus): { label: string; fraction: number | null } {
  switch (status.kind) {
    case 'extracting':
      return { label: messages.status.extractingStart, fraction: status.progress };
    case 'summarizing':
      return { label: messages.status.analyzingSummary, fraction: null };
    case 'analyzing':
      return status.total > 1
        ? {
            label: messages.status.analyzingChunks(status.done, status.total),
            fraction: status.done / status.total,
          }
        : { label: messages.status.analyzing, fraction: null };
  }
}

export function StateLoading({ status }: StateLoadingProps) {
  const { label, fraction } = describe(status);
  const percent = fraction === null ? null : Math.round(fraction * 100);

  return (
    <section className="loading" aria-busy="true">
      <div
        className={`progress ${percent === null ? 'progress--indeterminate' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        // `exactOptionalPropertyTypes` forbids `aria-valuenow={undefined}`, hence the conditional spread.
        {...(percent === null ? {} : { 'aria-valuenow': percent })}
      >
        <div
          className="progress__bar"
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className="loading__label">
        {label}
        {percent !== null && status.kind === 'extracting' ? ` (${percent}%)` : ''}
      </p>
    </section>
  );
}
