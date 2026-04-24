-- Add foreign-key constraint from admin_activity_logs.admin_id → admins.id
-- Use ON DELETE SET NULL so log entries are preserved if an admin account is deleted.
ALTER TABLE admin_activity_logs
  ADD CONSTRAINT fk_activity_log_admin
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;
