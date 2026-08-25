const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { sendMail } = require("../email");

const router = express.Router();

router.post("/custom-orders", async (req, res) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    occasion = "",
    flower_preferences = "",
    budget_range = "",
    delivery_date = null,
    notes = ""
  } = req.body;

  if (!customer_name || !customer_email || !customer_phone) {
    return res.status(400).json({ error: "Name, email, and phone are required" });
  }

  const { rows } = await pool.query(
    `INSERT INTO custom_order_requests
       (customer_name, customer_email, customer_phone, occasion, flower_preferences, budget_range, delivery_date, notes, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      customer_name.trim(),
      customer_email.trim(),
      customer_phone.trim(),
      occasion.trim(),
      flower_preferences.trim(),
      budget_range.trim(),
      delivery_date || null,
      notes.trim(),
      req.ip
    ]
  );

  const request = rows[0];
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  const summary = `New custom order request from ${request.customer_name}

Email: ${request.customer_email}
Phone: ${request.customer_phone}
Occasion: ${request.occasion || "—"}
Budget: ${request.budget_range || "—"}
Preferred delivery date: ${request.delivery_date ? new Date(request.delivery_date).toLocaleDateString("en-IN") : "—"}

Flower / color preferences:
${request.flower_preferences || "—"}

Additional notes:
${request.notes || "—"}

Log into the admin panel to view and manage this request.`;

  try {
    await Promise.all(
      adminEmails.map((to) => sendMail({ to, subject: `New custom order request from ${request.customer_name}`, text: summary }))
    );
    await sendMail({
      to: request.customer_email,
      subject: "We've received your custom order request — PETALÉA",
      text: `Hi ${request.customer_name},\n\nThank you for sharing your custom order idea with us! We've received your request and will reach out shortly to discuss details and pricing.\n\n— PETALÉA`
    });
  } catch (emailErr) {
    console.error("Custom order notification email failed:", emailErr.message);
  }

  res.status(201).json({ ok: true, request });
});

router.get("/admin/custom-orders", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM custom_order_requests
     WHERE deleted_at IS ${req.query.deleted === "true" ? "NOT NULL" : "NULL"}
     ORDER BY created_at DESC`
  );
  res.json(rows);
});

router.put("/admin/custom-orders/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["new", "contacted", "completed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const { rows } = await pool.query(
    "UPDATE custom_order_requests SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Request not found" });
  }
  res.json(rows[0]);
});

router.delete("/admin/custom-orders/:id", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE custom_order_requests SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Request not found, or already deleted" });
  }
  res.json({ ok: true });
});

router.post("/admin/custom-orders/:id/restore", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE custom_order_requests SET deleted_at = NULL, purge_protected = false WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Request not found, or it isn't deleted" });
  }
  res.json(rows[0]);
});

router.put("/admin/custom-orders/:id/purge-protection", requireAdmin, async (req, res) => {
  const { protect } = req.body;
  const { rows } = await pool.query(
    "UPDATE custom_order_requests SET purge_protected = $1 WHERE id = $2 AND deleted_at IS NOT NULL RETURNING *",
    [!!protect, req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Request not found, or it isn't deleted" });
  }
  res.json(rows[0]);
});

const CUSTOM_ORDER_PURGE_AFTER_HOURS = 48;

async function purgeExpiredCustomOrderRequests() {
  const { rows } = await pool.query(
    `DELETE FROM custom_order_requests
     WHERE deleted_at IS NOT NULL
       AND deleted_at < now() - interval '${CUSTOM_ORDER_PURGE_AFTER_HOURS} hours'
       AND purge_protected = false
     RETURNING id`
  );
  if (rows.length) {
    console.log(`Purged ${rows.length} expired deleted custom order request(s): ${rows.map((r) => r.id).join(", ")}`);
  }
  return rows.length;
}

module.exports = router;
module.exports.purgeExpiredCustomOrderRequests = purgeExpiredCustomOrderRequests;
