INSERT INTO products (name, description, price, image_url, featured) VALUES
  ('Blush Bloom Bouquet', 'Soft blush & ivory tones', 1299, 'images/Blush Bloom Bouquet.png', true),
  ('Lavender Meadow', 'Dreamy lavender arrangement', 1499, 'images/Lavender Meadow.png', true),
  ('Petite Forever Bloom', 'A little bloom for a little joy', 699, 'images/Petite Forever Bloom.png', true),
  ('Little Rose Affair', 'A petite arrangement for someone special', 699, 'images/Rose.jpg', true),
  ('Pearl Petals', 'Elegant ivory blooms with a delicate glow', 699, 'images/Pearl Petals.jpg', true),
  ('Pastel Daydream', 'Soft, romantic petals that last', 699, 'images/Pastel Daydream.jpg', true),
  ('Golden Meadow Bouquet', 'Warm golds & amber tones', 1199, 'ph-1', false),
  ('Sage Whisper', 'Soft sage with a touch of cream', 899, 'ph-2', false),
  ('Terracotta Bloom', 'Bold terracotta with rustic charm', 1099, 'ph-3', false),
  ('Velvet Anemone', 'Deep rose velvet petals', 1349, 'ph-4', false),
  ('Moonlit Peony', 'Ivory peonies with a silver hush', 1599, 'ph-5', false),
  ('Cottage Garden Mix', 'A wild, garden-picked medley', 999, 'ph-6', false)
ON CONFLICT DO NOTHING;
