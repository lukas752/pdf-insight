import { useEffect, useRef } from 'react';
import { formatAmount, formatDate, formatLanguage } from '../lib/format';
import { messages } from '../lib/messages';
import type { Analysis } from '../lib/schema';
import { JsonPreview } from './JsonPreview';

interface ResultViewProps {
  result: Analysis;
  onDownload: () => void;
  onReset: () => void;
}

function ChipList({ items }: { items: readonly string[] }) {
  if (items.length === 0) {
    return <p className="muted">{messages.result.none}</p>;
  }
  return (
    <ul className="chips">
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ResultView({ result, onDownload, onReset }: ResultViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { document, summary, keyPoints, entities, amounts, dates, keywords } = result;

  // Move focus to the result when it appears so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  return (
    <article className="result" aria-labelledby="result-heading">
      <header className="result__header">
        <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="result__heading">
          {messages.result.heading}
        </h2>
        <div className="result__actions">
          <button type="button" className="button button--primary" onClick={onDownload}>
            {messages.actions.download}
          </button>
          <button type="button" className="button button--secondary" onClick={onReset}>
            {messages.actions.newFile}
          </button>
        </div>
      </header>

      <section className="card">
        <h3 className="card__title">{messages.result.metadata}</h3>
        <dl className="meta">
          <dt>{messages.result.fileName}</dt>
          <dd>{document.fileName}</dd>
          <dt>{messages.result.pages}</dt>
          <dd>{document.pages}</dd>
          <dt>{messages.result.language}</dt>
          <dd>{formatLanguage(document.language)}</dd>
          <dt>{messages.result.type}</dt>
          <dd>
            <span className="badge">{messages.documentTypes[document.type]}</span>
          </dd>
          <dt>{messages.result.title}</dt>
          <dd>{document.title ?? <span className="muted">{messages.result.none}</span>}</dd>
          <dt>{messages.result.date}</dt>
          <dd>
            {document.date === null ? (
              <span className="muted">{messages.result.none}</span>
            ) : (
              formatDate(document.date)
            )}
          </dd>
        </dl>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.summary}</h3>
        <p className="result__summary">{summary}</p>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.keyPoints}</h3>
        <ul className="result__list">
          {keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.entities}</h3>
        <div className="result__columns">
          <div>
            <h4 className="card__subtitle">{messages.result.organizations}</h4>
            <ChipList items={entities.organizations} />
          </div>
          <div>
            <h4 className="card__subtitle">{messages.result.people}</h4>
            <ChipList items={entities.people} />
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.amounts}</h3>
        {amounts.length === 0 ? (
          <p className="muted">{messages.result.none}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Kwota</th>
                  <th scope="col">Kontekst</th>
                </tr>
              </thead>
              <tbody>
                {amounts.map((amount, index) => (
                  <tr key={`${amount.value}-${amount.currency}-${index}`}>
                    <td className="table__number">{formatAmount(amount)}</td>
                    <td>{amount.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.dates}</h3>
        {dates.length === 0 ? (
          <p className="muted">{messages.result.none}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Kontekst</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((entry, index) => (
                  <tr key={`${entry.date}-${index}`}>
                    <td>
                      <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                    </td>
                    <td>{entry.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.keywords}</h3>
        <ChipList items={keywords} />
      </section>

      <JsonPreview data={result} />
    </article>
  );
}
