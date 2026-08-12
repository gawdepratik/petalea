require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function seed() {
  const file = path.join(__dirname, "..", "migrations", "002_seed.sql");
  const sql = fs.readFileSync(file, "utf8");
  console.log("Seeding products...");
  await pool.query(sql);
  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
