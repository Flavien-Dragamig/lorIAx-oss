/**
 * Seed de base — templates globaux + prompts IA
 * Sans aucune référence à une organisation fictive.
 *
 * Usage : npx tsx scripts/seed-base.ts
 * Prérequis : seed-dev-users.ts doit avoir été exécuté avant (admin user requis pour templates)
 */

import { execSync } from "child_process";
import path from "path";

const script = (name: string) =>
  path.join(__dirname, name);

async function seedBase() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Seed de base — templates + prompts ║");
  console.log("╚══════════════════════════════════════╝\n");

  console.log("▶ Templates globaux...");
  execSync(`npx tsx ${script("seed-templates.ts")}`, { stdio: "inherit" });

  console.log("\n▶ Prompts IA...");
  execSync(`npx tsx ${script("seed-ai-prompts.ts")}`, { stdio: "inherit" });

  console.log("\n✅ Seed de base terminé.");
}

seedBase().catch((err) => {
  console.error("\n❌ Erreur seed-base:", err);
  process.exit(1);
});
