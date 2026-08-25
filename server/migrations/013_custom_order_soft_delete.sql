ALTER TABLE custom_order_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE custom_order_requests ADD COLUMN IF NOT EXISTS purge_protected BOOLEAN NOT NULL DEFAULT false;
