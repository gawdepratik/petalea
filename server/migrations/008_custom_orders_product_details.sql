CREATE TABLE IF NOT EXISTS custom_order_requests (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  occasion TEXT NOT NULL DEFAULT '',
  flower_preferences TEXT NOT NULL DEFAULT '',
  budget_range TEXT NOT NULL DEFAULT '',
  delivery_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_order_requests_status ON custom_order_requests (status);

ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_images TEXT[] NOT NULL DEFAULT '{}';
