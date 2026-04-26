-- Add TOTP 2FA columns to admins table
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Customer password reset tokens table
CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cprt_customer ON customer_password_reset_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_cprt_expires ON customer_password_reset_tokens(expires_at);
