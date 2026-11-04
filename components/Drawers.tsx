"use client";

import { useRouter } from "next/navigation";
import { AG, catLabel, METHODS, MODES, ST } from "@/lib/data";
import { findParcel, parcelScene, pickupOf } from "@/lib/domain";
import { fcfa, km1, tfmt } from "@/lib/format";
import { hav } from "@/lib/geo";
import { assign } from "@/lib/actions";
import { useStore } from "@/lib/store";
import MapCanvas from "./MapCanvas";
import { Waybill } from "./Paper";
import { Pill } from "./ui";

/** Choix manuel d'un livreur, du plus proche au plus éloigné */
export function AssignDrawer({ id }: { id: string }) {
  const { S, act, closeDrawer } = useStore();
  const p = findParcel(S, id);
  if (!p) return null;
  const target = pickupOf(p);
  const list = S.couriers
    .map((c) => ({ c, km: hav(c.pos, target) }))
    .sort((a, b) => Number(!!a.c.job) - Number(!!b.c.job) || a.km - b.km);
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>Affecter un livreur</h3>
        <button className="btn btn-ghost btn-sm" onClick={closeDrawer}>
          Fermer
        </button>
      </div>
      <p className="muted mono">{p.id}</p>
      <div className="stack" style={{ gap: 8 }}>
        {list.map(({ c, km }, i) => (
          <button
            key={c.id}
            className="mission"
            style={{ textAlign: "left", cursor: "pointer" }}
            disabled={!!c.job}
            onClick={() => {
              act((ctx) => assign(ctx, p, c.id));
              closeDrawer();
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>{c.name}</b>
              {c.job ? (
                <span className="pill t-w">En mission</span>
              ) : i === 0 ? (
                <span className="pill t-g">Le plus proche</span>
              ) : (
                <span className="pill t-n">Disponible</span>
              )}
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {c.mode} · {km1(km)} km du ramassage
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Fiche complète d'un colis : carte, preuve, étiquette, historique */
export function ParcelDrawer({ id }: { id: string }) {
  const { S, openDrawer, closeDrawer } = useStore();
  const router = useRouter();
  const p = findParcel(S, id);
  if (!p) return null;
  const canAssign =
    (p.status === ST.CREATED && p.type === "EXPRESS") ||
    (p.status === ST.DEST && p.delivery === "livraison");
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <span className="eyebrow">
            {p.type === "EXPRESS" ? "LIVREX" : "Fret routier"}
          </span>
          <h3 className="mono" style={{ marginTop: 4 }}>
            {p.id}
          </h3>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={closeDrawer}>
          Fermer
        </button>
      </div>
      <div className="row">
        <Pill s={p.status} />
        {canAssign && (
          <button
            className="btn btn-sm btn-blue"
            onClick={() => openDrawer(<AssignDrawer id={p.id} />)}
          >
            Affecter un livreur
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={() => {
            closeDrawer();
            router.push("/suivre?q=" + p.id);
          }}
        >
          Vue client
        </button>
      </div>
      <MapCanvas scene={parcelScene(S, p)} />
      <div className="card stack" style={{ gap: 6, fontSize: 14 }}>
        <div>
          <span className="muted">Expéditeur</span> <b>{p.sender}</b> ·{" "}
          {p.senderTel}
        </div>
        <div>
          <span className="muted">Bénéficiaire</span> <b>{p.recipient}</b> ·{" "}
          {p.recipientTel}
        </div>
        <div>
          <span className="muted">Contenu</span> {p.desc || "—"} · {catLabel(p)}
        </div>
        <div>
          <span className="muted">Paiement</span>{" "}
          {p.payment
            ? `${METHODS[p.payment.mode]} · ${p.payment.ref} · ${p.payment.status}`
            : "—"}{" "}
          · <b className="mono">{p.price ? fcfa(p.price) : "—"}</b>
        </div>
        {p.zone && (
          <div>
            <span className="muted">Emplacement</span> {p.zone}
          </div>
        )}
        {p.type === "MASSE" && (
          <div>
            <span className="muted">Trajet</span> {p.pickupAddr} ·{" "}
            {AG[p.from!].name} → {p.dropAddr} · {AG[p.to!].name}
            {p.vehicle ? " · camion " + p.vehicle : ""}
          </div>
        )}
        {p.type === "FRET" && (
          <div>
            <span className="muted">Trajet</span> {AG[p.from!].name} →{" "}
            {AG[p.to!].name} ·{" "}
            {p.delivery === "livraison"
              ? "livraison à domicile"
              : "retrait en agence"}
          </div>
        )}
        {p.proof && (
          <div>
            <span className="muted">Preuve</span>{" "}
            {p.proof.cni ? "Pièce " + p.proof.cni + " " : ""}
            {p.proof.sig ? "Signature " : ""}
            {p.proof.photo ? "· Photo " : ""}
            {p.proof.absent ? "· Destinataire absent" : ""}
          </div>
        )}
        {p.proof?.signature && <img className="photo-prev" src={p.proof.signature} alt="Signature du destinataire" />}
        {typeof p.proof?.photo === "string" && (
          <img
            className="photo-prev"
            src={p.proof.photo}
            alt="Photo de la livraison"
          />
        )}
      </div>
      <div className="paper label" style={{ maxWidth: "none" }}>
        <Waybill p={p} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Historique</h3>
        <div className="log" style={{ maxHeight: "none" }}>
          {[...p.history].reverse().map((h, i) => (
            <div key={i}>
              <time>{tfmt(h.t)}</time>
              <span>
                <b>{h.s}</b>
                {h.note ? " · " + h.note : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
