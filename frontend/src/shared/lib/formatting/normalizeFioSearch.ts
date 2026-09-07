import ru from 'convert-layout/ru';

const LATIN_LETTER = /[A-Za-z]/;

/** Привести строку поиска ФИО к кириллице: латиница считается вводом в английской раскладке. */
export function normalizeFioSearch(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || !LATIN_LETTER.test(trimmed)) {
    return trimmed;
  }
  return ru.fromEn(trimmed);
}

/** Проверить, содержит ли значение ФИО поисковую строку с учётом инверсии раскладки. */
export function matchesFioSearch(value: string | null | undefined, query: string): boolean {
  if (!query.trim()) {
    return true;
  }
  const normalizedQuery = normalizeFioSearch(query).toLowerCase();
  return (value ?? '').toLowerCase().includes(normalizedQuery);
}
