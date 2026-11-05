"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import MapCanvas from "@/components/MapCanvas";
import { Ticket } from "@/components/Paper";
import { PageHead, Pill } from "@/components/ui";
import { courierDistance } from "@/lib/actions";
import { AG, catLabel, METHODS, MODES, ST } from "@/lib/data";
import {
  agencyPts,
  findParcel,
  flowOf,
  parcelAgency,
  parcelScene,
} from "@/lib/domain";
import { km1, plural, tfmt } from "@/lib/format";
import { roadKm } from "@/lib/geo";
import { useStore } from "@/lib/store";

const SAMPLES = [
  "COL-2026-000001",
  "COL-2026-000003",
  "EXP-2026-000001",
  "MAS-2026-000001",
  "MAS-2026-000002",
  "TKT-2026-000001",
];

function Result({ q }: { q: string }) {
  const { S, user } = useStore();
  if (!q) return null;
  if (!user)
    return (
      <div className="card empty-state">
        <h2>Votre suivi est privé.</h2>
        <p>Connectez-vous pour retrouver votre envoi ou votre billet.</p>
        <Link
          className="btn btn-accent"
          href={"/connexion?next=" + encodeURIComponent("/suivre?q=" + q)}
        >
          Me connecter
        </Link>
      </div>
    );

  if (q.startsWith("TKT") || q.startsWith("RES")) {
    const b = S.bookings.find((b) => b.id === q || b.tickets.includes(q));
    if (!b)
      return (
        <div className="empty">
          Aucun ticket {q}. Vérifiez le numéro dans Mes activités.
        </div>
      );
    const i = Math.max(0, b.tickets.indexOf(q));
    return (
      <div className="stack" style={{ maxWidth: 760 }}>
        <Ticket b={b} i={i} />
        <p className="muted" style={{ fontSize: 13 }}>
          Réservation {b.id} ·{" "}
          {b.paid === false
            ? "à régler au guichet"
            : "payée par " + METHODS[b.method]}{" "}
          · {b.tickets.length} {plural(b.tickets.length, "voyageur")}.
        </p>
      </div>
    );
  }

  const p = findParcel(S, q);
  if (!p)
    return (
      <div className="empty">
        Aucun colis {q}. Le numéro figure sous le code-barres de
        l&apos;étiquette.
      </div>
    );
  const flow = flowOf(p);
  const idx = flow.indexOf(p.status);
  const at = (s: string) => [...p.history].reverse().find((x) => x.s === s);
  const v = p.vehicle ? S.vehicles.find((v) => v.id === p.vehicle) : undefined;
  const c = p.courier ? S.couriers.find((c) => c.id === p.courier) : undefined;

  let live: ReactNode = null;
  if (p.status === ST.TRANSIT && v && v.trip) {
    const rem = Math.round(
      roadKm(v.trip.from, v.trip.to) * (1 - v.trip.progress),
    );
    live =
      v.trip.progress >= 1 ? (
        <>
          Véhicule à l&apos;entrée de {AG[v.trip.to].name}, arrivée en cours
          d&apos;enregistrement.
        </>
      ) : (
        <>
          Véhicule {v.id} · environ <b>{rem} km</b> avant {AG[v.trip.to].name}.
        </>
      );
  }
  if ((p.status === ST.DELIV || p.status === ST.ASSIGNED) && c) {
    const km = courierDistance(S, p) ?? 0;
    live = (
      <>
        {c.name} ({c.mode}) · <b>{km1(km)} km</b>{" "}
        {p.status === ST.DELIV ? "du destinataire" : "du point de ramassage"}.
      </>
    );
  }
  const ag = parcelAgency(p);
  const fallback =
    p.type === "MASSE" && p.status === ST.CREATED
      ? `Commande enregistrée. Un camion adapté va être réservé pour l'enlèvement à ${p.pickupAddr}.`
      : p.type === "MASSE" && p.status === ST.PLANNED && v
        ? `Camion ${v.id} (${v.type}) réservé. Le chauffeur vous appellera avant l'enlèvement.`
        : p.status === ST.DEST && p.delivery === "retrait"
          ? `Disponible à l'agence de ${AG[p.to!].name} (${AG[p.to!].hours}). Présentez votre pièce d'identité et le code disponible dans Mes activités.`
          : p.zone && ag
            ? `En agence ${AG[ag].name} · ${p.zone}.`
            : "Dernière mise à jour " + tfmt(p.updated) + ".";

  return (
    <div className="split">
      <div className="card">
        <div className="card-h">
          <div>
            <span className="eyebrow">
              {MODES[p.type].label} · {catLabel(p)}
            </span>
            <h3 className="mono" style={{ marginTop: 4 }}>
              {p.id}
            </h3>
          </div>
          <Pill s={p.status} />
        </div>
        <p style={{ marginBottom: 16 }}>
          <b>{p.type === "EXPRESS" ? p.fromQ : AG[p.from!].name}</b> →{" "}
          <b>{p.type === "EXPRESS" ? p.toQ : AG[p.to!].name}</b>{" "}
          <span className="muted">
            · {(+p.weight).toLocaleString("fr-FR")} kg ·{" "}
            {p.delivery === "livraison"
              ? "livraison à domicile"
              : "retrait en agence"}
          </span>
        </p>
        <p className="note" style={{ marginBottom: 20 }}>
          Code de remise : <b className="mono">{p.otp}</b>. À partager
          uniquement au moment de la remise.
        </p>
        <ol className="timeline">
          {flow.map((s, i) => {
            const h = at(s);
            const cls = i < idx ? "done" : i === idx ? "now" : "todo";
            return (
              <li key={s} className={cls}>
                <span className="dot" />
                <div>
                  <b>{s}</b>
                  {h && h.note && <small>{h.note}</small>}
                </div>
                <time>{h ? tfmt(h.t) : ""}</time>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="stack">
        <div className="card">
          <MapCanvas scene={parcelScene(S, p)} className="tall" />
          <div style={{ marginTop: 12 }}>
            <div className="note">{live || fallback}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Suivre() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get("q") || "").trim().toUpperCase();
  const [input, setInput] = useState(initial);
  const q = initial;
  const { S, user } = useStore();

  const go = (v: string) =>
    router.replace("/suivre?q=" + encodeURIComponent(v.trim().toUpperCase()));
  const showMap = !q;
  return (
    <section className="view">
      <PageHead
        eyebrow="Suivi"
        title="Où en est mon colis ?"
        lead="Saisissez le numéro inscrit sur l'étiquette, la lettre de voiture ou votre ticket."
      />
      <div className="wrap">
        <form
          className="search"
          style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            go(input);
          }}
        >
          <div className="field">
            <label htmlFor="tq">Numéro</label>
            <input
              className="in mono"
              id="tq"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="COL-2026-000001"
            />
          </div>
          <button className="btn btn-accent" type="submit">
            Suivre
          </button>
        </form>
        <div style={{ marginTop: 22 }}>
          {showMap ? (
            <div className="card">
              <MapCanvas scene={{ mode: "sn", points: agencyPts() }} />
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {Object.keys(AG).length} agences ·{" "}
                {S.vehicles.filter((v) => v.trip).length} véhicule(s) en route
                en ce moment.
              </p>
            </div>
          ) : (
            <Result q={q} />
          )}
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Suivre />
    </Suspense>
  );
}
