import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { freshState } from "../seed";
import type { AppState } from "../types";
const dir = process.env.LIVREX_DATA_DIR || path.join(process.cwd(), ".data");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const globalDb = globalThis as unknown as { livrexDb?: DatabaseSync };
export const db = (globalDb.livrexDb ||= new DatabaseSync(
  path.join(dir, "livrex.sqlite"),
));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ownership(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS proofs(id TEXT PRIMARY KEY,parcel_id TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,token TEXT UNIQUE NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,event TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency(key TEXT PRIMARY KEY,user_id TEXT NOT NULL,response TEXT NOT NULL);
`);
if (!db.prepare("SELECT id FROM state WHERE id=1").get()) {
  const s = freshState();
  s.parcels = [];
  s.bookings = [];
  s.notifs = [];
  s.seq = { COL: 0, EXP: 0, MAS: 0, RES: 0, TKT: 0, PAY: 0 };
  s.speed = 0;
  s.vehicles.forEach((v) => (v.trip = null));
  s.couriers.forEach((c) => {
    c.job = null;
    c.route = [];
  });
  db.prepare("INSERT OR IGNORE INTO state VALUES(1,0,?)").run(
    JSON.stringify(s),
  );
}
export function readState() {
  const row = db
    .prepare("SELECT revision,data FROM state WHERE id=1")
    .get() as { revision: number; data: string };
  return { revision: row.revision, S: JSON.parse(row.data) as AppState };
}
export function writeState(S: AppState, revision: number) {
  const r = db
    .prepare(
      "UPDATE state SET data=?,revision=revision+1 WHERE id=1 AND revision=?",
    )
    .run(JSON.stringify(S), revision);
  if (!r.changes) throw new Error("CONFLICT");
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function audit(actor: string, event: string) {
  db.prepare("INSERT INTO audit(actor,event,created) VALUES(?,?,?)").run(
    actor,
    event,
    Date.now(),
  );
}
