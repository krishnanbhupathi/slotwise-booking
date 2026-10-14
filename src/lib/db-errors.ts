/** The Postgres SQLSTATE behind a Drizzle error, if any (drizzle puts the driver error on `cause`). */
export function pgErrorCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.cause?.code ?? e?.code;
  return typeof code === "string" ? code : undefined;
}

export const UNIQUE_VIOLATION = "23505";
export const EXCLUSION_VIOLATION = "23P01";
