import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.describe.configure({ mode: "serial" });
let admin: APIRequestContext,
  client: APIRequestContext,
  other: APIRequestContext;
const password = "Test-Livrex-2026!";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const parcel = {
  type: "EXPRESS",
  weight: 2,
  cons: "SEC",
  fragile: false,
  desc: "Livres de formation",
  sender: "Awa Diop",
  senderTel: "771234567",
  recipient: "Oumar Sy",
  recipientTel: "781234567",
  from: "DKR",
  to: "TBA",
  fromQ: "Plateau",
  toQ: "Almadies",
  L: 30,
  W: 20,
  H: 15,
  service: "STANDARD",
};
const post = (
  api: APIRequestContext,
  url: string,
  data: unknown,
  key = randomUUID(),
) => api.post(url, { data, headers: { "Idempotency-Key": key } });
let parcelId: string, bookingId: string;
test.beforeAll(async ({ playwright }) => {
  admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  client = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  if (process.env.LIVREX_TEST_ADMIN_TOKEN) {
    const denied = await admin.post("/api/auth", {
      data: {
        action: "register",
        email: "admin@example.test",
        name: "Admin Test",
        password,
      },
    });
    expect(denied.status()).toBe(403);
  }
  for (const [api, email, name] of [
    [admin, "admin@example.test", "Admin Test"],
    [client, "client@example.test", "Awa Diop"],
    [other, "other@example.test", "Autre Client"],
  ] as const) {
    const r = await api.post("/api/auth", {
      data: {
        action: "register",
        email,
        password,
        name,
        role: "ADMIN",
        setupToken: process.env.LIVREX_TEST_ADMIN_TOKEN,
      },
    });
    expect(r.status()).toBe(200);
  }
});
test.afterAll(async () => {
  await admin.dispose();
  await client.dispose();
  await other.dispose();
});
test("comptes, rôles, cookies et protection CSRF", async ({ request }) => {
  expect((await (await client.get("/api/auth")).json()).user.role).toBe(
    "CLIENT",
  );
  expect((await (await admin.get("/api/auth")).json()).user.role).toBe("ADMIN");
  expect((await client.get("/api/team")).status()).toBe(403);
  expect((await request.patch("/api/state", { data: {} })).status()).toBe(401);
  expect(
    (
      await admin.patch("/api/team", {
        headers: { Origin: "https://evil.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const cookies = (await client.storageState()).cookies;
  expect(cookies[0].httpOnly).toBe(true);
  expect(cookies[0].sameSite).toBe("Lax");
  const bad = await request.post("/api/auth", {
    data: {
      action: "login",
      email: "client@example.test",
      password: "Wrong-password-2026",
    },
  });
  expect(bad.status()).toBe(401);
});
test("envoi persistant, prix serveur, idempotence et confidentialité", async ({
  request,
}) => {
  const key = randomUUID();
  const r = await post(
    client,
    "/api/parcels",
    { ...parcel, price: 1, payment: { status: "Payé" } },
    key,
  );
  expect(r.status()).toBe(201);
  const p = await r.json();
  parcelId = p.id;
  expect(p.price).toBeGreaterThan(1000);
  expect(p.payment.status).toBe("À encaisser");
  expect(p.otp).toMatch(/^\d{6}$/);
  expect(
    (await (await post(client, "/api/parcels", parcel, key)).json()).id,
  ).toBe(parcelId);
  const own = await (await client.get("/api/state")).json();
  expect(
    own.S.parcels.filter((p: { id: string }) => p.id === parcelId),
  ).toHaveLength(1);
  expect((await (await other.get("/api/state")).json()).S.parcels).toHaveLength(
    0,
  );
  expect(
    (await (await request.get("/api/state")).json()).S.parcels,
  ).toHaveLength(0);
  expect(
    (await post(client, "/api/parcels", { ...parcel, weight: -1 })).status(),
  ).toBe(422);
  expect(
    (await post(client, "/api/parcels", { ...parcel, L: 0 })).status(),
  ).toBe(422);
  expect((await client.patch("/api/state", { data: own })).status()).toBe(403);
});
test("réservation transactionnelle : pas de siège doublement vendu", async () => {
  const input = {
    from: "DKR",
    to: "TBA",
    date: tomorrow,
    tripId: `DKR-TBA-${tomorrow}-06:30`,
    seats: [1],
    names: ["Awa Diop"],
    contact: { tel: "771234567", email: "", channel: "SMS" },
    amount: 1,
    paid: true,
  };
  const key = randomUUID();
  const r = await post(client, "/api/bookings", input, key);
  expect(r.status()).toBe(201);
  const b = await r.json();
  bookingId = b.id;
  expect(b.amount).toBeGreaterThan(1000);
  expect(b.paid).toBe(false);
  expect(
    (await (await post(client, "/api/bookings", input, key)).json()).id,
  ).toBe(b.id);
  expect((await post(other, "/api/bookings", input)).status()).toBe(409);
  expect(
    (
      await post(other, "/api/bookings", {
        ...input,
        seats: [2, 2],
        names: ["Awa Diop", "Oumar Sy"],
      })
    ).status(),
  ).toBe(422);
  expect(
    (await (await other.get("/api/state")).json()).S.bookings,
  ).toHaveLength(0);
  expect(
    (await (await other.get("/api/state")).json()).S.seatReservations[
      input.tripId
    ],
  ).toContain(1);
});
test("encaissement protégé et historique partagé entre comptes", async () => {
  expect(
    (
      await client.post("/api/bookings/payment", { data: { id: bookingId } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await admin.post("/api/bookings/payment", { data: { id: bookingId } })
    ).status(),
  ).toBe(200);
  expect(
    (await (await client.get("/api/state")).json()).S.bookings[0].paid,
  ).toBe(true);
  const state = await (await admin.get("/api/state")).json();
  const p = state.S.parcels.find((p: { id: string }) => p.id === parcelId);
  p.status = "Livreur affecté";
  p.courier = "L1";
  p.history.push({ s: p.status, t: Date.now(), note: "Affectation à Moussa" });
  state.S.couriers[0].job = p.id;
  expect((await admin.patch("/api/state", { data: state })).status()).toBe(200);
  expect((await admin.patch("/api/state", { data: state })).status()).toBe(409);
  const own = await (await client.get("/api/state")).json();
  expect(own.S.parcels[0].status).toBe("Livreur affecté");
});
test("droits professionnels et protection du dernier administrateur", async () => {
  const users = await (await admin.get("/api/team")).json();
  const me = users.find(
    (u: { email: string }) => u.email === "admin@example.test",
  );
  expect(
    (
      await admin.patch("/api/team", { data: { id: me.id, role: "CLIENT" } })
    ).status(),
  ).toBe(422);
  const u = users.find(
    (u: { email: string }) => u.email === "other@example.test",
  );
  expect(
    (
      await admin.patch("/api/team", { data: { id: u.id, role: "LIVREUR" } })
    ).status(),
  ).toBe(200);
  expect((await (await other.get("/api/auth")).json()).user).toBeNull();
  await other.post("/api/auth", {
    data: { action: "login", email: "other@example.test", password },
  });
  const state = await (await other.get("/api/state")).json();
  expect(state.S.parcels[0].otp).toBe("");
  state.S.tarifs.expBase = 1;
  expect((await other.patch("/api/state", { data: state })).status()).toBe(403);
  const clean = await (await other.get("/api/state")).json();
  clean.S.parcels[0].status = "Livré";
  clean.S.parcels[0].proof = {
    t: Date.now(),
    signature: "data:image/png;base64,xyz",
    code: "000000",
  };
  expect((await other.patch("/api/state", { data: clean })).status()).toBe(422);
});
test("interface mobile : navigation, saisie et confirmation d’un envoi", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill("client@example.test");
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(/activites/);
  await page.goto("/envoyer");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page
    .getByLabel("Que contient votre envoi ?")
    .fill("Documents administratifs");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Nom de l’expéditeur").fill("Awa Diop");
  await page.getByLabel("Téléphone de l’expéditeur").fill("771234567");
  await page.getByLabel("Nom du destinataire").fill("Oumar Sy");
  await page.getByLabel("Téléphone du destinataire").fill("781234567");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("button", { name: "Confirmer mon envoi" }).click();
  await expect(
    page.getByRole("heading", { name: "C’est parti, on prend le relais." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Suivre mon colis" }).click();
  await expect(page.getByText("Code de remise :")).toBeVisible();
  expect(errors).toEqual([]);
});
test("interface voyage : choix du siège et billet récupérable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies((await client.storageState()).cookies);
  await page.goto("/voyager");
  await page.getByLabel("Date", { exact: true }).fill(tomorrow);
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await page.getByRole("button", { name: "Choisir ce trajet" }).first().click();
  await page.getByRole("button", { name: "Siège 3", exact: true }).click();
  await page.getByLabel("Prénom et nom *").fill("Awa Diop");
  await page.getByLabel("Téléphone *", { exact: true }).fill("771234567");
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmer la réservation", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Bon voyage/ })).toBeVisible();
  await page.goto("/activites");
  await expect(page.getByText("À régler en agence").first()).toBeVisible();
});
test("responsive : aucun débordement et accueil lisible", async ({ page }) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/envoyer",
      "/voyager",
      "/connexion",
      "/aide",
      "/pro",
    ]) {
      await page.goto(route);
      await expect(page.locator("#contenu")).not.toContainText(
        "Connexion à LIVREX…",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".site-footer")).toBeVisible();
  await page.screenshot({
    path: "test-results/accueil-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/accueil-desktop.png",
    fullPage: true,
  });
});

test("API boutique : clé privée, envoi et révocation", async ({ request }) => {
  const created = await client.post("/api/keys", {
    data: { name: "Boutique test" },
  });
  expect(created.status()).toBe(201);
  const { token } = await created.json();
  const payload = {
    pickup: "Plateau",
    dropoff: "Almadies",
    weight_kg: 2,
    recipient: { name: "Oumar Sy", phone: "771234567" },
    sender: { name: "Boutique", phone: "781234567" },
  };
  const headers = {
    Authorization: "Bearer " + token,
    "Idempotency-Key": randomUUID(),
  };
  const r = await request.post("/api/v1/shipments", { headers, data: payload });
  expect(r.status()).toBe(201);
  expect((await r.json()).payment_status).toBe("pending");
  expect(
    (
      await request.post("/api/v1/shipments", {
        headers: { ...headers, "Idempotency-Key": randomUUID() },
        data: { ...payload, dimensions_cm: { l: 0, w: 10, h: 10 } },
      })
    ).status(),
  ).toBe(422);
  const keys = await (await client.get("/api/keys")).json();
  expect(keys[0]).not.toHaveProperty("token");
  expect(
    (await client.delete("/api/keys", { data: { id: keys[0].id } })).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/v1/shipments", { headers, data: payload })
    ).status(),
  ).toBe(401);
});
test("livraison : scan, code, preuve sauvegardée et état client", async () => {
  const own = await (await client.get("/api/state")).json();
  const source = own.S.parcels.find((p: { id: string }) => p.id === parcelId);
  let state = await (await other.get("/api/state")).json();
  let parcel = state.S.parcels.find((p: { id: string }) => p.id === parcelId);
  parcel.status = "En livraison";
  parcel.history.push({
    s: "En livraison",
    t: Date.now(),
    note: "Collecte par scan",
  });
  expect((await other.patch("/api/state", { data: state })).status()).toBe(200);
  state = await (await other.get("/api/state")).json();
  parcel = state.S.parcels.find((p: { id: string }) => p.id === parcelId);
  parcel.status = "Livré";
  parcel.history.push({ s: "Livré", t: Date.now(), note: "Code et signature" });
  parcel.proof = {
    t: Date.now(),
    sig: true,
    signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    code: source.otp,
    pos: parcel.drop,
  };
  expect((await other.patch("/api/state", { data: state })).status()).toBe(200);
  const result = (await (await client.get("/api/state")).json()).S.parcels.find(
    (p: { id: string }) => p.id === parcelId,
  );
  expect(result.status).toBe("Livré");
  expect(result.proof.signature).toMatch(/^\/api\/proofs\//);
  expect((await client.get(result.proof.signature)).status()).toBe(200);
  expect(result.proof).not.toHaveProperty("code");
});
test("espaces professionnels : pages utilisables sur mobile", async ({
  page,
}) => {
  await page.context().addCookies((await admin.storageState()).cookies);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "/pro",
    "/admin",
    "/agent",
    "/chauffeur",
    "/livreur",
    "/equipe",
    "/integrations",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("réservation simultanée : une seule confirmation pour un même siège", async () => {
  const input = {
    from: "DKR",
    to: "TBA",
    date: tomorrow,
    tripId: `DKR-TBA-${tomorrow}-09:00`,
    seats: [22],
    names: ["Awa Diop"],
    contact: { tel: "771234567", email: "", channel: "SMS" },
  };
  const results = await Promise.all([
    post(client, "/api/bookings", input),
    post(admin, "/api/bookings", input),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
});
