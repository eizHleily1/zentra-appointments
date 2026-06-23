CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  business_type text NOT NULL CHECK (
    business_type IN (
      'BARBER',
      'SALON',
      'NAIL_ARTIST',
      'THERAPIST',
      'CLINIC',
      'COACH',
      'PERSONAL_TRAINER',
      'CONSULTANT',
      'OTHER'
    )
  ),
  timezone text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING_ONBOARDING', 'ACTIVE', 'DEACTIVATED')),
  initial_owner_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_initial_owner_user_id_idx
ON tenants(initial_owner_user_id);
