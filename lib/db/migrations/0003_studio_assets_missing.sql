-- Track when an order is missing one or more customer-uploaded design files
-- because they failed to copy from the temp staging area into the order's
-- permanent folder. The order is still created, but admins must follow up
-- to recover the source artwork from the customer.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS studio_assets_missing BOOLEAN NOT NULL DEFAULT false;
