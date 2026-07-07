ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS booking_interval_minutes integer NOT NULL DEFAULT 15
CHECK (booking_interval_minutes IN (5, 10, 15, 20, 30, 60));
