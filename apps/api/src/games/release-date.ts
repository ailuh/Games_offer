const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses a Steam-style release date string into a Date at local midnight, or
 * null when the string is not a precise calendar day. Steam returns formats
 * like "Sep 25, 2025", "25 Sep, 2025", or "September 25, 2025"; vague values
 * such as "2025", "Q3 2025", "Coming soon" or "To be announced" yield null
 * because no single day can drive the release-day notification.
 */
export function parseReleaseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const text = raw.trim();

  const monthFirst = text.match(/([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (month !== undefined) return makeDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }

  const dayFirst = text.match(/(\d{1,2})\s+([A-Za-z]{3,}),?\s+(\d{4})/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) return makeDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  const numeric = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (numeric) return makeDate(Number(numeric[1]), Number(numeric[2]) - 1, Number(numeric[3]));

  return null;
}

function makeDate(year: number, monthIndex: number, day: number): Date | null {
  if (day < 1 || day > 31) return null;
  const date = new Date(year, monthIndex, day);
  return Number.isNaN(date.getTime()) ? null : date;
}
