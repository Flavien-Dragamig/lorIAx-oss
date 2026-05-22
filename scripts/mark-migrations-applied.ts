/**
 * Marque toutes les migrations Drizzle du journal comme appliquées.
 * À utiliser après `drizzle-kit push` sur une base fraîche pour éviter
 * que le migrator de server.ts tente de les rejouer.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const migrationsFolder = path.join(process.cwd(), "src/lib/db/migrations");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");

async function main() {
  if (!fs.existsSync(journalPath)) {
    console.error("Journal introuvable :", journalPath);
    process.exit(1);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath).toString());
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  let count = 0;
  for (const entry of journal.entries) {
    const filePath = path.join(migrationsFolder, entry.tag + ".sql");
    const query = fs.readFileSync(filePath).toString();
    const hash = crypto.createHash("sha256").update(query).digest("hex");

    const exists = await pool.query(
      "SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1",
      [hash]
    );
    if (exists.rowCount === 0) {
      await pool.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [hash, entry.when]
      );
      count++;
    }
  }

  await pool.end();
  if (count > 0) {
    console.log(`✓ ${count} migration(s) enregistrée(s)`);
  } else {
    console.log("✓ Registre des migrations à jour");
  }
}

main().catch((e) => {
  console.error("Erreur mark-migrations-applied :", e.message);
  process.exit(1);
});
