-- Public guest booking requires a verified phone number. A challenge is scoped to
-- business + normalized phone only, never to a display name, because one verified
-- phone may book for different people (for example a parent and a child).

BEGIN;

CREATE TABLE IF NOT EXISTS booking_phone_verifications (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  normalized_phone text NOT NULL CHECK (normalized_phone <> ''),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_remaining integer NOT NULL CHECK (attempts_remaining >= 0),
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (consumed_at IS NULL OR verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS booking_phone_verifications_business_phone_idx
ON booking_phone_verifications (business_id, normalized_phone, created_at DESC);

-- Anonymous booking may only reuse unlinked guest clients. Splitting the identity
-- index by linked_user_id lets a signed-up customer and a separate guest record
-- share business + phone + name without colliding.
DROP INDEX IF EXISTS clients_active_normalized_phone_and_name_per_business_idx;

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_unlinked_phone_and_name_per_business_idx
ON clients (
  business_id,
  regexp_replace(phone_number, '[^0-9]', '', 'g'),
  lower(btrim(display_name))
)
WHERE active = true
  AND linked_user_id IS NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_linked_phone_and_name_per_business_idx
ON clients (
  business_id,
  regexp_replace(phone_number, '[^0-9]', '', 'g'),
  lower(btrim(display_name))
)
WHERE active = true
  AND linked_user_id IS NOT NULL
  AND phone_number IS NOT NULL
  AND btrim(phone_number) <> '';

COMMIT;
