import { useId, useState } from 'react';
import { messages } from '../lib/messages';

interface JsonPreviewProps {
  data: unknown;
}

/** Renders the raw JSON as text inside <pre>; nothing from the model is ever treated as HTML. */
export function JsonPreview({ data }: JsonPreviewProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="json">
      <button
        type="button"
        className="button button--secondary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? messages.actions.hideJson : messages.actions.showJson}
      </button>
      <pre id={panelId} className="json__pre" hidden={!open} aria-label={messages.result.rawJson}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
