/** Letters that occur in Polish and in (almost) no other European language. */
const POLISH_LETTERS = /[ąęłńśźż]/gu;
const LETTERS = /\p{L}/gu;
/** Below this many letters the ratio is too noisy to judge. */
const MIN_LETTERS_TO_JUDGE = 120;
/** Polish prose has ~6% of these letters; a foreign text with a Polish surname stays well below 2%. */
const POLISH_LEAK_RATIO = 0.02;
const POLISH_MIN_RATIO = 0.01;

function polishLetterRatio(text: string): { ratio: number; letters: number } {
  const letters = (text.match(LETTERS) ?? []).length;
  const polish = (text.match(POLISH_LETTERS) ?? []).length;
  return { ratio: letters === 0 ? 0 : polish / letters, letters };
}

/**
 * Cheap consistency check between the declared document language and the text values.
 * The browser cannot detect every language, but the failure that actually happens in a
 * Polish-facing app is the model translating a foreign document into Polish (or, rarely,
 * a Polish one into another language). Short texts are always accepted.
 */
export function isLanguageConsistent(language: string, text: string): boolean {
  const { ratio, letters } = polishLetterRatio(text);
  if (letters < MIN_LETTERS_TO_JUDGE) {
    return true;
  }
  return language === 'pl' ? ratio >= POLISH_MIN_RATIO : ratio <= POLISH_LEAK_RATIO;
}
