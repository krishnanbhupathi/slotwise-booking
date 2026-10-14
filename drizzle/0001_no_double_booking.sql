-- No double-booking, enforced by the database rather than application code.
-- Two live bookings (held or confirmed) for the same provider may not overlap
-- on [starts_at, blocks_until). Even if two requests race past the app-level
-- availability check, the second INSERT fails with SQLSTATE 23P01.
-- btree_gist lets the GiST index compare provider_id with "=".
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "provider_id" WITH =,
    tstzrange("starts_at", "blocks_until", '[)') WITH &&
  ) WHERE ("status" IN ('held', 'confirmed'));
