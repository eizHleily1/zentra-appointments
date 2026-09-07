-- Client identity matching and uniqueness must fold names in PostgreSQL, not in
-- JavaScript. The two engines case-fold some Unicode differently (Turkish "İpek"
-- is the usual example), and a JS-folded lookup against these indexes misses the
-- row, then the insert hits the unique constraint and the retry cannot find the
-- winner — which surfaces as a 500.
--
-- One IMMUTABLE function is the canonical rule for both indexes and lookups.
-- Display names are still stored exactly as entered.

BEGIN;

CREATE OR REPLACE FUNCTION normalize_client_display_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT lower(btrim(value));
$$;

DROP INDEX IF EXISTS clients_active_unlinked_phone_and_name_per_business_idx;
DROP INDEX IF EXISTS clients_active_linked_phone_and_name_per_business_idx;

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_unlinked_phone_and_name_per_business_idx
ON clients (
  business_id,
  regexp_replace(phone_number, '[^0-9]', '', 'g'),
  normalize_client_display_name(display_name)
)
WHERE active = true
  AND linked_user_id IS NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_linked_phone_and_name_per_business_idx
ON clients (
  business_id,
  regexp_replace(phone_number, '[^0-9]', '', 'g'),
  normalize_client_display_name(display_name)
)
WHERE active = true
  AND linked_user_id IS NOT NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> '';

COMMIT;
