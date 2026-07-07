-- Database-level backstop against double-booking races.
-- Application logic remains the primary guard; this constraint protects
-- against concurrent requests that both pass the in-process overlap check.
-- NOTE: fails if legacy overlapping non-cancelled rows exist; cancel them first.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_no_staff_overlap;

ALTER TABLE appointments
ADD CONSTRAINT appointments_no_staff_overlap
EXCLUDE USING gist (
  staff_member_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
) WHERE (status <> 'CANCELLED');
