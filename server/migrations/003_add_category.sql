ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

UPDATE products SET category = 'Bouquets' WHERE category = '';
