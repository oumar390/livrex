import { isDeepStrictEqual } from "node:util";
import { retainProofs } from "@/lib/server/proofs";
import {
  currentUser,
  requireUser,
  sameOrigin,
  body,
  ApiError,
  failure,
} from "@/lib/server/auth";
import { db, readState, writeState, transaction, audit } from "@/lib/server/db";
import { stateSchema } from "@/lib/server/state-schema";
import type { AppState } from "@/lib/types";
import { ALL_STATUSES } from "@/lib/data";
export async function GET() {
  const user = await currentUser();
  const { S, revision } = readState();
  if (!user || user.role === "CLIENT") {
    const ids = new Set(
      user
        ? (
            db
              .prepare("SELECT id FROM ownership WHERE user_id=?")
              .all(user.id) as { id: string }[]
          ).map((r) => r.id)
        : [],
    );
    S.seatReservations = Object.fromEntries(
      [...new Set(S.bookings.map((b) => b.tripId))].map((id) => [
        id,
        S.bookings.filter((b) => b.tripId === id).flatMap((b) => b.seats),
      ]),
    );
    S.parcels = S.parcels.filter((p) => ids.has(p.id));
    S.bookings = S.bookings.filter((b) => ids.has(b.id));
    S.notifs = S.notifs.filter((n) => n.id && ids.has(n.id));
    S.couriers = S.couriers.filter((c) =>
      S.parcels.some((p) => p.courier === c.id),
    );
    S.vehicles.forEach((v) => (v.trip = null));
  }
  if (user?.role === "LIVREUR")
    S.parcels.forEach((p) => {
      p.otp = "";
      if (p.proof) delete p.proof.code;
    });
  return Response.json(
    { S, revision, user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireUser([
      "ADMIN",
      "GESTIONNAIRE",
      "AGENT",
      "CHAUFFEUR",
      "LIVREUR",
    ]);
    const b = await body(req);
    transaction(() => {
      const { S: old, revision } = readState();
      if (b.revision !== revision) throw new Error("CONFLICT");
      const validated = stateSchema.safeParse(b.S);
      if (!validated.success)
        throw new ApiError(422, "Les données transmises ne sont pas valides.");
      const s = validated.data as AppState;
      if (
        !s ||
        !Array.isArray(s.parcels) ||
        !Array.isArray(s.vehicles) ||
        !Array.isArray(s.couriers) ||
        !Array.isArray(s.bookings) ||
        !Array.isArray(s.notifs) ||
        !s.seq ||
        !s.tarifs ||
        s.v !== old.v
      )
        throw new ApiError(422, "Données invalides.");
      const allowed =
        user.role === "ADMIN"
          ? [
              "parcels",
              "vehicles",
              "couriers",
              "notifs",
              "seq",
              "tarifs",
              "festive",
            ]
          : ["parcels", "vehicles", "couriers", "notifs", "seq"];
      for (const k of Object.keys(s) as (keyof AppState)[])
        if (!allowed.includes(k) && !isDeepStrictEqual(s[k], old[k]))
          throw new ApiError(403, "Paramètre réservé à l’administration.");
      if (
        s.bookings.length !== old.bookings.length ||
        !isDeepStrictEqual(s.bookings, old.bookings)
      )
        throw new ApiError(403, "Utilisez le parcours de réservation.");
      if (old.parcels.some((p) => !s.parcels.some((n) => n.id === p.id)))
        throw new ApiError(422, "La suppression des envois est interdite.");
      if (new Set(s.parcels.map((p) => p.id)).size !== s.parcels.length)
        throw new ApiError(422, "Numéros dupliqués.");
      if (
        user.role === "LIVREUR" &&
        !isDeepStrictEqual(s.vehicles, old.vehicles)
      )
        throw new ApiError(403, "La flotte est réservée au gestionnaire.");
      if (
        user.role === "CHAUFFEUR" &&
        !isDeepStrictEqual(s.couriers, old.couriers)
      )
        throw new ApiError(403, "Les livreurs sont gérés par le gestionnaire.");
      if (user.role === "CHAUFFEUR")
        for (const v of s.vehicles) {
          const prev = old.vehicles.find((n) => n.id === v.id);
          if (!prev) throw new ApiError(403, "Véhicule inconnu.");
          for (const k of Object.keys(v) as (keyof typeof v)[])
            if (
              !["trip", "agency"].includes(k) &&
              !isDeepStrictEqual(v[k], prev[k])
            )
              throw new ApiError(
                403,
                "La configuration de la flotte est réservée au gestionnaire.",
              );
        }
      if (
        s.tarifs.expressMax > s.tarifs.fretMax ||
        s.tarifs.fretMax > s.tarifs.masseMax
      )
        throw new ApiError(422, "Les seuils de poids doivent être croissants.");
      for (const k of Object.keys(s.seq) as (keyof typeof s.seq)[])
        if (s.seq[k] < old.seq[k])
          throw new ApiError(
            422,
            "Les compteurs ne peuvent pas être diminués.",
          );
      for (const p of s.parcels) {
        if (
          !ALL_STATUSES.includes(p.status) ||
          !Array.isArray(p.history) ||
          !p.history.length ||
          !Number.isFinite(p.weight) ||
          p.weight < 0 ||
          !Number.isFinite(p.price) ||
          p.price < 0
        )
          throw new ApiError(422, "Colis invalide.");
        const prev = old.parcels.find((n) => n.id === p.id);
        if (prev && ["CHAUFFEUR", "LIVREUR"].includes(user.role)) {
          const fields =
            user.role === "CHAUFFEUR"
              ? [
                  "vehicle",
                  "track",
                  "status",
                  "history",
                  "updated",
                  "zone",
                  "proof",
                ]
              : [
                  "courier",
                  "reservedFor",
                  "pickup",
                  "track",
                  "status",
                  "history",
                  "updated",
                  "proof",
                  "payment",
                  "otp",
                ];
          for (const k of new Set([...Object.keys(p), ...Object.keys(prev)]))
            if (
              !fields.includes(k) &&
              !isDeepStrictEqual(
                p[k as keyof typeof p],
                prev[k as keyof typeof prev],
              )
            )
              throw new ApiError(
                403,
                "Cette modification est réservée au gestionnaire.",
              );
          if (user.role === "LIVREUR") {
            p.otp = prev.otp;
            if (
              p.status !== prev.status &&
              !["Livreur affecté", "En livraison", "Livré"].includes(p.status)
            )
              throw new ApiError(403, "Étape non autorisée.");
            if (p.status === "Livré" && prev.status !== "Livré") {
              if (
                !p.proof ||
                (p.proof.absent
                  ? !p.proof.photo
                  : !p.proof.signature || p.proof.code !== prev.otp)
              )
                throw new ApiError(
                  422,
                  "Code destinataire et signature requis, ou photo en cas d’absence.",
                );
              delete p.proof.code;
            }
          }
        }
        if (!prev && !["ADMIN", "GESTIONNAIRE", "AGENT"].includes(user.role))
          throw new ApiError(403, "Création réservée au guichet.");
        if (
          p.payment?.status === "Payé" &&
          prev?.payment?.status !== "Payé" &&
          !["CASH", "COD"].includes(p.payment.mode)
        )
          throw new ApiError(
            422,
            "Le paiement en ligne n’est pas configuré. Utilisez les espèces.",
          );
      }
      for (const [k, v] of Object.entries(s.tarifs)) {
        if (k === "seat") {
          if (
            Object.values(v).some(
              (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0,
            )
          )
            throw new ApiError(422, "Tarif invalide.");
        } else if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
          throw new ApiError(422, "Tarif invalide.");
      }
      retainProofs(s);
      writeState(s, revision);
      audit(user.id, "operations.updated");
    });
    return Response.json({ ok: true, revision: readState().revision });
  } catch (e) {
    return failure(e);
  }
}
