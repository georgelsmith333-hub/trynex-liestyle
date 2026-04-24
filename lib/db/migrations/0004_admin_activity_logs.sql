-- Admin activity log table: records every admin mutation with before/after snapshots
-- Supports filtering, pagination, and one-click rollback for update/delete actions.
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER,
  action      TEXT NOT NULL,         -- create | update | delete | rollback
  entity      TEXT NOT NULL,         -- product | order | blog | category | setting | hamper | promo | review
  entity_id   TEXT,
  entity_name TEXT,
  before      JSONB,
  after       JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON admin_activity_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON admin_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action  ON admin_activity_logs (action);
