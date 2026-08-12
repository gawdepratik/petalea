const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

const PUBLIC_COLUMNS = "id, name, description, price, discount_percent, image_url, featured, category";

router.get("/products", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM products WHERE active = true ORDER BY id ASC`
  );
  res.json(rows);
});

router.get("/admin/products", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY id ASC");
  res.json(rows);
});

router.post("/admin/products", requireAdmin, async (req, res) => {
  const { name, description = "", price, discount_percent = 0, image_url = "", featured = false, active = true, category = "" } = req.body;

  if (!name || !Number.isFinite(Number(price))) {
    return res.status(400).json({ error: "name and price are required" });
  }

  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price, discount_percent, image_url, featured, active, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, description, price, discount_percent, image_url, featured, active, category]
  );
  res.status(201).json(rows[0]);
});

router.put("/admin/products/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, discount_percent, image_url, featured, active, category } = req.body;

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
       updated_at = now()
     WHERE id = $9 RETURNING *`,
    [name, description, price, discount_percent, image_url, featured, active, category, id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.json(rows[0]);
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
