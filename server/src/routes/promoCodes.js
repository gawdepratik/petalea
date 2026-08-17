const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router.get("/admin/promo-codes", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
  res.json(rows);
});

router.post("/admin/promo-codes", requireAdmin, async (req, res) => {
  const { code, discount_type, discount_value, max_uses, expires_at, active = true } = req.body;

  if (!code || !["flat", "percent"].includes(discount_type) || !Number.isFinite(Number(discount_value))) {
    return res.status(400).json({ error: "code, discount_type (flat/percent), and discount_value are required" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at, active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code.trim().toUpperCase(), discount_type, discount_value, max_uses || null, expires_at || null, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A promo code with that name already exists" });
    }
    throw err;
  }
});

router.put("/admin/promo-codes/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, discount_type, discount_value, max_uses, expires_at, active } = req.body;

  const { rows } = await pool.query(
    `UPDATE promo_codes SET
       code = COALESCE($1, code),
       discount_type = COALESCE($2, discount_type),
       discount_value = COALESCE($3, discount_value),
       max_uses = $4,
       expires_at = $5,
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING *`,
    [code ? code.trim().toUpperCase() : null, discount_type, discount_value, max_uses || null, expires_at || null, active, id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  res.json(rows[0]);
});

router.delete("/admin/promo-codes/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rowCount } = await pool.query("DELETE FROM promo_codes WHERE id = $1", [id]);
  if (!rowCount) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  res.status(204).send();
});

router.get("/promo-codes/validate", async (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  const subtotal = Number(req.query.subtotal) || 0;

  if (!code) {
    return res.status(400).json({ error: "Enter a promo code" });
  }

  const { rows } = await pool.query(
    `SELECT * FROM promo_codes
     WHERE code = $1 AND active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR used_count < max_uses)`,
    [code]
  );

  const promo = rows[0];
  if (!promo) {
    return res.status(404).json({ error: "That promo code is invalid, expired, or fully redeemed." });
  }

  const discountAmount = promo.discount_type === "flat"
    ? Math.min(promo.discount_value, subtotal)
    : Math.round(subtotal * (promo.discount_value / 100));

  res.json({
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discountAmount
  });
});

module.exports = router;
