ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS client_display_name text;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS client_phone_number text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'client_user_id'
  ) THEN
    INSERT INTO clients (id, business_id, display_name, linked_user_id, active)
    SELECT
      gen_random_uuid(),
      pairs.business_id,
      COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'Customer'),
      pairs.client_user_id,
      true
    FROM (
      SELECT DISTINCT business_id, client_user_id
      FROM appointments
      WHERE client_id IS NULL
    ) pairs
    JOIN users u ON u.id = pairs.client_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM clients existing_client
      WHERE existing_client.business_id = pairs.business_id
        AND existing_client.linked_user_id = pairs.client_user_id
    );

    UPDATE appointments appointment
    SET
      client_id = client.id,
      client_display_name = client.display_name,
      client_phone_number = client.phone_number
    FROM clients client
    WHERE appointment.client_id IS NULL
      AND client.business_id = appointment.business_id
      AND client.linked_user_id = appointment.client_user_id;

    ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS appointments_client_user_id_fkey;

    ALTER TABLE appointments
    DROP COLUMN client_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'client_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE appointments
    ALTER COLUMN client_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'client_display_name'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE appointments
    ALTER COLUMN client_display_name SET NOT NULL;
  END IF;
END $$;
