if (process.env.DATABASE_URL)
  throw Error(
    "Base PostgreSQL active : utilisez les sauvegardes Supabase ou pg_dump. Cette commande est réservée à SQLite local.",
  );
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";
import { existsSync, chmodSync } from "node:fs";
const target = process.argv[2];
if (!target)
  throw Error("Usage : npm run db:backup -- /chemin/securise/livrex.sqlite");
if (existsSync(target))
  throw Error("La destination existe déjà. Choisissez un nouveau fichier.");
const source = path.join(
  process.env.LIVREX_DATA_DIR || path.join(process.cwd(), ".data"),
  "livrex.sqlite",
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  chmodSync(target, 0o600);
  console.log("Sauvegarde créée.");
} finally {
  db.close();
}
