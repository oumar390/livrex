import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { chromium } from "@playwright/test";
const temporary = mkdtempSync(path.join(tmpdir(), "livrex-demo-check-")),
  dataDir = path.join(temporary, "no-database");
const port = 3103,
  base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
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
let browser;
try {
  let online = false;
  for (let n = 0; n < 100; n++) {
    try {
      await fetch(base, { signal: AbortSignal.timeout(1000) });
      online = true;
      break;
    } catch {
      await setTimeout(100);
    }
  }
  assert.ok(online);
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const apiRequests = [],
    errors = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      apiRequests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("heading", { name: /Plus proche/ }).waitFor();
  await page.getByText("Mode démo", { exact: true }).waitFor();
  await page.goto(base + "/connexion");
  await page
    .getByRole("heading", { name: "Explorez LIVREX, simplement." })
    .waitFor();
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page.goto(base + "/envoyer");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page
    .getByLabel("Que contient votre envoi ?")
    .fill("COLIS DE DÉMONSTRATION ISOLÉ");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Nom de l’expéditeur").fill("Expéditeur Démo");
  await page.getByLabel("Téléphone de l’expéditeur").fill("771234567");
  await page.getByLabel("Nom du destinataire").fill("Destinataire Démo");
  await page.getByLabel("Téléphone du destinataire").fill("781234567");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("button", { name: "Confirmer mon envoi" }).click();
  await page
    .getByRole("heading", { name: "C’est parti, on prend le relais." })
    .waitFor();
  await page.getByText("DÉMONSTRATION · DOCUMENT NON VALABLE").waitFor();
  await page.goto(base + "/activites");
  await page.getByText("COLIS DE DÉMONSTRATION ISOLÉ").waitFor();
  await page.reload();
  await page.getByText("COLIS DE DÉMONSTRATION ISOLÉ").waitFor();
  await page.goto(base + "/voyager");
  await page.getByRole("button", { name: "Choisir ce trajet" }).first().click();
  await page.getByRole("button", { name: "Siège 1", exact: true }).click();
  await page.getByLabel("Prénom et nom *").fill("VOYAGEUR DÉMO ISOLÉ");
  await page.getByLabel("Téléphone *", { exact: true }).fill("771234567");
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmer la réservation", exact: true })
    .click();
  await page.getByRole("heading", { name: /Bon voyage/ }).waitFor();
  await page.getByText("DÉMONSTRATION · DOCUMENT NON VALABLE").waitFor();
  assert.ok(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("livrex-browser-demo-v1"),
      ).S.bookings.some((b) => b.names.includes("VOYAGEUR DÉMO ISOLÉ")),
    ),
  );
  for (const route of [
    "/pro",
    "/admin",
    "/agent",
    "/chauffeur",
    "/livreur",
    "/equipe",
  ]) {
    await page.goto(base + route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    );
  }
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto(base + "/activites");
  await other.getByRole("heading", { name: "Mes activités" }).waitFor();
  assert.equal(
    await other.getByText("COLIS DE DÉMONSTRATION ISOLÉ").count(),
    0,
  );
  await second.close();
  await page.goto(base + "/activites");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Réinitialiser la démo", exact: true })
    .click();
  await page
    .getByText("COLIS DE DÉMONSTRATION ISOLÉ")
    .waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  assert.deepEqual(apiRequests, []);
  assert.equal(existsSync(dataDir), false);
  console.log(
    "Démo sans base : envoi, persistance navigateur, documents marqués, espaces métier, isolation et réinitialisation vérifiés. Aucun appel aux API ni SQLite créé.",
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", resolve);
  });
  rmSync(temporary, { recursive: true, force: true });
}
