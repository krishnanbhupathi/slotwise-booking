/** Date/time formatting in an explicit time zone. Server and client render the same text. */

const LOCALE = "en-GB";

export function formatTimeIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    // ICU versions differ on the space before "pm" (U+202F vs U+0020); normalise so server and browser match.
    .replace(/\s/g, " ");
}

export function formatDayIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date);
}

/** "Mon 19 Oct, 4:00 pm" */
export function formatDateTimeIn(date: Date, timeZone: string): string {
  return `${formatDayIn(date, timeZone)}, ${formatTimeIn(date, timeZone)}`;
}

/** "Europe/London" → "London" */
export function cityName(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replaceAll("_", " ");
}
