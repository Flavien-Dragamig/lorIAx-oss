/**
 * Migration : dependsOnEventId → event_dependencies
 *
 * Migre les anciennes dépendances (champ unique sur calendarEvents)
 * vers la nouvelle table event_dependencies (dépendances multiples).
 *
 * Usage : npx tsx scripts/migrate-dependencies.ts
 * Idempotent : les doublons sont ignorés (onConflictDoNothing).
 */

import { db } from "../src/lib/db";
import { calendarEvents, eventDependencies } from "../src/lib/db/schema";
import { isNotNull } from "drizzle-orm";

async function migrate() {
  const eventsWithDeps = await db
    .select({
      id: calendarEvents.id,
      dependsOnEventId: calendarEvents.dependsOnEventId,
    })
    .from(calendarEvents)
    .where(isNotNull(calendarEvents.dependsOnEventId));

  console.log(`Trouvé ${eventsWithDeps.length} événements avec dependsOnEventId`);

  let migrated = 0;
  for (const e of eventsWithDeps) {
    if (!e.dependsOnEventId) continue;
    try {
      await db.insert(eventDependencies).values({
        sourceEventId: e.dependsOnEventId,
        targetEventId: e.id,
      }).onConflictDoNothing();
      migrated++;
    } catch (err) {
      console.warn(`Skip: ${e.dependsOnEventId} → ${e.id}`, err);
    }
  }

  console.log(`Migré ${migrated} dépendances vers event_dependencies`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Erreur migration:", err);
  process.exit(1);
});
