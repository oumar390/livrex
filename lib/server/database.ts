import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, types } from "pg";
import { freshState } from "../seed";
import type { AppState } from "../types";

// Timestamps fit within JavaScript's safe integer range; PostgreSQL stores them as bigint.
types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw Error("Unsafe database integer");
  return n;
});
const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,created BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ownership(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS proofs(id TEXT PRIMARY KEY,parcel_id TEXT NOT NULL,mime TEXT NOT NULL,data BYTEA NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,token TEXT UNIQUE NOT NULL,created BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id BIGSERIAL PRIMARY KEY,actor TEXT,event TEXT NOT NULL,created BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency(key TEXT PRIMARY KEY,user_id TEXT NOT NULL,response TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
CREATE INDEX IF NOT EXISTS ownership_user_idx ON ownership(user_id);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied BIGINT NOT NULL);
INSERT INTO schema_migrations VALUES(1,0) ON CONFLICT DO NOTHING;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
`;
const SQLITE_SCHEMA = POSTGRES_SCHEMA.replaceAll(
  "BIGSERIAL PRIMARY KEY",
  "INTEGER PRIMARY KEY",
)
  .replaceAll("BIGINT", "INTEGER")
  .replaceAll("BYTEA", "BLOB")
  .replace(/ALTER TABLE [a-z_]+ ENABLE ROW LEVEL SECURITY;/g, "");
const LOCK_ID = 762918004;
type Parameters = SQLInputValue[];
type Rows = Record<string, unknown>[];
type Result = { rows: Rows; changes: number };
type Executor = { query: (sql: string, params: Parameters) => Promise<Result> };
export class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      "La base Supabase n’est pas encore configurée. Ajoutez DATABASE_URL dans les paramètres Vercel, puis redéployez.",
    );
  }
}
function seed() {
  const S = freshState();
  S.parcels = [];
  S.bookings = [];
  S.notifs = [];
  S.seq = { COL: 0, EXP: 0, MAS: 0, RES: 0, TKT: 0, PAY: 0 };
  S.speed = 0;
  S.vehicles.forEach((v) => (v.trip = null));
  S.couriers.forEach((c) => {
    c.job = null;
    c.route = [];
  });
  return JSON.stringify(S);
}
function postgresSql(sql: string) {
  let index = 0;
  const ignore = sql.startsWith("INSERT OR IGNORE");
  const query = sql
    .replace("INSERT OR IGNORE", "INSERT")
    .replaceAll("?", () => "$" + ++index);
  return ignore ? query + " ON CONFLICT DO NOTHING" : query;
}
function createDatabase() {
  const context = new AsyncLocalStorage<Executor>();
  let pool: Pool | undefined,
    sqlite: DatabaseSync | undefined,
    ready: Promise<void> | undefined,
    tail = Promise.resolve();
  const connectionString = process.env.DATABASE_URL;
  const postgres = !!connectionString;
  function getPool() {
    if (pool) return pool;
    const url = new URL(connectionString!);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const wantsDisabled = url.searchParams.get("sslmode") === "disable";
    if (wantsDisabled && !local)
      throw new Error("TLS is required for remote PostgreSQL");
    for (const k of [
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "uselibpqcompat",
    ])
      url.searchParams.delete(k);
    pool = new Pool({
      connectionString: url.toString(),
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      ssl: wantsDisabled
        ? false
        : {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA_CERT
              ? { ca: process.env.DATABASE_CA_CERT }
              : {}),
          },
    });
    pool.on("error", () => console.error("PostgreSQL connection interrupted"));
    return pool;
  }
  function getSqlite() {
    if (sqlite) return sqlite;
    if (process.env.VERCEL) throw new DatabaseConfigurationError();
    const dir =
      process.env.LIVREX_DATA_DIR || path.join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    sqlite = new DatabaseSync(path.join(dir, "livrex.sqlite"));
    sqlite.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    return sqlite;
  }
  function localExecutor(): Executor {
    return {
      async query(sql, params) {
        const stmt = getSqlite().prepare(sql);
        if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql))
          return { rows: stmt.all(...params) as Rows, changes: 0 };
        const r = stmt.run(...params);
        return { rows: [], changes: Number(r.changes) };
      },
    };
  }
  function pgExecutor(client: PoolClient | Pool): Executor {
    return {
      async query(sql, params) {
        const r = await client.query(postgresSql(sql), params);
        return { rows: r.rows, changes: r.rowCount || 0 };
      },
    };
  }
  async function exclusive<T>(fn: () => Promise<T>) {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  async function initialize() {
    if (!ready) {
      ready = (async () => {
        if (postgres) {
          const client = await getPool().connect();
          try {
            await client.query("BEGIN");
            await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
            await client.query(POSTGRES_SCHEMA);
            await client.query(
              "INSERT INTO state VALUES(1,0,$1) ON CONFLICT DO NOTHING",
              [seed()],
            );
            await client.query("COMMIT");
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        } else {
          getSqlite().exec(SQLITE_SCHEMA);
          getSqlite()
            .prepare("INSERT OR IGNORE INTO state VALUES(1,0,?)")
            .run(seed());
        }
      })().catch((e) => {
        ready = undefined;
        throw e;
      });
    }
    await ready;
  }
  async function query(sql: string, params: Parameters): Promise<Result> {
    await initialize();
    const bound = context.getStore();
    if (bound) return bound.query(sql, params);
    if (postgres) return pgExecutor(getPool()).query(sql, params);
    return exclusive(() => localExecutor().query(sql, params));
  }
  return {
    initialize,
    prepare(sql: string) {
      return {
        async get(...params: Parameters) {
          return (await query(sql, params)).rows[0];
        },
        async all(...params: Parameters) {
          return (await query(sql, params)).rows;
        },
        async run(...params: Parameters) {
          return { changes: (await query(sql, params)).changes };
        },
      };
    },
    async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
      await initialize();
      if (context.getStore()) return fn();
      if (postgres) {
        const client = await getPool().connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
          const value = await context.run(pgExecutor(client), fn);
          await client.query("COMMIT");
          return value;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }
      return exclusive(async () => {
        getSqlite().exec("BEGIN IMMEDIATE");
        try {
          const value = await context.run(localExecutor(), fn);
          getSqlite().exec("COMMIT");
          return value;
        } catch (e) {
          getSqlite().exec("ROLLBACK");
          throw e;
        }
      });
    },
    async close() {
      await pool?.end();
      sqlite?.close();
    },
  };
}
const globalDb = globalThis as unknown as {
  livrexDatabase?: ReturnType<typeof createDatabase>;
};
export const db = (globalDb.livrexDatabase ||= createDatabase());
export async function readState() {
  const row = (await db
    .prepare("SELECT revision,data FROM state WHERE id=1")
    .get()) as { revision: number; data: string };
  return { revision: row.revision, S: JSON.parse(row.data) as AppState };
}
export async function writeState(S: AppState, revision: number) {
  const r = await db
    .prepare(
      "UPDATE state SET data=?,revision=revision+1 WHERE id=1 AND revision=?",
    )
    .run(JSON.stringify(S), revision);
  if (!r.changes) throw Error("CONFLICT");
}
export const transaction = <T>(fn: () => Promise<T> | T) => db.transaction(fn);
export async function audit(actor: string, event: string) {
  await db
    .prepare("INSERT INTO audit(actor,event,created) VALUES(?,?,?)")
    .run(actor, event, Date.now());
}
