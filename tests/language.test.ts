import { describe, expect, it } from 'vitest';
import { isLanguageConsistent } from '../src/lib/language';

const polish =
  'Umowa serwisowa została zawarta 1 września 2026 r. w Warszawie. Wykonawca zobowiązuje się do świadczenia usług monitoringu i konserwacji infrastruktury IT. Wynagrodzenie wynosi 12 500 zł netto miesięcznie, płatne w terminie 14 dni.';
const english =
  'Northwind Logistics handled 48,200 shipments in the second quarter, an increase of eleven percent. On-time delivery reached 96.4 percent, exceeding the target agreed with Contoso Retail. The report was approved by David Chen and Marek Zieliński in Warsaw.';

describe('isLanguageConsistent', () => {
  it('accepts Polish text declared as Polish', () => {
    expect(isLanguageConsistent('pl', polish)).toBe(true);
  });

  it('accepts English text with a Polish surname declared as English', () => {
    expect(isLanguageConsistent('en', english)).toBe(true);
  });

  it('rejects Polish text declared as English (the model translated the document)', () => {
    expect(isLanguageConsistent('en', polish)).toBe(false);
  });

  it('rejects English text declared as Polish', () => {
    expect(isLanguageConsistent('pl', english)).toBe(false);
  });

  it('does not judge short texts', () => {
    expect(isLanguageConsistent('en', 'Krótki tekst po polsku.')).toBe(true);
    expect(isLanguageConsistent('pl', 'Short English text.')).toBe(true);
  });

  it('accepts other languages without Polish letters', () => {
    const german =
      'Der Vertrag wurde am ersten September in Berlin geschlossen und regelt die Wartung der gesamten IT-Infrastruktur des Auftraggebers für zwölf Monate mit einer Kündigungsfrist von drei Monaten.';
    expect(isLanguageConsistent('de', german)).toBe(true);
  });
});
