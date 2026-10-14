/** All IANA zones the runtime knows, for <select>s. */
export const TIME_ZONES: string[] = Intl.supportedValuesOf("timeZone");

/** "Europe/London (GMT+1)" — offset as of now. */
export function timeZoneLabel(tz: string, at = new Date()): string {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return `${tz.replaceAll("_", " ")}${offset ? ` (${offset})` : ""}`;
}
