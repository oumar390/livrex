"use client";

import { useState } from "react";
import MapCanvas from "@/components/MapCanvas";
import Scanner from "@/components/Scanner";
import SignaturePad from "@/components/SignaturePad";
import { PageHead, Pill } from "@/components/ui";
import {
  assign,
  courierDistance,
  GEOFENCE_KM,
  nextInRoute,
  setStatus,
  teleportCourier,
} from "@/lib/actions";
import { AG, catLabel, ST } from "@/lib/data";
import { dispatchQueue, findParcel, parcelScene } from "@/lib/domain";
import { fcfa, hfmt, kg, km1 } from "@/lib/format";
import { useStore } from "@/lib/store";

/** Bandeau de distance : sur place (vert) ou trop loin (orange), avec raccourci de démo */
function Geofence({
  near,
  km,
  here,
  there,
  onJump,
  demo = false,
}: {
  near: boolean;
  km: number;
  here: string;
  there: string;
  onJump: () => void;
  demo?: boolean;
}) {
  if (near)
    return (
      <div
        className="note"
        style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
      >
        ✓ {here}
      </div>
    );
  return (
    <div
      className="note"
      style={{
        background: "var(--warn-soft)",
        color: "var(--warn)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <span>
        {there} à <b>{km1(km)} km</b>. Action possible à moins de{" "}
        {GEOFENCE_KM * 1000} m.
      </span>
      <button
        className="btn btn-sm"
        onClick={onJump}
        title="Utiliser la position GPS de mon téléphone"
      >
        {demo ? "Simuler mon arrivée" : "Actualiser ma position GPS"}
      </button>
    </div>
  );
}

export default function Livreur() {
  const { S, act, demo } = useStore();
  const [clock] = useState(() => Date.now());
  const [cid, setCid] = useState("L1");
  const [scan, setScan] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sig, setSig] = useState(false);
  const [signature, setSignature] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const c = S.couriers.find((x) => x.id === cid)!;
  const p = c.job ? findParcel(S, c.job) : undefined;
  const queue = dispatchQueue(S);
  const resetProof = () => {
    setScan(false);
    setAbsent(false);
    setPhoto(null);
    setSig(false);
    setCode("");
    setErr("");
  };
  const km = p ? (courierDistance(S, p) ?? 0) : 0;
  /** Contrôle de distance : scan et validation seulement sur place */
  const near = km <= GEOFENCE_KM;
  const meters = Math.round(km * 1000);
  const jump = () => {
    if (demo && p) {
      act((ctx) => teleportCourier(ctx, p));
      setErr("");
      return;
    }
    if (!navigator.geolocation)
      return setErr("La géolocalisation n’est pas disponible.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos.coords.accuracy > 150)
          return setErr("Position trop imprécise. Réessayez à l’extérieur.");
        act((ctx) => {
          const courier = ctx.S.couriers.find((x) => x.id === cid)!;
          courier.pos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        });
        setErr("");
      },
      () =>
        setErr(
          "Autorisez la géolocalisation dans votre navigateur (connexion HTTPS requise).",
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const tooFar = (what: string) =>
    `Vous êtes à ${km1(km)} km. Rapprochez-vous à moins de ${GEOFENCE_KM * 1000} m pour ${what}.`;

  const onScan = (read: string) => {
    if (!p) return;
    setScan(false);
    if (!near) {
      setErr(tooFar("scanner le colis"));
      return;
    }
    if (read.split("|")[0] !== p.id) {
      act((ctx) =>
        ctx.toast(`Code lu : ${read} · ce n'est pas le colis ${p.id}`, "SCAN"),
      );
      return;
    }
    act((ctx) => {
      setStatus(
        ctx,
        p,
        ST.DELIV,
        "Colis récupéré · scan QR " + p.id + " · à " + meters + " m du point",
      );
      ctx.toast("Code lu : " + p.id, "SCAN");
    });
  };

  const confirm = () => {
    if (!p) return;
    if (!near) return setErr(tooFar("valider la livraison"));
    if (absent) {
      if (!photo) return setErr("Ajoutez une photo du colis déposé.");
    } else {
      if (!code.trim())
        return setErr(
          "Le code ne correspond pas à celui envoyé au destinataire.",
        );
      if (!sig) return setErr("Faites signer le destinataire.");
    }
    act((ctx) => {
      p.proof = {
        t: Date.now(),
        absent,
        photo: photo || false,
        sig,
        signature,
        code: code.trim(),
        pos: { ...c.pos },
      };
      if (p.payment && p.payment.status === "À encaisser")
        p.payment.status = "Payé";
      const how = absent
        ? "Déposé en l'absence du destinataire · photo"
        : "Code validé · signature recueillie" + (photo ? " · photo" : "");
      setStatus(ctx, p, ST.DONE, `${how} · à ${meters} m du point`);
      c.job = null;
      nextInRoute(ctx, c.id);
    });
    resetProof();
  };

  const scene = p
    ? parcelScene(S, p)
    : {
        mode: "dkr" as const,
        points: [
          { ...c.pos, kind: "cour" as const, label: c.name.split(" ")[0] },
        ],
      };

  return (
    <section className="view">
      <PageHead
        eyebrow="Application LIVREX Driver"
        title="Missions du livreur"
        lead="Ce qui s'affiche sur le téléphone du livreur : tâche affectée, scan au ramassage, itinéraire et preuve de livraison."
        right={
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="l-c">Livreur</label>
            <select
              className="in"
              id="l-c"
              value={cid}
              onChange={(e) => {
                setCid(e.target.value);
                resetProof();
              }}
            >
              {S.couriers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.mode}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="wrap phone-wrap">
        <div className="phone">
          <div className="phone-top">
            <span>{hfmt(clock)}</span>
            <span>LIVREX · {c.name.split(" ")[0]}</span>
            <span>4G</span>
          </div>
          <div className="phone-body">
            {!p ? (
              <>
                <div className="mission">
                  <b>Aucune course en cours</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Vous êtes visible comme disponible. Les nouvelles courses à
                    proximité apparaîtront ici.
                  </span>
                </div>
                {queue.length > 0 && (
                  <div className="note">
                    {queue.length} course(s) en attente à proximité. Prenez-en
                    une dans la colonne de droite.
                  </div>
                )}
                <MapCanvas scene={scene} className="sq" />
              </>
            ) : (
              <>
                <div className="mission on">
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <b className="mono">{p.id}</b>
                    <Pill s={p.status} />
                  </div>
                  <div className="leg">
                    <i />
                    <div>
                      <b>{p.pickup?.label}</b>
                      <br />
                      <span className="muted">
                        {p.type === "EXPRESS"
                          ? p.sender + " · " + p.senderTel
                          : "Retrait agence"}
                      </span>
                    </div>
                  </div>
                  <div className="leg">
                    <i className="to" />
                    <div>
                      <b>{p.drop?.label}</b>
                      <br />
                      <span className="muted">
                        {p.recipient} · {p.recipientTel}
                      </span>
                    </div>
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span className="muted">
                      {catLabel(p)} · {kg(p.weight)}
                    </span>
                    <b>
                      {p.payment && p.payment.status === "À encaisser"
                        ? "À encaisser " + fcfa(p.price)
                        : "Payé"}
                    </b>
                  </div>
                </div>
                {c.route && c.route.length > 0 && (
                  <div className="note">
                    <b>Tournée</b> · ensuite :{" "}
                    {c.route.map((id, i) => {
                      const n = findParcel(S, id);
                      return (
                        <span key={id}>
                          {i ? ", " : ""}
                          <span className="mono">{id.slice(-3)}</span>{" "}
                          {n?.drop?.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                <MapCanvas scene={scene} className="sq" />
                {p.status === ST.ASSIGNED &&
                  (scan ? (
                    <Scanner
                      expected={p.id}
                      onRead={onScan}
                      onCancel={() => setScan(false)}
                    />
                  ) : (
                    <>
                      <Geofence
                        demo={demo}
                        near={near}
                        km={km}
                        here="Vous êtes au point de ramassage."
                        there="Point de ramassage"
                        onJump={jump}
                      />
                      {err && (
                        <p style={{ fontSize: 12, color: "var(--bad)" }}>
                          {err}
                        </p>
                      )}
                      <button
                        className="btn btn-accent"
                        style={{ width: "100%" }}
                        disabled={!near}
                        onClick={() => {
                          setErr("");
                          setScan(true);
                        }}
                      >
                        Scanner le colis au ramassage
                      </button>
                    </>
                  ))}
                {p.status === ST.DELIV && (
                  <>
                    <Geofence
                      demo={demo}
                      near={near}
                      km={km}
                      here="Vous êtes chez le destinataire."
                      there="Destinataire"
                      onJump={jump}
                    />
                    <div className="lab">Preuve de livraison</div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={absent}
                        onChange={(e) => {
                          setAbsent(e.target.checked);
                          setErr("");
                        }}
                      />
                      <span>Destinataire absent, colis déposé</span>
                    </label>
                    {!absent && (
                      <>
                        <div className="field">
                          <label htmlFor="l-otp">Code du destinataire</label>
                          <input
                            className="in mono"
                            id="l-otp"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                          />
                          <small className="muted">
                            Demandez le code au destinataire.
                          </small>
                        </div>
                        <SignaturePad
                          onChange={(signed, data) => {
                            setSig(signed);
                            setSignature(data || "");
                          }}
                        />
                      </>
                    )}
                    <div className="field">
                      <label htmlFor="l-ph">
                        Photo du colis{absent ? " (obligatoire)" : ""}
                      </label>
                      <input
                        className="in"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        id="l-ph"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (
                            !f.type.startsWith("image/") ||
                            f.size > 2_000_000
                          ) {
                            setErr("Choisissez une image de moins de 2 Mo.");
                            return;
                          }
                          const r = new FileReader();
                          r.onload = () => setPhoto(r.result as string);
                          r.readAsDataURL(f);
                        }}
                      />
                      {photo && (
                        <img
                          className="photo-prev"
                          src={photo}
                          alt="Photo du colis déposé"
                        />
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--bad)" }}>{err}</p>
                    <button
                      className="btn btn-accent"
                      style={{ width: "100%" }}
                      disabled={!near}
                      onClick={confirm}
                    >
                      Confirmer la livraison
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>À dispatcher</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
              Commandes en attente de livreur. L&apos;administration les
              attribue, ou le livreur les prend lui-même.
            </p>
            {queue.length ? (
              <div className="stack" style={{ gap: 8 }}>
                {queue.map((q) => (
                  <div
                    key={q.id}
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span>
                      <b className="mono">{q.id}</b>{" "}
                      <span className="muted">
                        ·{" "}
                        {q.type === "EXPRESS"
                          ? q.fromQ + " → " + q.toQ
                          : "Agence " + AG[q.to!].name + " → " + q.drop?.label}
                      </span>
                    </span>
                    <button
                      className="btn btn-sm"
                      disabled={!!c.job}
                      onClick={() => {
                        act((ctx) => assign(ctx, q, c.id));
                        resetProof();
                      }}
                    >
                      Prendre
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Rien en attente.</p>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Équipe</h3>
            <div className="stack" style={{ gap: 6, fontSize: 14 }}>
              {S.couriers.map((x) => (
                <div
                  key={x.id}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>
                    {x.name} <span className="muted">· {x.mode}</span>
                  </span>
                  {x.job ? (
                    <span className="pill t-w">{x.job}</span>
                  ) : (
                    <span className="pill t-g">Disponible</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
