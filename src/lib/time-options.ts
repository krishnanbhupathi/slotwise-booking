/** "HH:MM" values every 15 minutes from 00:00 to 24:00 inclusive. */
export const QUARTER_HOURS: string[] = Array.from({ length: 97 }, (_, i) => {
  const minutes = i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** "09:30" → "9:30 am", "24:00" → "midnight". */
export function formatTime(hhmm: string): string {
  if (hhmm === "24:00") return "midnight";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const WEEKDAYS = [
  { iso: 1, name: "Monday", short: "Mon" },
  { iso: 2, name: "Tuesday", short: "Tue" },
  { iso: 3, name: "Wednesday", short: "Wed" },
  { iso: 4, name: "Thursday", short: "Thu" },
  { iso: 5, name: "Friday", short: "Fri" },
  { iso: 6, name: "Saturday", short: "Sat" },
  { iso: 7, name: "Sunday", short: "Sun" },
] as const;
