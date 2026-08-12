const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { sendMail } = require("../email");

const router = express.Router();

function formatOrderRef(id) {
  return `PTL-${String(id).padStart(6, "0")}`;
}

function parseDateRange(query) {
  const from = query.from ? new Date(`${query.from}T00:00:00Z`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59Z`) : null;
  return { from, to };
}

router.post("/orders", async (req, res) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    delivery_address = "",
    notes = "",
    items
  } = req.body;

  if (!customer_name || !customer_email || !customer_phone) {
    return res.status(400).json({ error: "Name, email, and phone are required" });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Order must include at least one item" });
  }

  const ids = items.map((i) => Number(i.id));
  const { rows: products } = await pool.query(
    "SELECT id, name, price, discount_percent FROM products WHERE id = ANY($1) AND active = true",
    [ids]
  );

  if (!products.length) {
    return res.status(400).json({ error: "None of the items in this order are available" });
  }

  const lineItems = items
    .map((item) => {
      const product = products.find((p) => p.id === Number(item.id));
      if (!product) return null;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.round(product.price * (1 - product.discount_percent / 100));
      return { name: product.name, unitPrice, quantity };
    })
    .filter(Boolean);

  const subtotal = lineItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = subtotal;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_address, notes, subtotal, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [customer_name, customer_email, customer_phone, delivery_address, notes, subtotal, total]
    );
    const orderId = orderRows[0].id;

    for (const item of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.name, item.unitPrice, item.quantity]
      );
    }

    await client.query("COMMIT");

    const orderRef = formatOrderRef(orderId);
    const itemLines = lineItems.map((i) => `- ${i.name} x${i.quantity} (₹${i.unitPrice} each)`).join("\n");

    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
    try {
      await Promise.all(
        adminEmails.map((to) =>
          sendMail({
            to,
            subject: `New order ${orderRef} — ₹${total}`,
            text: `New order from ${customer_name} (${customer_email}, ${customer_phone}).\n\nItems:\n${itemLines}\n\nTotal: ₹${total}\n\nDelivery address: ${delivery_address}\nNotes: ${notes || "—"}`
          })
        )
      );
    } catch (emailErr) {
      console.error("Order notification email failed:", emailErr.message);
    }

    try {
      await sendMail({
        to: customer_email,
        subject: `Your PETALÉA order ${orderRef} is confirmed`,
        text: `Hi ${customer_name},\n\nThank you for your order! Your order reference is ${orderRef} — keep this for any questions about your order.\n\nItems:\n${itemLines}\n\nTotal: ₹${total}\n\nDelivery address: ${delivery_address}\n\nWe'll be in touch shortly to confirm delivery and payment.\n\n— PETALÉA`
      });
    } catch (emailErr) {
      console.error("Customer confirmation email failed:", emailErr.message);
    }

    res.status(201).json({ ok: true, orderId, orderRef, total });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not place order" });
  } finally {
    client.release();
  }
});

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`o.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`o.created_at <= $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`o.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: orders } = await pool.query(
    `SELECT * FROM orders o ${where} ORDER BY o.created_at DESC`,
    params
  );

  if (!orders.length) return res.json([]);

  const orderIds = orders.map((o) => o.id);
  const { rows: items } = await pool.query(
    "SELECT * FROM order_items WHERE order_id = ANY($1)",
    [orderIds]
  );

  const itemsByOrder = items.reduce((acc, item) => {
    (acc[item.order_id] = acc[item.order_id] || []).push(item);
    return acc;
  }, {});

  res.json(orders.map((o) => ({ ...o, orderRef: formatOrderRef(o.id), items: itemsByOrder[o.id] || [] })));
});

const VALID_STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];

router.put("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, tracking_number = "", refund_amount, refund_note = "" } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (status === "shipped" && !tracking_number.trim()) {
    return res.status(400).json({ error: "Tracking number is required when marking as shipped" });
  }

  const refundAmountNum = Number(refund_amount) || 0;
  const refundStatus = status === "cancelled" && refundAmountNum > 0 ? "refunded" : undefined;

  const { rows } = await pool.query(
    `UPDATE orders SET
       status = $1,
       tracking_number = COALESCE(NULLIF($2, ''), tracking_number),
       refund_amount = CASE WHEN $3 THEN $4 ELSE refund_amount END,
       refund_note = CASE WHEN $3 THEN $5 ELSE refund_note END,
       refund_status = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE refund_status END
     WHERE id = $7 RETURNING *`,
    [status, tracking_number, status === "cancelled", refundAmountNum, refund_note, refundStatus ?? null, id]
  );

  const order = rows[0];
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const orderRef = formatOrderRef(order.id);
  const refundLine = order.refund_amount > 0
    ? `\n\nA refund of ₹${order.refund_amount} will be processed${order.refund_note ? ` (${order.refund_note})` : ""}.`
    : "";

  const emailByStatus = {
    confirmed: {
      subject: `Your PETALÉA order ${orderRef} is confirmed`,
      text: `Hi ${order.customer_name},\n\nYour order (${orderRef}) has been confirmed and we're getting it ready.\n\n— PETALÉA`
    },
    shipped: {
      subject: `Your PETALÉA order ${orderRef} has shipped`,
      text: `Hi ${order.customer_name},\n\nGreat news — your order is on its way!\n\nTracking number: ${order.tracking_number}\n\nOrder reference: ${orderRef}\n\n— PETALÉA`
    },
    completed: {
      subject: `Your PETALÉA order ${orderRef} has been delivered`,
      text: `Hi ${order.customer_name},\n\nYour order (${orderRef}) has been marked as delivered. We hope you love it!\n\nThank you for shopping with PETALÉA.\n\n— PETALÉA`
    },
    cancelled: {
      subject: `Your PETALÉA order ${orderRef} has been cancelled`,
      text: `Hi ${order.customer_name},\n\nYour order (${orderRef}) has been cancelled. If this wasn't expected or you have any questions, please reply to this email and we'll sort it out.${refundLine}\n\nWe're sorry for the inconvenience.\n\n— PETALÉA`
    }
  };

  const emailContent = emailByStatus[status];
  if (emailContent) {
    try {
      await sendMail({ to: order.customer_email, ...emailContent });
    } catch (emailErr) {
      console.error("Status update email failed:", emailErr.message);
    }
  }

  res.json({ ...order, orderRef });
});

router.get("/orders/lookup", async (req, res) => {
  const ref = String(req.query.ref || "").trim().toUpperCase();
  const email = String(req.query.email || "").trim().toLowerCase();
  const match = ref.match(/^PTL-(\d+)$/);

  if (!match || !email) {
    return res.status(400).json({ error: "Enter a valid order reference and email" });
  }

  const { rows } = await pool.query(
    "SELECT * FROM orders WHERE id = $1 AND lower(customer_email) = $2",
    [Number(match[1]), email]
  );

  const order = rows[0];
  if (!order) {
    return res.status(404).json({ error: "No matching order found. Check your reference and email." });
  }

  const { rows: items } = await pool.query(
    "SELECT product_name, unit_price, quantity FROM order_items WHERE order_id = $1",
    [order.id]
  );

  res.json({
    orderRef: formatOrderRef(order.id),
    status: order.status,
    tracking_number: order.tracking_number,
    total: order.total,
    created_at: order.created_at,
    refund_status: order.refund_status,
    refund_amount: order.refund_amount,
    items
  });
});

router.get("/admin/reports/summary", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: totals } = await pool.query(
    `SELECT COUNT(*)::int AS order_count, COALESCE(SUM(total), 0)::int AS total_revenue
     FROM orders ${where}`,
    params
  );

  const { rows: topProducts } = await pool.query(
    `SELECT oi.product_name, SUM(oi.quantity)::int AS quantity, SUM(oi.unit_price * oi.quantity)::int AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     ${where}
     GROUP BY oi.product_name
     ORDER BY revenue DESC
     LIMIT 5`,
    params
  );

  res.json({ ...totals[0], topProducts });
});

router.get("/admin/reports/export.csv", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: orders } = await pool.query(
    `SELECT id, created_at, customer_name, customer_email, customer_phone, subtotal, total, payment_status, status, tracking_number, refund_status, refund_amount, refund_note
     FROM orders ${where} ORDER BY created_at DESC`,
    params
  );

  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Order Ref", "Date", "Name", "Email", "Phone", "Subtotal", "Total", "Payment Status", "Order Status", "Tracking Number", "Refund Status", "Refund Amount", "Refund Note"];
  const lines = [header.join(",")];

  for (const o of orders) {
    lines.push(
      [formatOrderRef(o.id), o.created_at.toISOString(), o.customer_name, o.customer_email, o.customer_phone, o.subtotal, o.total, o.payment_status, o.status, o.tracking_number, o.refund_status, o.refund_amount, o.refund_note]
        .map(escape)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=petalea-orders.csv");
  res.send(lines.join("\n"));
});

module.exports = router;
