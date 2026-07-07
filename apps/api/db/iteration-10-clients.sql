CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone_number text,
  email text,
  linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_normalized_phone_per_business_idx
ON clients (business_id, regexp_replace(phone_number, '[^0-9]', '', 'g'))
WHERE active = true AND phone_number IS NOT NULL AND btrim(phone_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_linked_user_per_business_idx
ON clients (business_id, linked_user_id)
WHERE linked_user_id IS NOT NULL;
