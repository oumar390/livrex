import { existsSync } from "node:fs";
async function main() {
  // Load optional local configuration before importing the database singleton.
  for (const file of [".env.local", ".env"])
    if (existsSync(file)) process.loadEnvFile(file);
  const { db } = await import("../lib/server/database");
  try {
    await db.initialize();
    console.log(
      process.env.DATABASE_URL
        ? "Schéma PostgreSQL initialisé."
        : "Schéma SQLite local initialisé.",
    );
  } catch {
    console.error(
      "Initialisation impossible. Vérifiez la configuration de la base (aucun identifiant ne doit être partagé dans les logs).",
    );
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error("Initialisation impossible. Vérifiez la configuration locale.");
  process.exitCode = 1;
});
