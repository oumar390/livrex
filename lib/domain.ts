/* Règles métier pures : aucune dépendance à React, réutilisables côté serveur plus tard. */
import { AG, LINES, MODE_CODES, modeRange, ST, zoneOf } from "./data";
import { dIso, hashN, pad } from "./format";
import { hav, roadKm, vehPos } from "./geo";
import { seatPrice } from "./pricing";
import type {
  AgencyCode,
  AppState,
  Cons,
  Courier,
  Mode,
  Tarifs,
  LatLon,
  MapPoint,
  MapScene,
  Parcel,
  Status,
  Vehicle,
} from "./types";

export const findParcel = (S: AppState, id: string) =>
  S.parcels.find((p) => p.id === id);
export const vehOf = (S: AppState, id: string) =>
  S.vehicles.find((v) => v.id === id)!;

/* ---------- Parcours d'un colis ---------- */
export const FLOW_FRET_R: Status[] = [
  ST.CREATED,
  ST.PREP,
  ST.STORED,
  ST.READY,
  ST.TRANSIT,
  ST.ARRIVED,
  ST.DEST,
  ST.PICKED,
];
export const FLOW_FRET_L: Status[] = [
  ST.CREATED,
  ST.PREP,
  ST.STORED,
  ST.READY,
  ST.TRANSIT,
  ST.ARRIVED,
  ST.DEST,
  ST.ASSIGNED,
  ST.DELIV,
  ST.DONE,
];
export const FLOW_EXP: Status[] = [ST.CREATED, ST.ASSIGNED, ST.DELIV, ST.DONE];
/** Transport de masse : camion dédié, de l'enlèvement à la livraison sur site */
export const FLOW_MASSE: Status[] = [
  ST.CREATED,
  ST.PLANNED,
  ST.TRANSIT,
  ST.DONE,
];
export const flowOf = (p: Parcel) =>
  p.type === "EXPRESS"
    ? FLOW_EXP
    : p.type === "MASSE"
      ? FLOW_MASSE
      : p.delivery === "livraison"
        ? FLOW_FRET_L
        : FLOW_FRET_R;

/* ---------- Choix du type de transport selon le poids ---------- */
/** Types possibles pour un poids : ceux dont le seuil maximal n'est pas dépassé */
export const allowedModes = (t: Tarifs, kg: number): Mode[] =>
  MODE_CODES.filter((m) => kg <= modeRange(t, m)[1]);
/** Type proposé par défaut : le plus petit qui convient */
export const modeForWeight = (t: Tarifs, kg: number): Mode =>
  kg <= t.expressMax ? "EXPRESS" : kg <= t.fretMax ? "FRET" : "MASSE";

export const placeName = (p: Parcel, which: "from" | "to") =>
  p.type === "EXPRESS"
    ? which === "to"
      ? p.toQ!
      : p.fromQ!
    : AG[p[which]!].name;

export const routeLabel = (p: Parcel) =>
  p.type === "EXPRESS"
    ? `${p.fromQ} → ${p.toQ}`
    : `${AG[p.from!].name} → ${AG[p.to!].name}`;

/** Agence où se trouve physiquement un colis de fret, sinon null */
export function parcelAgency(p: Parcel): AgencyCode | null {
  if (p.type !== "FRET") return null;
  if (
    ([ST.CREATED, ST.PREP, ST.STORED, ST.READY] as Status[]).includes(p.status)
  )
    return p.from!;
  if (([ST.ARRIVED, ST.DEST, ST.ASSIGNED] as Status[]).includes(p.status))
    return p.to!;
  return null;
}

export function nextZone(
  S: AppState,
  ag: AgencyCode,
  cons: Cons,
  fragile: boolean,
) {
  const z = zoneOf(cons, fragile);
  const n = S.parcels.filter(
    (p) => parcelAgency(p) === ag && p.zone && p.zone.startsWith(z),
  ).length;
  return `${z} ${pad((n % 6) + 1, 2)}`;
}

/** Colis qui attendent un livreur (y compris ceux déjà réservés dans une tournée) */
export const needsCourier = (p: Parcel) =>
  (p.status === ST.CREATED && p.type === "EXPRESS") ||
  (p.status === ST.DEST && p.delivery === "livraison");

/** Colis en attente d'un livreur et pas encore réservés dans une tournée */
export const dispatchQueue = (S: AppState) =>
  S.parcels.filter((p) => needsCourier(p) && !p.reservedFor);

export const pickupOf = (p: Parcel): LatLon => p.pickup || AG[p.to!];

export const nearestFree = (S: AppState, target: LatLon): Courier | undefined =>
  S.couriers
    .filter((c) => !c.job)
    .sort((a, b) => hav(a.pos, target) - hav(b.pos, target))[0];

/**
 * Optimisation de tournée simple : regroupe les courses par secteur de Dakar
 * puis les ordonne par plus proche voisin depuis le point de départ.
 */
export function planRoutes(S: AppState) {
  const q = dispatchQueue(S);
  const sector = (pt: LatLon) =>
    pt.lon > -17.4
      ? "Banlieue est"
      : pt.lat > 14.73
        ? "Nord"
        : pt.lat > 14.7
          ? "Centre"
          : "Sud · Plateau";
  const groups: Record<string, Parcel[]> = {};
  q.forEach((p) => {
    const k = sector(p.drop || pickupOf(p));
    (groups[k] = groups[k] || []).push(p);
  });
  return Object.entries(groups).map(([name, list]) => {
    const order: Parcel[] = [];
    let cur: LatLon = pickupOf(list[0]);
    const rest = [...list];
    let dist = 0;
    while (rest.length) {
      rest.sort((a, b) => hav(cur, pickupOf(a)) - hav(cur, pickupOf(b)));
      const n = rest.shift()!;
      dist += hav(cur, pickupOf(n)) + hav(pickupOf(n), n.drop || pickupOf(n));
      cur = n.drop || pickupOf(n);
      order.push(n);
    }
    return {
      name,
      order,
      km: Math.round(dist * 1.35 * 10) / 10,
      courier: nearestFree(S, pickupOf(order[0])),
    };
  });
}

/* ---------- Voyageurs ---------- */
export interface TripOption {
  id: string;
  from: AgencyCode;
  to: AgencyCode;
  date: string;
  time: string;
  arr: string;
  dur: number;
  km: number;
  veh: Vehicle;
  free: number;
  occ: Set<number>;
  price: number;
  past: boolean;
}

/** Sièges occupés : réservations réelles + remplissage simulé déterministe */
export function occupied(S: AppState, id: string, cap: number) {
  const set = new Set<number>();
  (S.seatReservations?.[id] || []).forEach((s) => set.add(s));
  S.bookings
    .filter((b) => b.tripId === id)
    .forEach((b) => b.seats.forEach((s) => set.add(s)));
  return set;
}

export function tripsFor(
  S: AppState,
  q: { from: AgencyCode; to: AgencyCode; date: string },
  now = Date.now(),
): TripOption[] {
  const out: TripOption[] = [];
  const nd = new Date(now);
  LINES.forEach(([a, b, times, vid]) => {
    let f: 0 | 1 | null = null;
    if (a === q.from && b === q.to) f = 0;
    else if (b === q.from && a === q.to) f = 1;
    if (f === null) return;
    times.forEach((tm) => {
      /** Le retour part une heure après l'aller, de l'autre côté */
      const ht = f
        ? String((+tm.slice(0, 2) + 1) % 24).padStart(2, "0") + tm.slice(2)
        : tm;
      const v = vehOf(S, vid);
      const cap = v.cap as number;
      const km = roadKm(q.from, q.to);
      const dur = Math.round((km / 62) * 60);
      const id = `${q.from}-${q.to}-${q.date}-${ht}`;
      const occ = occupied(S, id, cap);
      const [hh, mm] = ht.split(":").map(Number);
      const arr = new Date(2000, 0, 1, hh, mm + dur);
      const past =
        q.date === dIso(now) &&
        hh * 60 + mm < nd.getHours() * 60 + nd.getMinutes();
      out.push({
        id,
        from: q.from,
        to: q.to,
        date: q.date,
        time: ht,
        arr: arr.toTimeString().slice(0, 5),
        dur,
        km,
        veh: v,
        free: cap - occ.size,
        occ,
        price: seatPrice(S.tarifs, S.festive, q.from, q.to, v.kind),
        past,
      });
    });
  });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/* ---------- Statistiques ---------- */
export function stats(S: AppState) {
  const ps = S.parcels,
    c = (s: Status) => ps.filter((p) => p.status === s).length;
  const paid = ps.filter((p) => p.payment && p.payment.status === "Payé");
  const done = ps.filter((p) => p.status === ST.DONE || p.status === ST.PICKED);
  /** Livraison à l'heure : express < 2 h, standard le jour même, fret < 72 h */
  const onTime = done.filter((p) => {
    const end = p.history[p.history.length - 1].t,
      dur = end - p.created;
    const lim =
      p.type === "EXPRESS"
        ? (p.service === "EXPRESS" ? 2 : 12) * 36e5
        : (p.service === "EXPRESS24" ? 24 : 72) * 36e5;
    return dur <= lim;
  }).length;
  const pax = S.bookings
    .filter((b) => b.paid)
    .reduce((s, b) => s + b.amount, 0);
  return {
    total: ps.length,
    transit: c(ST.TRANSIT),
    stock: c(ST.STORED) + c(ST.READY) + c(ST.DEST) + c(ST.ARRIVED),
    done: done.length,
    onTime,
    onTimePct: done.length ? Math.round((onTime / done.length) * 100) : 100,
    deliv: c(ST.ASSIGNED) + c(ST.DELIV),
    res: S.bookings.length,
    pax: S.bookings.reduce((s, b) => s + b.seats.length, 0),
    vehOn: S.vehicles.filter((v) => v.trip).length,
    cash: paid.reduce((s, p) => s + p.price, 0) + pax,
    toCollect:
      ps
        .filter((p) => p.payment && p.payment.status === "À encaisser")
        .reduce((s, p) => s + p.price, 0) +
      S.bookings.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0),
    rev: {
      pax,
      fret: paid
        .filter((p) => p.type === "FRET")
        .reduce((s, p) => s + p.price, 0),
      exp: paid
        .filter((p) => p.type === "EXPRESS")
        .reduce((s, p) => s + p.price, 0),
      masse: paid
        .filter((p) => p.type === "MASSE")
        .reduce((s, p) => s + p.price, 0),
    },
  };
}

/* ---------- Scènes de carte ---------- */
export const agencyPts = (): MapPoint[] =>
  (Object.keys(AG) as AgencyCode[]).map((k) => ({
    lat: AG[k].lat,
    lon: AG[k].lon,
    kind: "agency",
    label: AG[k].name,
  }));

export function parcelScene(S: AppState, p: Parcel): MapScene {
  if (
    p.type === "EXPRESS" ||
    ((p.status === ST.ASSIGNED ||
      p.status === ST.DELIV ||
      p.status === ST.DONE) &&
      p.drop)
  ) {
    const c = S.couriers.find((c) => c.id === p.courier);
    const pick = p.pickup || {
      ...AG[p.to!],
      label: "Agence " + AG[p.to!].name,
    };
    const pts: MapPoint[] = [
      { ...pick, kind: "pick", label: pick.label },
      { ...p.drop!, kind: "drop", label: p.drop!.label },
    ];
    if (c && p.status !== ST.DONE)
      pts.push({ ...c.pos, kind: "cour", label: c.name.split(" ")[0] });
    return {
      mode: "dkr",
      routes: [[pick, p.drop!]],
      points: pts,
      trail: p.track,
    };
  }
  const v = p.vehicle ? S.vehicles.find((v) => v.id === p.vehicle) : undefined;
  const pts = agencyPts();
  if (p.status === ST.TRANSIT && v && v.trip)
    pts.push({ ...vehPos(v), kind: "veh", label: v.id });
  return {
    mode: "sn",
    routes: [[AG[p.from!], AG[p.to!]]],
    points: pts,
    trail: p.status === ST.TRANSIT ? p.track : [],
  };
}
