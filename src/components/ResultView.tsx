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

function ChipList({ items, lang }: { items: readonly string[]; lang: string }) {
  if (items.length === 0) {
    return <p className="muted">{messages.result.none}</p>;
  }
  return (
    <ul className="chips" lang={lang}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ResultView({ result, onDownload, onReset }: ResultViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { document: meta, summary, keyPoints, entities, amounts, dates, keywords } = result;
  // Values are in the document's language; the page itself is Polish.
  const lang = meta.language;

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
          <dd>{meta.fileName}</dd>
          <dt>{messages.result.pages}</dt>
          <dd>{meta.pages}</dd>
          <dt>{messages.result.language}</dt>
          <dd>{formatLanguage(meta.language)}</dd>
          <dt>{messages.result.type}</dt>
          <dd>
            <span className={`badge badge--${meta.type}`}>{messages.documentTypes[meta.type]}</span>
          </dd>
          <dt>{messages.result.title}</dt>
          <dd lang={lang}>{meta.title ?? <span className="muted">{messages.result.none}</span>}</dd>
          <dt>{messages.result.date}</dt>
          <dd>
            {meta.date === null ? (
              <span className="muted">{messages.result.none}</span>
            ) : (
              formatDate(meta.date)
            )}
          </dd>
        </dl>
      </section>

      <section className="card card--summary">
        <h3 className="card__title">{messages.result.summary}</h3>
        <p className="result__summary" lang={lang}>
          {summary}
        </p>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.keyPoints}</h3>
        <ul className="result__list" lang={lang}>
          {keyPoints.map((point, index) => (
            <li key={`${index}-${point}`}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.entities}</h3>
        <div className="result__columns">
          <div>
            <h4 className="card__subtitle">{messages.result.organizations}</h4>
            <ChipList items={entities.organizations} lang={lang} />
          </div>
          <div>
            <h4 className="card__subtitle">{messages.result.people}</h4>
            <ChipList items={entities.people} lang={lang} />
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
                  <th scope="col">{messages.result.amountColumn}</th>
                  <th scope="col">{messages.result.contextColumn}</th>
                </tr>
              </thead>
              <tbody>
                {amounts.map((amount, index) => (
                  <tr key={`${index}-${amount.value}-${amount.currency}`}>
                    <td className="table__number">{formatAmount(amount)}</td>
                    <td lang={lang}>{amount.context}</td>
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
                  <th scope="col">{messages.result.dateColumn}</th>
                  <th scope="col">{messages.result.contextColumn}</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((entry, index) => (
                  <tr key={`${index}-${entry.date}`}>
                    <td>
                      <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                    </td>
                    <td lang={lang}>{entry.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card__title">{messages.result.keywords}</h3>
        <ChipList items={keywords} lang={lang} />
      </section>

      <JsonPreview data={result} />
    </article>
  );
}
