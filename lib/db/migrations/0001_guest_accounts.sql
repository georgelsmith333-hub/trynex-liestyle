-- Guest account columns + race-safe partial unique index.
-- Idempotent: safe to run multiple times.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS guest_sequence integer;
CREATE UNIQUE INDEX IF NOT EXISTS customers_guest_sequence_unique
  ON customers (guest_sequence)
  WHERE guest_sequence IS NOT NULL;
