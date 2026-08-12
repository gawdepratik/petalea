const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { sendMail } = require("../email");

const router = express.Router();

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 30 * 1000;
const lastRequestByEmail = new Map();

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(`${code}:${process.env.JWT_SECRET}`)
    .digest("hex");
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

router.post("/request-otp", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const lastRequest = lastRequestByEmail.get(email);
  if (lastRequest && Date.now() - lastRequest < RESEND_COOLDOWN_MS) {
    return res.status(200).json({ ok: true });
  }
  lastRequestByEmail.set(email, Date.now());

  if (getAdminEmails().includes(email)) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await pool.query(
      "INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)",
      [email, hashCode(code), expiresAt]
    );

    await sendMail({
      to: email,
      subject: "Your PETALÉA admin login code",
      text: `Your login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`
    });
  }

  // Always respond the same way whether or not the email is an admin,
  // so this endpoint can't be used to discover who has admin access.
  res.status(200).json({ ok: true });
});

router.post("/verify-otp", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();

  if (!email || !code || !getAdminEmails().includes(email)) {
    return res.status(401).json({ error: "Invalid code" });
  }

  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, used FROM otp_codes
     WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  const record = rows[0];

  if (
    !record ||
    record.used ||
    new Date(record.expires_at) < new Date() ||
    record.code_hash !== hashCode(code)
  ) {
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  await pool.query("UPDATE otp_codes SET used = true WHERE id = $1", [record.id]);

  const cookieSecure = process.env.COOKIE_SECURE !== "false";
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.cookie("admin_session", token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSecure ? "none" : "lax",
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({ ok: true, email });
});

router.post("/logout", (req, res) => {
  res.clearCookie("admin_session");
  res.json({ ok: true });
});

module.exports = router;
