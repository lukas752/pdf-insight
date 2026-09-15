import { messages } from '../lib/messages';

export function StateEmpty() {
  return (
    <section className="empty" aria-label={messages.empty.ariaLabel}>
      <ol className="empty__steps">
        {messages.empty.steps.map((step, index) => (
          <li key={step.title} className="empty__step">
            <span className="empty__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="empty__title">{step.title}</span>
            <span className="empty__text">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
