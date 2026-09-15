/**
 * All user-facing copy lives here (Polish only), so components never carry string literals.
 * Functions are used for messages that interpolate values.
 */
export const messages = {
  app: {
    title: 'PDF Insight',
    tagline:
      'Wgraj plik PDF – otrzymasz krótkie podsumowanie i uporządkowane dane w formacie JSON.',
    footer:
      'Tekst jest odczytywany lokalnie w przeglądarce. Analizę wykonuje model Claude (Anthropic).',
  },
  privacy:
    'Plik PDF nie opuszcza Twojego urządzenia — tekst jest z niego odczytywany lokalnie w przeglądarce. Do API Anthropic wysyłany jest wyłącznie wyodrębniony tekst dokumentu w celu wygenerowania podsumowania. Nie przechowujemy ani pliku, ani jego treści.',
  dropZone: {
    idle: 'Przeciągnij plik PDF tutaj albo kliknij, aby wybrać',
    active: 'Upuść plik, aby rozpocząć analizę',
    hint: 'Tylko pliki PDF z warstwą tekstową, maksymalnie 10 MB',
    browse: 'Wybierz plik',
    ariaLabel: 'Wybierz lub upuść plik PDF do analizy',
  },
  validation: {
    notPdfType: 'To nie jest plik PDF. Wybierz plik w formacie PDF.',
    notPdfExtension: 'Plik musi mieć rozszerzenie .pdf.',
    tooLarge: 'Plik jest za duży. Maksymalny rozmiar to 10 MB.',
    empty: 'Plik jest pusty.',
  },
  status: {
    extracting: (page: number, total: number) => `Odczytuję tekst… strona ${page} z ${total}`,
    extractingStart: 'Otwieram dokument…',
    analyzing: 'Analizuję dokument…',
    analyzingChunks: (done: number, total: number) =>
      `Analizuję dokument… część ${done} z ${total}`,
    analyzingSummary: 'Łączę wyniki i piszę podsumowanie…',
    done: 'Analiza gotowa.',
    error: 'Wystąpił błąd.',
  },
  errors: {
    scanned:
      'Ten PDF nie zawiera warstwy tekstowej (prawdopodobnie jest to skan). Rozpoznawanie tekstu ze skanów (OCR) nie jest obsługiwane. Spróbuj z plikiem PDF zapisanym z edytora tekstu lub innym dokumentem z zaznaczalnym tekstem.',
    corruptPdf:
      'Nie udało się otworzyć pliku. Upewnij się, że to poprawny, niezaszyfrowany dokument PDF.',
    network:
      'Nie udało się połączyć z usługą analizy. Sprawdź połączenie z internetem i spróbuj ponownie.',
    rateLimited: 'Zbyt wiele zapytań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.',
    invalidResponse:
      'Otrzymana odpowiedź nie spełnia wymaganego formatu danych. Spróbuj ponownie – jeśli problem się powtarza, dokument może być zbyt nietypowy.',
    textTooLong: 'Dokument zawiera zbyt dużo tekstu, aby go przeanalizować.',
    server: 'Usługa analizy zgłosiła błąd. Spróbuj ponownie za chwilę.',
    unknown: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
    missingApiUrl:
      'Aplikacja nie została skonfigurowana: brak adresu usługi analizy (VITE_API_URL). Skontaktuj się z administratorem.',
  },
  actions: {
    retry: 'Spróbuj ponownie',
    newFile: 'Analizuj inny plik',
    download: 'Pobierz JSON',
    showJson: 'Pokaż surowy JSON',
    hideJson: 'Ukryj surowy JSON',
    clearHistory: 'Wyczyść historię',
    deleteEntry: (fileName: string) => `Usuń „${fileName}” z historii`,
    restoreEntry: (fileName: string) => `Przywróć analizę pliku „${fileName}”`,
  },
  result: {
    heading: 'Wynik analizy',
    metadata: 'Dokument',
    fileName: 'Plik',
    pages: 'Liczba stron',
    language: 'Język',
    type: 'Typ dokumentu',
    title: 'Tytuł',
    date: 'Data dokumentu',
    summary: 'Podsumowanie',
    keyPoints: 'Najważniejsze punkty',
    entities: 'Podmioty',
    organizations: 'Organizacje',
    people: 'Osoby',
    amounts: 'Kwoty',
    dates: 'Daty',
    keywords: 'Słowa kluczowe',
    none: 'brak',
    rawJson: 'Surowe dane JSON',
  },
  documentTypes: {
    faktura: 'Faktura',
    umowa: 'Umowa',
    oferta: 'Oferta',
    raport: 'Raport',
    inne: 'Inny dokument',
  },
  history: {
    heading: 'Ostatnie analizy',
    empty: 'Historia jest pusta. Wyniki analiz zapisują się tylko w tej przeglądarce.',
    pages: (pages: number) => `${pages} ${pages === 1 ? 'strona' : pages < 5 ? 'strony' : 'stron'}`,
  },
  time: {
    justNow: 'przed chwilą',
    minutesAgo: (minutes: number) => `${minutes} min temu`,
    hoursAgo: (hours: number) => `${hours} godz. temu`,
    daysAgo: (days: number) => `${days} ${days === 1 ? 'dzień' : 'dni'} temu`,
  },
} as const;
