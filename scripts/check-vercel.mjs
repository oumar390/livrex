import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
const temporary = mkdtempSync(path.join(tmpdir(), "livrex-vercel-config-"));
const dataDir = path.join(temporary, "must-not-be-created");
const port = process.env.VERCEL_TEST_PORT || "3102";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    stdio: "ignore",
    env: {
      ...process.env,
      VERCEL: "1",
      DATABASE_URL: "",
      ADMIN_SETUP_TOKEN: "",
      LIVREX_DATA_DIR: dataDir,
    },
  },
);
try {
  let online = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      online = true;
      break;
    } catch {
      await setTimeout(100);
    }
  }
  assert.ok(online, "Le serveur de validation doit démarrer.");
  for (const route of ["/api/auth", "/api/state"]) {
    const r = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /DATABASE_URL/);
  }
  assert.equal(existsSync(dataDir), false);
  console.log(
    "Vercel sans configuration : erreur explicite 503, aucun SQLite temporaire créé.",
  );
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", resolve);
  });
  rmSync(temporary, { recursive: true, force: true });
}
