const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(String(payload.email).toLowerCase())) {
      return res.status(401).json({ error: "Not authorized" });
    }

    req.adminEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

module.exports = { requireAdmin };
