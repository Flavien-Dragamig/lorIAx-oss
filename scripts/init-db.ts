/**
 * Initialisation idempotente de la base — appelée par le service `app-migrate`
 * du docker-compose de production.
 *
 * Comportement :
 *  - BDD vide (0 table publique) → drizzle-kit push --force + enregistrement
 *    du journal des migrations (mark-migrations-applied).
 *  - BDD existante (au moins 1 table) → rien à faire ici, le migrator embarqué
 *    dans server.ts applique le delta.
 *
 * Cette logique évite l'erreur "Interactive prompts require a TTY" qui survient
 * lorsque drizzle-kit push détecte un conflit de rename sur une BDD existante.
 */
import { spawnSync } from "node:child_process";
import { Pool } from "pg";

async function isDatabaseEmpty(): Promise<boolean> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    return Number(rows[0]?.count ?? "0") === 0;
  } finally {
    await pool.end();
  }
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant");
    process.exit(1);
  }

  const empty = await isDatabaseEmpty();
  if (!empty) {
    console.log("BDD existante détectée — pas de push (server.ts applique le delta)");
    return;
  }

  console.log("BDD vide détectée — push initial du schéma Drizzle");
  run("node_modules/.bin/drizzle-kit", ["push", "--force", "--config=drizzle.config.ts"]);

  console.log("Enregistrement du journal des migrations");
  run("node_modules/.bin/tsx", ["scripts/mark-migrations-applied.ts"]);

  console.log("✓ Initialisation BDD terminée");
}

main().catch((e) => {
  console.error("Erreur init-db :", e?.message ?? e);
  process.exit(1);
});
