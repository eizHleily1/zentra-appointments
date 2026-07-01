CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  staff_member_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('BOOKED', 'CANCELLED', 'COMPLETED')),
  service_name text NOT NULL,
  service_duration_minutes integer NOT NULL CHECK (service_duration_minutes > 0),
  service_price numeric(10, 2) NOT NULL CHECK (service_price >= 0),
  staff_display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS appointments_business_id_idx
ON appointments(business_id);

CREATE INDEX IF NOT EXISTS appointments_client_user_id_idx
ON appointments(client_user_id);

CREATE INDEX IF NOT EXISTS appointments_staff_member_id_idx
ON appointments(staff_member_id);

CREATE INDEX IF NOT EXISTS appointments_service_id_idx
ON appointments(service_id);
