const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { sendMail } = require("../email");

const router = express.Router();

function formatOrderRef(id) {
  return `PTL-${String(id).padStart(6, "0")}`;
}

function formatDeliveryDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null;
}

function parseDateRange(query) {
  const from = query.from ? new Date(`${query.from}T00:00:00Z`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59Z`) : null;
  return { from, to };
}

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function createOrder({
  customer_name,
  customer_email,
  customer_phone,
  delivery_address = "",
  delivery_date = null,
  city = "",
  pincode = "",
  notes = "",
  gift_message = "",
  items,
  promo_code = "",
  payment_status = "unpaid",
  ip_address = null
}) {
  if (!customer_name || !customer_email || !customer_phone) {
    throw badRequest("Name, email, and phone are required");
  }
  if (!Array.isArray(items) || !items.length) {
    throw badRequest("Order must include at least one item");
  }

  const ids = items.map((i) => Number(i.id));
  const { rows: products } = await pool.query(
    "SELECT id, name, price, discount_percent, stock_quantity FROM products WHERE id = ANY($1) AND active = true",
    [ids]
  );
  if (!products.length) {
    throw badRequest("None of the items in this order are available");
  }

  const lineItems = items
    .map((item) => {
      const product = products.find((p) => p.id === Number(item.id));
      if (!product) return null;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.round(product.price * (1 - product.discount_percent / 100));
      return {
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity,
        stockQuantity: product.stock_quantity
      };
    })
    .filter(Boolean);

  for (const item of lineItems) {
    if (item.stockQuantity !== null && item.quantity > item.stockQuantity) {
      throw badRequest(`${item.name} only has ${item.stockQuantity} left in stock`);
    }
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let discountAmount = 0;
    let appliedPromoCode = null;

    if (promo_code && promo_code.trim()) {
      const code = promo_code.trim().toUpperCase();
      const { rows: promoRows } = await client.query(
        `UPDATE promo_codes SET used_count = used_count + 1
         WHERE code = $1 AND active = true
           AND (expires_at IS NULL OR expires_at > now())
           AND (max_uses IS NULL OR used_count < max_uses)
         RETURNING *`,
        [code]
      );
      if (!promoRows[0]) {
        throw badRequest("That promo code is invalid, expired, or fully redeemed.");
      }
      const promo = promoRows[0];
      discountAmount = promo.discount_type === "flat"
        ? Math.min(promo.discount_value, subtotal)
        : Math.round(subtotal * (promo.discount_value / 100));
      appliedPromoCode = promo.code;
    }

    const total = Math.max(0, subtotal - discountAmount);

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_address, delivery_date, city, pincode, notes, gift_message, subtotal, total, promo_code, discount_amount, payment_status, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [customer_name, customer_email, customer_phone, delivery_address, delivery_date || null, city.trim(), pincode.trim(), notes, gift_message, subtotal, total, appliedPromoCode, discountAmount, payment_status, ip_address]
    );
    const orderId = orderRows[0].id;

    for (const item of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.productId, item.name, item.unitPrice, item.quantity]
      );

      if (item.stockQuantity !== null) {
        const { rows: stockRows } = await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1
           WHERE id = $2 AND stock_quantity >= $1
           RETURNING stock_quantity`,
          [item.quantity, item.productId]
        );
        if (!stockRows[0]) {
          throw badRequest(`${item.name} just went out of stock. Please remove it and try again.`, 409);
        }
      }
    }

    await client.query("COMMIT");
    return { orderId, subtotal, total, discountAmount, promoCode: appliedPromoCode, lineItems };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

router.post("/orders", async (req, res) => {
  let result;
  try {
    result = await createOrder({ ...req.body, ip_address: req.ip });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "Could not place order" });
  }

  const { orderId, total, discountAmount, promoCode, lineItems } = result;
  const { customer_name, customer_email, customer_phone, delivery_address = "", delivery_date = null, notes = "", gift_message = "" } = req.body;
  const orderRef = formatOrderRef(orderId);
  const itemLines = lineItems.map((i) => `- ${i.name} x${i.quantity} (₹${i.unitPrice} each)`).join("\n");
  const discountLine = discountAmount > 0 ? `\nDiscount (${promoCode}): -₹${discountAmount}` : "";
  const giftLine = gift_message.trim() ? `\nGift message: ${gift_message.trim()}` : "";
  const deliveryDateLabel = formatDeliveryDate(delivery_date);
  const deliveryDateLine = deliveryDateLabel ? `\nPreferred delivery date: ${deliveryDateLabel}` : "";

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  try {
    await Promise.all(
      adminEmails.map((to) =>
        sendMail({
          to,
          subject: `New order ${orderRef} — ₹${total}`,
          text: `New order from ${customer_name} (${customer_email}, ${customer_phone}).\n\nItems:\n${itemLines}${discountLine}\n\nTotal: ₹${total}\n\nDelivery address: ${delivery_address}${deliveryDateLine}\nNotes: ${notes || "—"}${giftLine}`
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
      text: `Hi ${customer_name},\n\nThank you for your order! Your order reference is ${orderRef} — keep this for any questions about your order.\n\nItems:\n${itemLines}${discountLine}\n\nTotal: ₹${total}\n\nDelivery address: ${delivery_address}${deliveryDateLine}\n\nWe'll be in touch shortly to confirm delivery and payment.\n\n— PETALÉA`
    });
  } catch (emailErr) {
    console.error("Customer confirmation email failed:", emailErr.message);
  }

  res.status(201).json({ ok: true, orderId, orderRef, total, discountAmount });
});

router.post("/admin/orders", requireAdmin, async (req, res) => {
  let result;
  try {
    result = await createOrder(req.body);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "Could not create order" });
  }

  const { orderId, total, discountAmount, promoCode, lineItems } = result;
  const { customer_name, customer_email, delivery_address = "", delivery_date = null } = req.body;
  const orderRef = formatOrderRef(orderId);
  const itemLines = lineItems.map((i) => `- ${i.name} x${i.quantity} (₹${i.unitPrice} each)`).join("\n");
  const discountLine = discountAmount > 0 ? `\nDiscount (${promoCode}): -₹${discountAmount}` : "";
  const deliveryDateLabel = formatDeliveryDate(delivery_date);
  const deliveryDateLine = deliveryDateLabel ? `\nPreferred delivery date: ${deliveryDateLabel}` : "";

  try {
    await sendMail({
      to: customer_email,
      subject: `Your PETALÉA order ${orderRef} is confirmed`,
      text: `Hi ${customer_name},\n\nThank you for your order! Your order reference is ${orderRef} — keep this for any questions about your order.\n\nItems:\n${itemLines}${discountLine}\n\nTotal: ₹${total}\n\nDelivery address: ${delivery_address}${deliveryDateLine}\n\nWe'll be in touch shortly to confirm delivery and payment.\n\n— PETALÉA`
    });
  } catch (emailErr) {
    console.error("Customer confirmation email failed:", emailErr.message);
  }

  res.status(201).json({ ok: true, orderId, orderRef, total, discountAmount });
});

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = [req.query.deleted === "true" ? "o.deleted_at IS NOT NULL" : "o.deleted_at IS NULL"];
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

router.put("/admin/orders/:id/notes", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_notes = "" } = req.body;

  const { rows } = await pool.query(
    "UPDATE orders SET admin_notes = $1 WHERE id = $2 RETURNING *",
    [admin_notes, id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json({ ...rows[0], orderRef: formatOrderRef(rows[0].id) });
});

router.delete("/admin/orders/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { confirm = "" } = req.body;

  const { rows: existingRows } = await pool.query(
    "SELECT id, status, deleted_at FROM orders WHERE id = $1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (existing.deleted_at) {
    return res.status(400).json({ error: "Order is already deleted" });
  }

  const expectedRef = formatOrderRef(existing.id);
  if (confirm.trim().toUpperCase() !== expectedRef) {
    return res.status(400).json({ error: `Type ${expectedRef} exactly to confirm deletion` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (existing.status !== "cancelled") {
      const { rows: orderItems } = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL",
        [id]
      );
      for (const item of orderItems) {
        await client.query(
          "UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND stock_quantity IS NOT NULL",
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query("UPDATE orders SET deleted_at = now() WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Could not delete order" });
  } finally {
    client.release();
  }

  res.json({ ok: true, orderRef: expectedRef });
});

router.post("/admin/orders/:id/restore", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE orders SET deleted_at = NULL, purge_protected = false WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Order not found, or it isn't deleted" });
  }
  res.json({ ...rows[0], orderRef: formatOrderRef(rows[0].id) });
});

router.put("/admin/orders/:id/purge-protection", requireAdmin, async (req, res) => {
  const { protect } = req.body;
  const { rows } = await pool.query(
    "UPDATE orders SET purge_protected = $1 WHERE id = $2 AND deleted_at IS NOT NULL RETURNING *",
    [!!protect, req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Order not found, or it isn't deleted" });
  }
  res.json({ ...rows[0], orderRef: formatOrderRef(rows[0].id) });
});

const PURGE_AFTER_HOURS = 48;

async function purgeExpiredDeletedOrders() {
  const { rows } = await pool.query(
    `DELETE FROM orders
     WHERE deleted_at IS NOT NULL
       AND deleted_at < now() - interval '${PURGE_AFTER_HOURS} hours'
       AND purge_protected = false
     RETURNING id`
  );
  if (rows.length) {
    console.log(`Purged ${rows.length} expired deleted order(s): ${rows.map((r) => r.id).join(", ")}`);
  }
  return rows.length;
}

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

  const { rows: existingRows } = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
  if (!existingRows[0]) {
    return res.status(404).json({ error: "Order not found" });
  }
  const wasAlreadyCancelled = existingRows[0].status === "cancelled";

  const refundAmountNum = Number(refund_amount) || 0;
  const refundStatus = status === "cancelled" && refundAmountNum > 0 ? "refunded" : undefined;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
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

    if (status === "cancelled" && !wasAlreadyCancelled) {
      const { rows: orderItems } = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL",
        [id]
      );
      for (const item of orderItems) {
        await client.query(
          "UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND stock_quantity IS NOT NULL",
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query("COMMIT");

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
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not update order status" });
  } finally {
    client.release();
  }
});

router.get("/orders/lookup", async (req, res) => {
  const ref = String(req.query.ref || "").trim().toUpperCase();
  const email = String(req.query.email || "").trim().toLowerCase();
  const match = ref.match(/^PTL-(\d+)$/);

  if (!match || !email) {
    return res.status(400).json({ error: "Enter a valid order reference and email" });
  }

  const { rows } = await pool.query(
    "SELECT * FROM orders WHERE id = $1 AND lower(customer_email) = $2 AND deleted_at IS NULL",
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
    delivery_date: order.delivery_date,
    refund_status: order.refund_status,
    refund_amount: order.refund_amount,
    items
  });
});

router.get("/admin/reports/summary", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = ["deleted_at IS NULL"];
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

  const { rows: topCitiesRaw } = await pool.query(
    `SELECT city, COUNT(*)::int AS order_count, SUM(total)::int AS revenue
     FROM orders ${where} AND city <> ''
     GROUP BY city
     ORDER BY revenue DESC
     LIMIT 8`,
    params
  );

  const totalRevenue = totals[0].total_revenue || 0;
  const topCities = topCitiesRaw.map((c) => ({
    city: c.city,
    orderCount: c.order_count,
    revenue: c.revenue,
    percentOfRevenue: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0
  }));

  res.json({ ...totals[0], topProducts, topCities });
});

router.get("/admin/reports/export.csv", requireAdmin, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const conditions = ["deleted_at IS NULL"];
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
    `SELECT id, created_at, customer_name, customer_email, customer_phone, delivery_date, city, pincode, subtotal, total, payment_status, status, tracking_number, refund_status, refund_amount, refund_note, promo_code, discount_amount
     FROM orders ${where} ORDER BY created_at DESC`,
    params
  );

  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Order Ref", "Date", "Name", "Email", "Phone", "Delivery Date", "City", "Pincode", "Subtotal", "Discount", "Promo Code", "Total", "Payment Status", "Order Status", "Tracking Number", "Refund Status", "Refund Amount", "Refund Note"];
  const lines = [header.join(",")];

  for (const o of orders) {
    lines.push(
      [formatOrderRef(o.id), o.created_at.toISOString(), o.customer_name, o.customer_email, o.customer_phone, formatDeliveryDate(o.delivery_date) || "", o.city, o.pincode, o.subtotal, o.discount_amount, o.promo_code, o.total, o.payment_status, o.status, o.tracking_number, o.refund_status, o.refund_amount, o.refund_note]
        .map(escape)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=petalea-orders.csv");
  res.send(lines.join("\n"));
});

module.exports = router;
module.exports.purgeExpiredDeletedOrders = purgeExpiredDeletedOrders;
