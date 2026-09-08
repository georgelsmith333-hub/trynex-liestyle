-- Durable, server-authoritative Spin & Win ledger.
-- One daily spin is represented by a daily grant event; completed products
-- grant exactly three ticket units per product through an idempotent source key.
-- This migration is intentionally review-only and is not applied by this task.

CREATE TABLE IF NOT EXISTS spin_wallets (
  id serial PRIMARY KEY,
  subject_key text NOT NULL UNIQUE,
  customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
  guest_token_hash text UNIQUE,
  free_tickets integer NOT NULL DEFAULT 0,
  daily_spin_claimed_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT spin_wallets_free_tickets_check CHECK (free_tickets >= 0)
);
CREATE INDEX IF NOT EXISTS spin_wallets_customer_id_idx ON spin_wallets(customer_id);
CREATE INDEX IF NOT EXISTS spin_wallets_guest_token_hash_idx ON spin_wallets(guest_token_hash);

CREATE TABLE IF NOT EXISTS spin_entitlement_events (
  id serial PRIMARY KEY,
  subject_key text NOT NULL,
  customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
  order_id integer REFERENCES orders(id) ON DELETE SET NULL,
  source_key text NOT NULL UNIQUE,
  source_type text NOT NULL,
  quantity integer NOT NULL,
  direction text NOT NULL DEFAULT 'grant',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT spin_entitlement_events_quantity_check CHECK (quantity > 0),
  CONSTRAINT spin_entitlement_events_source_type_check CHECK (source_type IN ('daily', 'purchase', 'manual')),
  CONSTRAINT spin_entitlement_events_direction_check CHECK (direction IN ('grant', 'reversal'))
);
CREATE INDEX IF NOT EXISTS spin_entitlement_events_subject_key_idx ON spin_entitlement_events(subject_key);
CREATE INDEX IF NOT EXISTS spin_entitlement_events_order_id_idx ON spin_entitlement_events(order_id);

CREATE TABLE IF NOT EXISTS spin_plays (
  id serial PRIMARY KEY,
  subject_key text NOT NULL,
  customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  entitlement_type text NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  reward_code text,
  reward_payload jsonb,
  created_at timestamp NOT NULL DEFAULT NOW(),
  settled_at timestamp,
  CONSTRAINT spin_plays_status_check CHECK (status IN ('reserved', 'settled', 'failed', 'cancelled')),
  CONSTRAINT spin_plays_entitlement_type_check CHECK (entitlement_type IN ('daily', 'ticket'))
);
CREATE INDEX IF NOT EXISTS spin_plays_subject_key_idx ON spin_plays(subject_key);

CREATE INDEX IF NOT EXISTS spin_plays_reserved_subject_idx
  ON spin_plays(subject_key) WHERE status = 'reserved';
