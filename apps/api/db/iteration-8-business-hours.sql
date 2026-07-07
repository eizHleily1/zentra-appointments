CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, day_of_week),
  CHECK (
    (is_closed = true AND open_time IS NULL AND close_time IS NULL)
    OR (
      is_closed = false
      AND open_time IS NOT NULL
      AND close_time IS NOT NULL
      AND close_time > open_time
    )
  )
);

CREATE INDEX IF NOT EXISTS business_hours_business_id_idx ON business_hours (business_id);
