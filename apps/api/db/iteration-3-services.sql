CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_business_id_idx
ON services(business_id);
