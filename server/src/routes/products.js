const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { sendMail } = require("../email");

const router = express.Router();

router.get("/products", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.price, p.discount_percent, p.image_url, p.featured, p.category, p.stock_quantity,
            COALESCE(r.avg_rating, 0)::float AS avg_rating, COALESCE(r.review_count, 0)::int AS review_count
     FROM products p
     LEFT JOIN (
       SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
       FROM reviews WHERE status = 'approved'
       GROUP BY product_id
     ) r ON r.product_id = p.id
     WHERE p.active = true
     ORDER BY p.id ASC`
  );
  res.json(rows);
});

router.get("/admin/products", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY id ASC");
  res.json(rows);
});

router.post("/admin/products", requireAdmin, async (req, res) => {
  const {
    name, description = "", price, discount_percent = 0, image_url = "", featured = false,
    active = true, category = "", stock_quantity = null
  } = req.body;

  if (!name || !Number.isFinite(Number(price))) {
    return res.status(400).json({ error: "name and price are required" });
  }

  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price, discount_percent, image_url, featured, active, category, stock_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name, description, price, discount_percent, image_url, featured, active, category, stock_quantity]
  );
  res.status(201).json(rows[0]);
});

router.put("/admin/products/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, discount_percent, image_url, featured, active, category, stock_quantity } = req.body;

  const { rows: beforeRows } = await pool.query("SELECT stock_quantity FROM products WHERE id = $1", [id]);
  const wasOutOfStock = beforeRows[0] && beforeRows[0].stock_quantity !== null && beforeRows[0].stock_quantity <= 0;

  const { rows } = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       price = COALESCE($3, price),
       discount_percent = COALESCE($4, discount_percent),
       image_url = COALESCE($5, image_url),
       featured = COALESCE($6, featured),
       active = COALESCE($7, active),
       category = COALESCE($8, category),
       stock_quantity = $9,
       updated_at = now()
     WHERE id = $10 RETURNING *`,
    [name, description, price, discount_percent, image_url, featured, active, category, stock_quantity, id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Product not found" });
  }

  const nowInStock = rows[0].stock_quantity === null || rows[0].stock_quantity > 0;
  if (wasOutOfStock && nowInStock) {
    const { rows: subscribers } = await pool.query(
      "SELECT id, email FROM stock_notifications WHERE product_id = $1 AND notified = false",
      [id]
    );
    if (subscribers.length) {
      try {
        await Promise.all(
          subscribers.map((s) =>
            sendMail({
              to: s.email,
              subject: `${rows[0].name} is back in stock!`,
              text: `Good news — "${rows[0].name}" is back in stock at PETALÉA.\n\nShop now before it sells out again: https://petalea.in/collection.html\n\n— PETALÉA`
            })
          )
        );
        await pool.query(
          "UPDATE stock_notifications SET notified = true WHERE product_id = $1 AND notified = false",
          [id]
        );
      } catch (emailErr) {
        console.error("Back-in-stock email failed:", emailErr.message);
      }
    }
  }

  res.json(rows[0]);
});

router.post("/products/:id/notify-restock", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  await pool.query(
    "INSERT INTO stock_notifications (product_id, email) VALUES ($1, $2)",
    [req.params.id, email.trim().toLowerCase()]
  );
  res.status(201).json({ ok: true });
});

router.delete("/admin/products/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [id]);
  if (!rowCount) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.status(204).send();
});

module.exports = router;
