import { useRef, useState, type DragEvent, type KeyboardEvent, type Ref } from 'react';
import { messages } from '../lib/messages';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
  /** Lets the parent move focus back here, e.g. after the result view is dismissed. */
  ref?: Ref<HTMLDivElement> | undefined;
}

export function DropZone({ onFile, disabled, ref }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function openPicker(): void {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    // Ignore leave events fired when moving between the zone's own children.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (!disabled && file !== undefined) {
      onFile(file);
    }
  }

  const className = [
    'dropzone',
    dragOver ? 'dropzone--active' : '',
    disabled ? 'dropzone--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={messages.dropZone.ariaLabel}
      className={className}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            onFile(file);
          }
          // Reset so choosing the same file again still fires `change`.
          event.target.value = '';
        }}
      />
      <span className="dropzone__icon-wrap" aria-hidden="true">
        <svg className="dropzone__icon" viewBox="0 0 24 24" focusable="false">
          <path
            d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V9h5.5M12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="dropzone__title">
        {dragOver ? messages.dropZone.active : messages.dropZone.idle}
      </span>
      <span className="dropzone__hint">{messages.dropZone.hint}</span>
      <span className="button button--secondary dropzone__browse" aria-hidden="true">
        {messages.dropZone.browse}
      </span>
    </div>
  );
}
