import { z } from "zod";
import { AG_CODES, ALL_STATUSES } from "../data";
const text = z.string().max(2000),
  num = z.number().finite().nonnegative(),
  seq = z.number().int().nonnegative();
const agency = z.enum(
  AG_CODES as [
    "DKR",
    ...("THS" | "MBR" | "TBA" | "KLK" | "STL" | "TBC" | "ZIG")[],
  ],
);
const point = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
const place = point.extend({ label: text });
const status = z.enum(
  ALL_STATUSES as [
    (typeof ALL_STATUSES)[number],
    ...(typeof ALL_STATUSES)[number][],
  ],
);
const payment = z.object({
  mode: z.enum(["WAVE", "OM", "CARD", "CASH", "COD"]),
  ref: text,
  amount: num,
  status: z.enum(["Payé", "À encaisser"]),
  t: num,
});
const proof = z.object({
  t: num,
  cni: text.optional(),
  absent: z.boolean().optional(),
  photo: z
    .union([
      z
        .string()
        .max(3_000_000)
        .regex(
          /^(data:image\/(png|jpeg|webp);base64,|\/api\/proofs\/[a-f0-9]{64}$)/,
        ),
      z.boolean(),
    ])
    .optional(),
  signature: z
    .string()
    .max(300_000)
    .regex(/^(data:image\/png;base64,|\/api\/proofs\/[a-f0-9]{64}$)/)
    .optional(),
  code: z.string().max(10).optional(),
  sig: z.boolean().optional(),
  pos: point.optional(),
});
const parcel = z.object({
  id: z.string().regex(/^(COL|EXP|MAS)-\d{4}-\d{6}$/),
  type: z.enum(["EXPRESS", "FRET", "MASSE"]),
  sender: text,
  senderTel: text,
  recipient: text,
  recipientTel: text,
  email: text.optional(),
  from: agency.optional(),
  to: agency.optional(),
  pickupAddr: text.optional(),
  dropAddr: text.optional(),
  wanted: text.optional(),
  fromQ: text.optional(),
  toQ: text.optional(),
  pickup: place.nullable().optional(),
  drop: place.nullable().optional(),
  cons: z.enum(["SEC", "FRESH", "FROZEN"]),
  fragile: z.boolean(),
  weight: num.max(30000),
  L: num.optional(),
  W: num.optional(),
  H: num.optional(),
  desc: text,
  service: z.enum(["STANDARD", "EXPRESS", "EXPRESS24"]),
  delivery: z.enum(["retrait", "livraison"]),
  packed: z.enum(["agence", "client"]),
  channel: z.enum(["SMS", "EMAIL", "CALL", "WA"]),
  zone: text,
  vehicle: text.optional(),
  courier: text.optional(),
  reservedFor: text.optional(),
  otp: z.string().max(10),
  price: num,
  payment: payment.nullable(),
  proof: proof.optional(),
  track: z.array(point).max(1000),
  history: z
    .array(z.object({ s: status, t: num, note: text }))
    .min(1)
    .max(10000),
  status,
  created: num,
  updated: num,
});
const trip = z.object({
  from: agency,
  to: agency,
  progress: z.number().min(0).max(1),
  parcels: z.array(text),
  start: num,
  trail: z.array(point).optional(),
});
const vehicle = z.object({
  id: text,
  type: text,
  cap: z.union([num, text]),
  plate: text,
  kind: z.enum(["bus", "mini", "sept", "fret", "masse"]),
  capKg: num.optional(),
  cold: z.boolean().optional(),
  driver: text,
  agency,
  trip: trip.nullable(),
});
const courier = z.object({
  id: text,
  name: text,
  mode: text,
  pos: point,
  job: text.nullable(),
  route: z.array(text).optional(),
});
const booking = z.object({
  id: text,
  tripId: text,
  from: agency,
  to: agency,
  date: text,
  time: text,
  arr: text.optional(),
  veh: text,
  plate: text.optional(),
  seats: z.array(seq),
  names: z.array(text),
  docs: z.array(text).optional(),
  contact: z
    .object({
      tel: text,
      email: text,
      channel: z.enum(["SMS", "EMAIL", "CALL", "WA"]),
    })
    .optional(),
  amount: num,
  method: z.enum(["WAVE", "OM", "CARD", "CASH", "COD"]),
  paid: z.boolean().optional(),
  ref: text.optional(),
  t: num,
  tickets: z.array(text),
});
export const stateSchema = z
  .object({
    v: seq,
    festive: z.boolean(),
    speed: num,
    tarifs: z.object({
      fretBase: num,
      fretKg: num,
      fretKm: num,
      pack: num,
      expBase: num,
      expKg: num,
      expKm: num,
      expressMult: num,
      seat: z.object({ bus: num, mini: num, sept: num }),
      festive: num,
      expressMax: num,
      fretMax: num,
      masseMax: num,
      masseBase: num,
      masseTkm: num,
    }),
    seq: z.object({
      COL: seq,
      EXP: seq,
      MAS: seq,
      RES: seq,
      TKT: seq,
      PAY: seq,
    }),
    parcels: z.array(parcel).max(20000),
    bookings: z.array(booking).max(20000),
    notifs: z
      .array(
        z.object({
          t: num,
          id: text.optional(),
          ch: text,
          to: text,
          msg: text,
        }),
      )
      .max(50000),
    vehicles: z.array(vehicle).min(1).max(500),
    couriers: z.array(courier).min(1).max(500),
  })
  .strict();
