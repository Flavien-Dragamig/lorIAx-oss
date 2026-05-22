const REQUIRED_TABLES = [
  "users",
  "spaces",
  "documents",
  "templates",
  "system_settings",
];

export async function register() {
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  if (process.env.NODE_ENV === "development") {
    try {
      const { sql } = await import("drizzle-orm");
      const { db } = await import("@/lib/db");
      const result = await db.execute<{ table_name: string }>(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const existing = new Set((result.rows as { table_name: string }[]).map((r) => r.table_name));
      const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
      if (missing.length > 0) {
        console.warn(
          `[migrations] Tables manquantes : ${missing.join(", ")}. Lancez : npm run db:migrate`
        );
      }
    } catch {
      // Ne pas bloquer le démarrage si la BDD est inaccessible
    }
  }
}
