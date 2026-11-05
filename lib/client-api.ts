"use client";
import { freshState, STATE_VERSION } from "./seed";
import { priceExp, priceFret, priceMasse } from "./pricing";
import { tripsFor } from "./domain";
import { qp, ST } from "./data";
import { pad, dIso } from "./format";
import type { AppState, Parcel, Booking } from "./types";
import type { User } from "./auth-types";
let demo = false;
const KEY = "livrex-browser-demo-v1";
interface DemoData {
  S: AppState;
  revision: number;
  user: User;
  team: User[];
  requests: Record<string, unknown>;
}
let memory: DemoData | undefined;
export function configureDemoMode(enabled: boolean) {
  if (typeof window !== "undefined") demo = enabled;
}
export function resetBrowserDemo() {
  localStorage.removeItem(KEY);
  memory = undefined;
}
function read(): DemoData {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.S?.v === STATE_VERSION) return (memory = d);
    }
  } catch {}
  const user: User = {
    id: "demo-admin",
    name: "Visiteur démo",
    email: "demo@example.test",
    role: "ADMIN",
  };
  return (memory = {
    S: freshState(),
    revision: 0,
    user,
    team: [
      { ...user },
      {
        id: "demo-agent",
        name: "Awa · Démo",
        email: "agent@example.test",
        role: "AGENT",
      },
      {
        id: "demo-driver",
        name: "Moussa · Démo",
        email: "chauffeur@example.test",
        role: "CHAUFFEUR",
      },
    ],
    requests: {},
  });
}
function save(d: DemoData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    throw Error(
      "Le stockage du navigateur est plein ou indisponible. Réinitialisez la démonstration ou libérez de l’espace.",
    );
  }
}
function reply(value: unknown, status = 200) {
  return Response.json(value, { status });
}
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (!demo || !input.startsWith("/api/")) return fetch(input, init);
  try {
    const d = read(),
      S = d.S,
      method = init?.method || "GET",
      body = typeof init?.body === "string" ? JSON.parse(init.body) : {},
      key = new Headers(init?.headers).get("Idempotency-Key");
    if (input === "/api/auth")
      return reply({
        ok: true,
        user: d.user,
        needsSetup: false,
        needsSetupToken: false,
      });
    if (input === "/api/state") {
      if (method === "PATCH") {
        if (body.revision !== d.revision)
          return reply(
            { error: "Les données ont changé. Rechargez puis réessayez." },
            409,
          );
        d.S = body.S;
        d.revision++;
        save(d);
        return reply({ ok: true, revision: d.revision });
      }
      return reply({ S, revision: d.revision, user: d.user });
    }
    if (input === "/api/team") {
      if (method === "PATCH") {
        const u = d.team.find((u) => u.id === body.id);
        if (u) u.role = body.role;
        save(d);
        return reply({ ok: true });
      }
      return reply(d.team);
    }
    if (input === "/api/keys")
      return method === "GET"
        ? reply([])
        : reply(
            {
              error:
                "Les clés API seront disponibles après connexion de Supabase.",
            },
            409,
          );
    if (
      method === "POST" &&
      ["/api/parcels", "/api/bookings"].includes(input)
    ) {
      const requestKey = input + ":" + key;
      if (key && d.requests[requestKey])
        return reply(d.requests[requestKey], 201);
      const now = Date.now(),
        year = new Date().getUTCFullYear();
      let result: Parcel | Booking;
      if (input === "/api/parcels") {
        const f = body;
        if (
          !(f.weight > 0) ||
          !f.sender?.trim() ||
          !f.recipient?.trim() ||
          !f.desc?.trim()
        )
          return reply(
            { error: "Complétez les informations de votre envoi." },
            422,
          );
        const max =
          f.type === "EXPRESS"
            ? S.tarifs.expressMax
            : f.type === "FRET"
              ? S.tarifs.fretMax
              : S.tarifs.masseMax;
        if (f.weight > max)
          return reply(
            { error: "Ce poids dépasse la capacité du service choisi." },
            422,
          );
        if (f.type === "EXPRESS" ? f.fromQ === f.toQ : f.from === f.to)
          return reply(
            { error: "Choisissez un départ et une arrivée différents." },
            422,
          );
        const kind =
          f.type === "EXPRESS" ? "EXP" : f.type === "FRET" ? "COL" : "MAS";
        const price =
          f.type === "EXPRESS"
            ? priceExp(S.tarifs, f).total
            : f.type === "FRET"
              ? priceFret(S.tarifs, { ...f, packed: "client" }).total
              : priceMasse(S.tarifs, f).total;
        const p: Parcel = {
          ...f,
          id: kind + "-" + year + "-" + pad(++S.seq[kind]),
          pickup:
            f.type === "EXPRESS" ? { ...qp(f.fromQ), label: f.fromQ } : null,
          drop: f.type === "EXPRESS" ? { ...qp(f.toQ), label: f.toQ } : null,
          channel: "SMS",
          packed: "client",
          zone: "",
          otp: String(
            100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
          ),
          price,
          payment: {
            mode: "CASH",
            ref: "DEMO-" + pad(++S.seq.PAY),
            amount: price,
            status: "À encaisser",
            t: now,
          },
          history: [
            {
              s: ST.CREATED,
              t: now,
              note: "Envoi de démonstration · aucune prise en charge réelle",
            },
          ],
          status: ST.CREATED,
          track: [],
          created: now,
          updated: now,
        };
        S.parcels.unshift(p);
        result = p;
      } else {
        const f = body,
          t = tripsFor(S, f).find((t) => t.id === f.tripId);
        if (!t || t.past || f.date < dIso(now))
          return reply({ error: "Choisissez un départ disponible." }, 422);
        if (
          !Array.isArray(f.seats) ||
          !f.seats.length ||
          new Set(f.seats).size !== f.seats.length ||
          f.names?.length !== f.seats.length
        )
          return reply({ error: "Vérifiez les places et les voyageurs." }, 422);
        if (
          f.seats.some(
            (n: number) => t.occ.has(n) || n < 1 || n > Number(t.veh.cap),
          )
        )
          return reply(
            { error: "Une place est déjà occupée dans cette démonstration." },
            409,
          );
        const b: Booking = {
          ...f,
          id: "RES-" + year + "-" + pad(++S.seq.RES),
          time: t.time,
          arr: t.arr,
          veh: t.veh.id,
          plate: t.veh.plate,
          amount: t.price * f.seats.length,
          method: "CASH",
          paid: false,
          t: now,
          tickets: f.seats.map(() => "TKT-" + year + "-" + pad(++S.seq.TKT)),
        };
        S.bookings.unshift(b);
        result = b;
      }
      S.notifs.unshift({
        id: result.id,
        t: now,
        ch: "DÉMO",
        to: d.user.name,
        msg:
          "Simulation " +
          result.id +
          " enregistrée uniquement dans ce navigateur.",
      });
      d.revision++;
      if (key) d.requests[requestKey] = result;
      save(d);
      return reply(result, 201);
    }
    if (input === "/api/bookings/payment" && method === "POST") {
      const b = S.bookings.find((b) => b.id === body.id);
      if (!b) return reply({ error: "Réservation introuvable." }, 404);
      b.paid = true;
      d.revision++;
      save(d);
      return reply({ ok: true });
    }
    return reply(
      { error: "Cette intégration nécessite la connexion de Supabase." },
      409,
    );
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error
            ? e.message
            : "Action impossible dans la démonstration.",
      },
      422,
    );
  }
}
