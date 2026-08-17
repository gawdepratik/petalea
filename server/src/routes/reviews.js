const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { sendMail } = require("../email");

const router = express.Router();

router.get("/products/:id/reviews", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT customer_name, rating, review_text, created_at
     FROM reviews WHERE product_id = $1 AND status = 'approved'
     ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
});

router.post("/products/:id/reviews", async (req, res) => {
  const productId = Number(req.params.id);
  const { customer_name, customer_email, rating, review_text } = req.body;
  const ratingNum = Number(rating);

  if (!customer_name || !customer_email || !review_text || !review_text.trim()) {
    return res.status(400).json({ error: "Name, email, and a review are required" });
  }
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  const { rows: purchaseRows } = await pool.query(
    `SELECT 1 FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE lower(o.customer_email) = lower($1) AND oi.product_id = $2 AND o.status != 'cancelled'
     LIMIT 1`,
    [customer_email, productId]
  );

  if (!purchaseRows.length) {
    return res.status(403).json({ error: "Only customers who have purchased this product can leave a review." });
  }

  const { rows } = await pool.query(
    `INSERT INTO reviews (product_id, customer_name, customer_email, rating, review_text)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [productId, customer_name, customer_email, ratingNum, review_text.trim()]
  );

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  try {
    await Promise.all(
      adminEmails.map((to) =>
        sendMail({
          to,
          subject: `New review awaiting approval`,
          text: `${customer_name} left a ${ratingNum}-star review:\n\n"${review_text.trim()}"\n\nLog into the admin panel to approve or reject it.`
        })
      )
    );
  } catch (emailErr) {
    console.error("Review notification email failed:", emailErr.message);
  }

  res.status(201).json({ ok: true, review: rows[0] });
});

router.get("/admin/reviews", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, p.name AS product_name
     FROM reviews r JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC`
  );
  res.json(rows);
});

router.put("/admin/reviews/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const { rows } = await pool.query(
    "UPDATE reviews SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.json(rows[0]);
});

module.exports = router;
