CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'STAFF', 'CLIENT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_owner_per_business_idx
ON memberships(business_id)
WHERE role = 'OWNER';

CREATE INDEX IF NOT EXISTS memberships_user_id_idx
ON memberships(user_id);

CREATE INDEX IF NOT EXISTS memberships_business_id_idx
ON memberships(business_id);
