ALTER TABLE services
ALTER COLUMN price DROP NOT NULL;

ALTER TABLE services
DROP CONSTRAINT IF EXISTS services_price_check;

ALTER TABLE services
ADD CONSTRAINT services_price_check CHECK (price IS NULL OR price >= 0);

ALTER TABLE appointments
ALTER COLUMN service_price DROP NOT NULL;

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_service_price_check;

ALTER TABLE appointments
ADD CONSTRAINT appointments_service_price_check CHECK (service_price IS NULL OR service_price >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS services_active_normalized_name_per_business_idx
ON services (business_id, lower(btrim(name)))
WHERE active = true;
