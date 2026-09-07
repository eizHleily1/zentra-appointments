-- Guest and owner bookings may use the same phone number for different people
-- (for example a parent and a child). Identity is business + normalized phone +
-- normalized display name, not phone alone.

BEGIN;

DROP INDEX IF EXISTS clients_active_normalized_phone_per_business_idx;

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_normalized_phone_and_name_per_business_idx
ON clients (
  business_id,
  regexp_replace(phone_number, '[^0-9]', '', 'g'),
  lower(btrim(display_name))
)
WHERE active = true AND phone_number IS NOT NULL AND btrim(phone_number) <> '';

COMMIT;
