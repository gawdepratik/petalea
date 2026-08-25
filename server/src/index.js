require("dotenv").config();

const express = require("express");
require("express-async-errors");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const promoCodeRoutes = require("./routes/promoCodes");
const reviewRoutes = require("./routes/reviews");
const analyticsRoutes = require("./routes/analytics");
const customOrderRoutes = require("./routes/customOrders");

const app = express();

// Render's routing has more than one internal hop in front of the app, so
// trusting a fixed hop count (e.g. 1) resolves to an internal 10.x address
// instead of the real visitor IP. Trusting the whole chain takes the
// left-most (original client) entry in X-Forwarded-For instead.
app.set("trust proxy", true);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", productRoutes);
app.use("/api", orderRoutes);
app.use("/api", promoCodeRoutes);
app.use("/api", reviewRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", customOrderRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

// Permanently remove deleted orders older than 48h (unless marked to keep).
// Runs on startup (covers the app waking from sleep on a free-tier host)
// and hourly after that while the process stays alive.
orderRoutes.purgeExpiredDeletedOrders().catch((err) => console.error("Startup order purge failed:", err.message));
setInterval(() => {
  orderRoutes.purgeExpiredDeletedOrders().catch((err) => console.error("Scheduled order purge failed:", err.message));
}, 60 * 60 * 1000);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`PETALEA server listening on port ${port}`));
