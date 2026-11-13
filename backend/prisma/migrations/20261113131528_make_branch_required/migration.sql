-- Make Bus.branchId and Trip.branchId required.
-- Pre-flight safety net: abort cleanly if any NULL slipped past the backfill.
DO $$
DECLARE
  null_buses INT;
  null_trips INT;
BEGIN
  SELECT COUNT(*) INTO null_buses FROM "Bus" WHERE "branchId" IS NULL;
  SELECT COUNT(*) INTO null_trips FROM "Trip" WHERE "branchId" IS NULL;
  IF null_buses > 0 OR null_trips > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: % buses and % trips still have NULL branchId. Run scripts/fix-null-branch-ids.mjs first.', null_buses, null_trips;
  END IF;
END $$;

ALTER TABLE "Bus" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "branchId" SET NOT NULL;