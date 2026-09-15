const STEPS = [
  { title: 'Wgraj PDF', text: 'Przeciągnij plik albo wybierz go z dysku. Maksymalnie 10 MB.' },
  {
    title: 'Odczyt lokalny',
    text: 'Tekst jest wyodrębniany w Twojej przeglądarce – plik nie jest nigdzie wysyłany.',
  },
  {
    title: 'Podsumowanie i dane',
    text: 'Otrzymasz 3–5 zdań podsumowania oraz uporządkowany JSON do pobrania.',
  },
] as const;

export function StateEmpty() {
  return (
    <section className="empty" aria-label="Jak to działa">
      <ol className="empty__steps">
        {STEPS.map((step, index) => (
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
