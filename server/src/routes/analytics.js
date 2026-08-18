const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { getAnalyticsSummary } = require("../analytics");

const router = express.Router();

router.get("/admin/analytics/summary", requireAdmin, async (req, res) => {
  try {
    const data = await getAnalyticsSummary();
    res.json(data);
  } catch (err) {
    console.error("Analytics fetch failed:", err.message);
    res.status(502).json({ error: "Could not load analytics right now." });
  }
});

module.exports = router;
