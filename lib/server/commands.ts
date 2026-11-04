import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { AG_CODES, CONS_CODES, Q, ST } from "../data";
import { qp } from "../data";
import { priceExp, priceFret, priceMasse } from "../pricing";
import { tripsFor } from "../domain";
import { pad, dIso } from "../format";
import { db, readState, writeState, transaction, audit } from "./db";
import { ApiError } from "./auth";
import type { User } from "../auth-types";
import type { Parcel, Booking, AgencyCode } from "../types";
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{9,20}$/)
  .refine((v) => v.replace(/\D/g, "").length >= 9);
export const parcelInput = z.object({
  type: z.enum(["EXPRESS", "FRET", "MASSE"]),
  weight: z.number().positive().max(30000),
  cons: z.enum(CONS_CODES as ["SEC", "FRESH", "FROZEN"]),
  fragile: z.boolean(),
  desc: z.string().trim().min(2).max(500),
  sender: z.string().trim().min(2).max(100),
  senderTel: phone,
  recipient: z.string().trim().min(2).max(100),
  recipientTel: phone,
  from: z.enum(AG_CODES as [AgencyCode, ...AgencyCode[]]),
  to: z.enum(AG_CODES as [AgencyCode, ...AgencyCode[]]),
  fromQ: z.string().refine((v) => !!Q[v]),
  toQ: z.string().refine((v) => !!Q[v]),
  L: z.number().positive().max(300),
  W: z.number().positive().max(300),
  H: z.number().positive().max(300),
  service: z.enum(["STANDARD", "EXPRESS"]),
  pickupAddr: z.string().max(300).default(""),
  dropAddr: z.string().max(300).default(""),
  wanted: z.string().default(""),
  delivery: z.enum(["retrait", "livraison"]).default("retrait"),
});
export async function createParcel(user: User, input: unknown, key: string) {
  const parsed = parcelInput.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      422,
      "Vérifiez les coordonnées, le poids, les dimensions et la description.",
    );
  const f = parsed.data;
  return await transaction(async () => {
    const cached = (await db
      .prepare("SELECT response FROM idempotency WHERE key=? AND user_id=?")
      .get(key, user.id)) as
      | {
          response: string;
        }
      | undefined;
    if (cached) return JSON.parse(cached.response) as Parcel;
    const { S, revision } = await readState();
    if (
      f.type === "EXPRESS" &&
      (f.weight > S.tarifs.expressMax || f.fromQ === f.toQ)
    )
      throw new ApiError(
        422,
        "Choisissez deux quartiers distincts et un poids compatible.",
      );
    if (f.type !== "EXPRESS" && f.from === f.to)
      throw new ApiError(422, "Choisissez deux villes différentes.");
    if (f.type === "FRET" && f.weight > S.tarifs.fretMax)
      throw new ApiError(422, "Ce poids nécessite un camion dédié.");
    if (
      f.type === "MASSE" &&
      (!f.pickupAddr.trim() ||
        !f.dropAddr.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(f.wanted) ||
        f.wanted < dIso(Date.now()))
    )
      throw new ApiError(422, "Renseignez les adresses et une date future.");
    const now = Date.now(),
      year = new Date().getUTCFullYear(),
      kind = f.type === "EXPRESS" ? "EXP" : f.type === "FRET" ? "COL" : "MAS";
    const price =
      f.type === "EXPRESS"
        ? priceExp(S.tarifs, f).total
        : f.type === "FRET"
          ? priceFret(S.tarifs, { ...f, packed: "client" }).total
          : priceMasse(S.tarifs, f).total;
    const p: Parcel = {
      ...f,
      id: kind + "-" + year + "-" + pad(++S.seq[kind]),
      pickup: f.type === "EXPRESS" ? { ...qp(f.fromQ), label: f.fromQ } : null,
      drop: f.type === "EXPRESS" ? { ...qp(f.toQ), label: f.toQ } : null,
      channel: "SMS",
      packed: "client",
      zone: "",
      otp: String(randomInt(100000, 1000000)),
      price,
      payment: {
        mode: "CASH",
        status: "À encaisser",
        amount: price,
        ref: "PAY-" + pad(++S.seq.PAY),
        t: now,
      },
      status: ST.CREATED,
      history: [
        {
          s: ST.CREATED,
          t: now,
          note: "Commande enregistrée · paiement en agence",
        },
      ],
      track: [],
      created: now,
      updated: now,
    };
    S.parcels.unshift(p);
    S.notifs.unshift({
      id: p.id,
      t: now,
      ch: "APP",
      to: user.name,
      msg: "Votre envoi " + p.id + " est enregistré.",
    });
    await writeState(S, revision);
    await db.prepare("INSERT INTO ownership VALUES(?,?)").run(p.id, user.id);
    await db
      .prepare("INSERT INTO idempotency VALUES(?,?,?)")
      .run(key, user.id, JSON.stringify(p));
    await audit(user.id, "parcel.created:" + p.id);
    return p;
  });
}
const bookingInput = z.object({
  from: z.enum(AG_CODES as [AgencyCode, ...AgencyCode[]]),
  to: z.enum(AG_CODES as [AgencyCode, ...AgencyCode[]]),
  date: z.iso.date(),
  tripId: z.string().max(100),
  seats: z.array(z.number().int().positive()).min(1).max(6),
  names: z.array(z.string().trim().min(3).max(100)).min(1).max(6),
  contact: z.object({
    tel: phone,
    email: z.union([z.email(), z.literal("")]).default(""),
    channel: z.enum(["SMS", "EMAIL", "CALL", "WA"]),
  }),
});
export async function createBooking(user: User, input: unknown, key: string) {
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success)
    throw new ApiError(422, "Vérifiez les voyageurs et les coordonnées.");
  const f = parsed.data;
  return await transaction(async () => {
    const cached = (await db
      .prepare("SELECT response FROM idempotency WHERE key=? AND user_id=?")
      .get(key, user.id)) as
      | {
          response: string;
        }
      | undefined;
    if (cached) return JSON.parse(cached.response) as Booking;
    const { S, revision } = await readState();
    const trip = tripsFor(S, f).find((t) => t.id === f.tripId);
    if (f.date < dIso(Date.now()) || !trip || trip.past)
      throw new ApiError(422, "Ce départ n’est plus disponible.");
    if (
      f.names.length !== f.seats.length ||
      new Set(f.seats).size !== f.seats.length
    )
      throw new ApiError(422, "Vérifiez les sièges et les voyageurs.");
    if (f.seats.some((s) => s > Number(trip.veh.cap) || trip.occ.has(s)))
      throw new ApiError(
        409,
        "Une place vient d’être réservée. Choisissez à nouveau vos sièges.",
      );
    const year = new Date().getUTCFullYear();
    const b: Booking = {
      ...f,
      id: "RES-" + year + "-" + pad(++S.seq.RES),
      time: trip.time,
      arr: trip.arr,
      veh: trip.veh.id,
      plate: trip.veh.plate,
      amount: trip.price * f.seats.length,
      method: "CASH",
      paid: false,
      t: Date.now(),
      tickets: f.seats.map(() => "TKT-" + year + "-" + pad(++S.seq.TKT)),
    };
    S.bookings.unshift(b);
    S.notifs.unshift({
      id: b.id,
      t: Date.now(),
      ch: "APP",
      to: user.name,
      msg: "Réservation " + b.id + " confirmée, à régler en agence.",
    });
    await writeState(S, revision);
    await db.prepare("INSERT INTO ownership VALUES(?,?)").run(b.id, user.id);
    await db
      .prepare("INSERT INTO idempotency VALUES(?,?,?)")
      .run(key, user.id, JSON.stringify(b));
    await audit(user.id, "booking.created:" + b.id);
    return b;
  });
}
