"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ticket } from "@/components/Paper";
import { Choice, PageHead, Stepper } from "@/components/ui";
import {
  AG,
  AG_CODES,
  BAG,
  CHANNELS,
  COMFORT,
  DRIVERS,
  METHODS,
} from "@/lib/data";
import { tripsFor, type TripOption } from "@/lib/domain";
import { dfmt, dIso, durTxt, fcfa, nf, pad, plural } from "@/lib/format";
import { roadKm } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { AgencyCode, Booking, Channel, Method } from "@/lib/types";

type Stage = "list" | "seats" | "review" | "done";
interface Pax {
  name: string;
  doc: string;
}
interface Err {
  k: string;
  m: string;
}

const STEPS = ["Trajet", "Places et voyageurs", "Confirmation", "Ticket"];

function TripInfo({ t }: { t: TripOption }) {
  const it: [string, string][] = [
    ["Départ", `${AG[t.from].name} · ${AG[t.from].site}`],
    ["Arrivée", `${AG[t.to].name} · ${AG[t.to].site}`],
    ["Date", dfmt(t.date)],
    ["Horaires", `${t.time} → ${t.arr} (estimée)`],
    ["Durée", durTxt(t.dur)],
    ["Distance", `${t.km} km`],
    ["Véhicule", `${t.veh.type} · ${t.veh.id}`],
    ["Immatriculation", t.veh.plate],
    ["Capacité", `${t.veh.cap} places`],
    ["Places libres", `${t.free}`],
    ["Chauffeur", DRIVERS[t.veh.driver]],
    ["Bagages inclus", BAG[t.veh.kind] || "—"],
    ["Confort", COMFORT[t.veh.kind] || "—"],
    ["Prix par voyageur", fcfa(t.price)],
  ];
  return (
    <dl className="info">
      {it.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Voyager() {
  const { S, rev, user, refresh, toast } = useStore();
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());
  const [saved] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("livrex-travel-draft") || "null",
      ) as {
        q: { from: AgencyCode; to: AgencyCode; date: string; pax: number };
        stage: Stage;
        tripId: string | null;
        seats: number[];
        pax: Pax[];
        contact: { tel: string; email: string; channel: Channel };
      } | null;
    } catch {
      return null;
    }
  });
  const [q, setQ] = useState(
    saved?.q || {
      from: "DKR" as AgencyCode,
      to: "TBA" as AgencyCode,
      date: dIso(now + 86400000),
      pax: 1,
    },
  );
  const [form, setForm] = useState(q);
  const [stage, setStage] = useState<Stage>(saved?.stage || "list");
  const [tripId, setTripId] = useState<string | null>(saved?.tripId || null);
  const [seats, setSeats] = useState<number[]>(saved?.seats || []);
  const [pax, setPax] = useState<Pax[]>(saved?.pax || []);
  const [contact, setContact] = useState<{
    tel: string;
    email: string;
    channel: Channel;
  }>(saved?.contact || { tel: "", email: "", channel: "SMS" });
  useEffect(() => {
    try {
      if (stage === "done") sessionStorage.removeItem("livrex-travel-draft");
      else
        sessionStorage.setItem(
          "livrex-travel-draft",
          JSON.stringify({ q, stage, tripId, seats, pax, contact }),
        );
    } catch {}
  }, [q, stage, tripId, seats, pax, contact]);
  const [method, setMethod] = useState<Method>("CASH");
  const [payTel, setPayTel] = useState("");
  const [payErr, setPayErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [errs, setErrs] = useState<Err[]>([]);
  const [done, setDone] = useState<Booking | null>(null);

  // Les trajets se recalculent quand l'état change (réservations, mode forte demande)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trips = useMemo(() => tripsFor(S, q), [S, q, rev]);
  const trip = trips.find((t) => t.id === tripId) || null;
  const open = trips.filter((t) => !t.past);
  const scrollTop = () =>
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const bad = (k: string) => errs.some((e) => e.k === k) || undefined;
  const i = { list: 0, seats: 1, review: 2, done: 3 }[stage];
  const mm = method === "WAVE" || method === "OM";

  const choose = (t: TripOption) => {
    setTripId(t.id);
    setSeats([]);
    setErrs([]);
    setPax(
      Array.from({ length: q.pax }, (_, k) => pax[k] || { name: "", doc: "" }),
    );
    setStage("seats");
    scrollTop();
  };

  const toggleSeat = (k: number) => {
    setSeats((s) =>
      s.includes(k)
        ? s.filter((x) => x !== k)
        : s.length < q.pax
          ? [...s, k]
          : [...s.slice(1), k],
    );
    setErrs((e) => e.filter((x) => x.k !== "seats"));
  };

  const validate = () => {
    const n = q.pax,
      e: Err[] = [];
    if (seats.length !== n)
      e.push({
        k: "seats",
        m: `Sélectionnez ${n} ${plural(n, "siège")} sur le plan (${seats.length} ${plural(seats.length, "choisi")}).`,
      });
    pax.forEach((p, k) => {
      if (p.name.trim().length < 3)
        e.push({ k: "name" + k, m: `Saisissez le nom du voyageur ${k + 1}.` });
    });
    if (contact.tel.replace(/\D/g, "").length < 9)
      e.push({ k: "tel", m: "Saisissez un numéro de téléphone à 9 chiffres." });
    if (contact.email.trim() && !/^\S+@\S+\.\S+$/.test(contact.email.trim()))
      e.push({ k: "email", m: "L'adresse e-mail n'est pas valide." });
    if (contact.channel === "EMAIL" && !contact.email.trim())
      e.push({
        k: "email",
        m: "Indiquez un e-mail pour recevoir le ticket par e-mail.",
      });
    setErrs(e);
    if (e.length) return;
    setPayTel((p) => p || contact.tel);
    setStage("review");
    scrollTop();
  };

  const requestKey = useRef("");
  const pay = async () => {
    if (!trip) return;
    if (!user) {
      router.push("/connexion?next=/voyager");
      return;
    }
    setPayErr("");
    setPaying(true);
    try {
      requestKey.current ||= crypto.randomUUID();
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey.current,
        },
        body: JSON.stringify({
          from: trip.from,
          to: trip.to,
          date: trip.date,
          tripId: trip.id,
          seats,
          names: pax.map((p) => p.name.trim()),
          contact,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        requestKey.current = "";
        await refresh();
        throw new Error(data.error);
      }
      await refresh();
      setDone(data);
      setStage("done");
      requestKey.current = "";
      scrollTop();
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "Réservation impossible.");
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setStage("list");
    setTripId(null);
    setDone(null);
    setSeats([]);
    setPax([]);
  };

  return (
    <section className="view">
      <PageHead
        eyebrow="Lifekhalifa Tours"
        title="Votre prochain voyage commence ici."
        lead="Choisissez votre destination, votre départ et votre place. Retrouvez votre billet directement sur votre téléphone."
      />
      <div className="wrap">
        <div ref={top} className="vsteps">
          <Stepper steps={STEPS} current={i} prefix="Étape" />
        </div>

        {stage === "list" && (
          <>
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.from === form.to) {
                  toast("Choisissez une destination différente du départ.");
                  return;
                }
                setQ({ ...form, date: form.date || dIso(Date.now()) });
              }}
            >
              <div className="field">
                <label htmlFor="vs-from">Départ</label>
                <select
                  className="in"
                  id="vs-from"
                  value={form.from}
                  onChange={(e) =>
                    setForm({ ...form, from: e.target.value as AgencyCode })
                  }
                >
                  {AG_CODES.map((k) => (
                    <option key={k} value={k}>
                      {AG[k].name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="vs-to">Destination</label>
                <select
                  className="in"
                  id="vs-to"
                  value={form.to}
                  onChange={(e) =>
                    setForm({ ...form, to: e.target.value as AgencyCode })
                  }
                >
                  {AG_CODES.map((k) => (
                    <option key={k} value={k}>
                      {AG[k].name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="vs-date">Date</label>
                <input
                  className="in"
                  type="date"
                  id="vs-date"
                  value={form.date}
                  min={dIso(now)}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="vs-pax">Voyageurs</label>
                <select
                  className="in"
                  id="vs-pax"
                  value={form.pax}
                  onChange={(e) => setForm({ ...form, pax: +e.target.value })}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-accent" type="submit">
                Rechercher
              </button>
            </form>
            {S.festive && (
              <div className="festive">
                <b>Période de forte demande</b>
                <span>
                  Tarifs majorés de {S.tarifs.festive} % et départs
                  supplémentaires selon les règles fixées par la direction.
                </span>
              </div>
            )}
            <div
              className="row"
              style={{ justifyContent: "space-between", margin: "24px 0 12px" }}
            >
              <h3 style={{ fontSize: 19 }}>
                {AG[q.from].name} → {AG[q.to].name}{" "}
                <span
                  className="muted"
                  style={{ font: "500 14px var(--f-body)" }}
                >
                  · {dfmt(q.date)} · {roadKm(q.from, q.to)} km · {q.pax}{" "}
                  {plural(q.pax, "voyageur")}
                </span>
              </h3>
              <span className="muted" style={{ fontSize: 13 }}>
                {open.length} {plural(open.length, "départ")}{" "}
                {plural(open.length, "disponible")}
              </span>
            </div>
            {trips.length > 0 && !open.length && (
              <div
                className="note"
                style={{
                  marginBottom: 12,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <span>Tous les départs de ce jour sont déjà partis.</span>
                <button
                  className="btn btn-sm btn-accent"
                  onClick={() => {
                    const d = dIso(
                      new Date(q.date + "T12:00").getTime() + 864e5,
                    );
                    setQ({ ...q, date: d });
                    setForm({ ...form, date: d });
                  }}
                >
                  Voir les départs du lendemain
                </button>
              </div>
            )}
            <div className="stack">
              {trips.length ? (
                trips.map((t) => {
                  const pct = Math.round(
                    (1 - t.free / (t.veh.cap as number)) * 100,
                  );
                  const dis = t.past || t.free < q.pax;
                  return (
                    <div className="trip" key={t.id}>
                      <div className="time">
                        {t.time}
                        <small>arr. {t.arr}</small>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <b>
                          {t.veh.type} · {t.veh.id}
                        </b>
                        <div className="veh">
                          {AG[t.from].site} → {AG[t.to].site} · {durTxt(t.dur)}{" "}
                          de route · {t.veh.plate}
                        </div>
                        <div className="veh">
                          {COMFORT[t.veh.kind] || ""} · {BAG[t.veh.kind] || ""}
                        </div>
                        <div className="seatbar" title={`${pct} % occupé`}>
                          <i style={{ width: pct + "%" }} />
                        </div>
                        <div className="veh" style={{ marginTop: 4 }}>
                          {t.free} {plural(t.free, "place")}{" "}
                          {plural(t.free, "libre")} sur {t.veh.cap}
                        </div>
                      </div>
                      <div className="price">
                        {fcfa(t.price)}
                        <small>par voyageur</small>
                      </div>
                      <button
                        className={`btn ${dis ? "" : "btn-accent"}`}
                        disabled={dis}
                        onClick={() => choose(t)}
                      >
                        {t.past
                          ? "Parti"
                          : t.free < q.pax
                            ? "Complet"
                            : "Choisir ce trajet"}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="empty">
                  Pas de ligne directe entre {AG[q.from].name} et{" "}
                  {AG[q.to].name} pour l&apos;instant. Essayez via Thiès ou
                  Kaolack.
                </div>
              )}
            </div>
          </>
        )}

        {stage === "seats" &&
          trip &&
          (() => {
            const n = q.pax,
              cap = trip.veh.cap as number;
            const cols = cap <= 7 ? 3 : 4,
              rows = Math.ceil(cap / cols);
            const cells: ReactNode[] = [];
            for (let r = 0; r < rows; r++)
              for (let c = 0; c < cols; c++) {
                const k = r * cols + c + 1;
                if (cols === 4 && c === 2)
                  cells.push(<span key={`g${r}`} className="seat gap" />);
                if (k > cap) {
                  cells.push(<span key={`x${k}`} className="seat gap" />);
                  continue;
                }
                const occ = trip.occ.has(k);
                cells.push(
                  <button
                    key={k}
                    type="button"
                    className="seat"
                    disabled={occ}
                    aria-pressed={seats.includes(k)}
                    aria-label={`Siège ${k}${occ ? ", occupé" : ""}`}
                    onClick={() => toggleSeat(k)}
                  >
                    {k}
                  </button>,
                );
              }
            return (
              <div className="book">
                <div className="stack">
                  <div className="card">
                    <div className="card-h">
                      <h3>Votre trajet</h3>
                      <button
                        className="btn btn-sm"
                        onClick={() => setStage("list")}
                      >
                        Changer de trajet
                      </button>
                    </div>
                    <TripInfo t={trip} />
                  </div>
                  <div className="card">
                    <div className="card-h">
                      <h3>
                        Choisissez {n > 1 ? n + " sièges" : "votre siège"}
                      </h3>
                      <div className="legend">
                        <span>
                          <i />
                          Libre
                        </span>
                        <span>
                          <i
                            style={{
                              background: "var(--accent)",
                              borderColor: "var(--accent)",
                            }}
                          />
                          Votre choix
                        </span>
                        <span>
                          <i style={{ background: "var(--surface-2)" }} />
                          Occupé
                        </span>
                      </div>
                    </div>
                    <div className="bus-front">
                      ◀ Avant du véhicule · chauffeur
                    </div>
                    <div
                      className={`seats${bad("seats") ? " invalid" : ""}`}
                      style={{
                        gridAutoFlow: "column",
                        gridTemplateRows: `repeat(${cols + (cols === 4 ? 1 : 0)},36px)`,
                        gridAutoColumns: "36px",
                      }}
                    >
                      {cells}
                    </div>
                    <p
                      className="muted"
                      style={{ fontSize: 13, marginTop: 10 }}
                    >
                      {seats.length}/{n} {plural(n, "siège")}{" "}
                      {plural(seats.length, "sélectionné")}
                      {seats.length ? " : " + seats.join(", ") : ""}
                    </p>
                  </div>
                  <div className="card">
                    <h3 style={{ marginBottom: 14 }}>Voyageurs</h3>
                    <div className="stack">
                      {pax.map((p, k) => (
                        <div className="pax" key={k}>
                          <div className="pax-h">
                            <b>Voyageur {k + 1}</b>
                            <span
                              className={`pill ${seats[k] ? "t-b" : "t-n"}`}
                            >
                              {seats[k]
                                ? "Siège " + seats[k]
                                : "Siège à choisir"}
                            </span>
                          </div>
                          <div className="g2">
                            <div className="field">
                              <label htmlFor={`vn${k}`}>Prénom et nom *</label>
                              <input
                                className="in"
                                id={`vn${k}`}
                                value={p.name}
                                placeholder="Ex. Awa Diop"
                                autoComplete="name"
                                aria-invalid={bad("name" + k)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPax((a) =>
                                    a.map((x, j) =>
                                      j === k ? { ...x, name: v } : x,
                                    ),
                                  );
                                  setErrs((er) =>
                                    er.filter((x) => x.k !== "name" + k),
                                  );
                                }}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`vd${k}`}>
                                N° de pièce d&apos;identité
                              </label>
                              <input
                                className="in mono"
                                id={`vd${k}`}
                                value={p.doc}
                                placeholder="Facultatif"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPax((a) =>
                                    a.map((x, j) =>
                                      j === k ? { ...x, doc: v } : x,
                                    ),
                                  );
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pax">
                        <div className="pax-h">
                          <b>Contact de la réservation</b>
                        </div>
                        <div className="g3">
                          <div className="field">
                            <label htmlFor="vc-tel">Téléphone *</label>
                            <input
                              className="in mono"
                              id="vc-tel"
                              value={contact.tel}
                              placeholder="77 000 00 00"
                              inputMode="tel"
                              autoComplete="tel"
                              aria-invalid={bad("tel")}
                              onChange={(e) => {
                                setContact({ ...contact, tel: e.target.value });
                                setErrs((er) =>
                                  er.filter((x) => x.k !== "tel"),
                                );
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="vc-mail">E-mail</label>
                            <input
                              className="in"
                              id="vc-mail"
                              value={contact.email}
                              placeholder="Facultatif"
                              inputMode="email"
                              aria-invalid={bad("email")}
                              onChange={(e) => {
                                setContact({
                                  ...contact,
                                  email: e.target.value,
                                });
                                setErrs((er) =>
                                  er.filter((x) => x.k !== "email"),
                                );
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="vc-ch">
                              Canal de contact préféré
                            </label>
                            <select
                              className="in"
                              id="vc-ch"
                              value={contact.channel}
                              onChange={(e) =>
                                setContact({
                                  ...contact,
                                  channel: e.target.value as Channel,
                                })
                              }
                            >
                              <option value="SMS">SMS</option>
                              <option value="EMAIL">E-mail</option>
                              <option value="WA">WhatsApp</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card sticky">
                  <span className="eyebrow">Votre réservation</span>
                  <div className="sum" style={{ marginTop: 12 }}>
                    <div>
                      <span>
                        {AG[trip.from].name} → {AG[trip.to].name}
                      </span>
                      <b>{trip.time}</b>
                    </div>
                    <div>
                      <span>{dfmt(trip.date)}</span>
                      <span>{trip.veh.id}</span>
                    </div>
                    <div>
                      <span>
                        {n} × {fcfa(trip.price)}
                      </span>
                      <span>
                        {seats.length
                          ? "Sièges " + seats.join(", ")
                          : "Sièges à choisir"}
                      </span>
                    </div>
                    <div className="tot">
                      <span>Total</span>
                      <span>{fcfa(trip.price * n)}</span>
                    </div>
                  </div>
                  {errs.length > 0 && (
                    <div className="errbox" role="alert">
                      <b>Pour continuer :</b>
                      <ul>
                        {errs.map((e) => (
                          <li key={e.k + e.m}>{e.m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    className="btn btn-accent btn-lg"
                    style={{ width: "100%", marginTop: 16 }}
                    onClick={validate}
                  >
                    Valider
                  </button>
                  <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Vous pourrez encore tout vérifier avant de payer.
                  </p>
                </div>
              </div>
            );
          })()}

        {stage === "review" && trip && (
          <div className="book">
            <div className="stack">
              <div className="card">
                <div className="card-h">
                  <h3>Vérifiez votre réservation</h3>
                  <button
                    className="btn btn-sm"
                    onClick={() => setStage("seats")}
                  >
                    Modifier
                  </button>
                </div>
                <TripInfo t={trip} />
              </div>
              <div className="card">
                <h3 style={{ marginBottom: 12 }}>Voyageurs</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Voyageur</th>
                        <th>Siège</th>
                        <th>Pièce d&apos;identité</th>
                        <th className="num">Prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pax.map((p, k) => (
                        <tr key={k}>
                          <td>{p.name.trim()}</td>
                          <td className="mono">{seats[k]}</td>
                          <td className="mono">{p.doc || "—"}</td>
                          <td className="num mono">{nf(trip.price)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3}>
                          <b>Total</b>
                        </td>
                        <td className="num mono">
                          <b>{nf(trip.price * q.pax)}</b>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <dl className="info" style={{ marginTop: 16 }}>
                  <div>
                    <dt>Téléphone</dt>
                    <dd>{contact.tel}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{contact.email || "—"}</dd>
                  </div>
                  <div>
                    <dt>Contact préféré</dt>
                    <dd>{CHANNELS[contact.channel]}</dd>
                  </div>
                </dl>
                <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                  Présentez-vous à la gare {AG[trip.from].site} 30 minutes avant
                  le départ. Conditions d&apos;annulation et de modification à
                  définir par la compagnie.
                </p>
              </div>
            </div>
            <div className="card sticky">
              <span className="eyebrow">Paiement</span>
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  margin: "10px 0 14px",
                }}
              >
                <span className="muted">Montant à payer</span>
                <b className="mono" style={{ fontSize: 22 }}>
                  {fcfa(trip.price * q.pax)}
                </b>
              </div>
              <div
                className="choices"
                style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
              >
                {(["CASH"] as Method[]).map((m) => (
                  <Choice
                    key={m}
                    name="vm"
                    value={m}
                    checked={method === m}
                    onChange={(v) => setMethod(v as Method)}
                    title={METHODS[m]}
                    sub={
                      m === "CASH"
                        ? "Au guichet, 30 min avant le départ"
                        : m === "CARD"
                          ? "Visa, Mastercard"
                          : "Confirmation sur votre téléphone"
                    }
                  />
                ))}
              </div>
              {mm && (
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="v-ptel">
                    Numéro {METHODS[method]} à débiter
                  </label>
                  <input
                    className="in mono"
                    id="v-ptel"
                    value={payTel}
                    onChange={(e) => setPayTel(e.target.value)}
                    inputMode="tel"
                    placeholder="77 000 00 00"
                  />
                </div>
              )}
              {method === "CARD" && (
                <p className="note" style={{ marginTop: 14 }}>
                  Vous serez redirigé vers la page sécurisée de la banque
                  (simulée dans ce prototype).
                </p>
              )}
              {method === "CASH" && (
                <p className="note" style={{ marginTop: 14 }}>
                  Payez au guichet avec votre numéro de réservation.
                  Présentez-vous au moins 30 minutes avant le départ.
                </p>
              )}
              <p
                role="alert"
                style={{ fontSize: 13, marginTop: 10, color: "var(--bad)" }}
              >
                {payErr}
              </p>
              <p className="note" style={{ marginTop: 12 }}>
                Paiement en agence. Aucun débit en ligne. Le billet est
                disponible dans Mes activités.
              </p>
              {!user && (
                <Link className="btn" href="/connexion?next=/voyager">
                  Me connecter avant de réserver
                </Link>
              )}
              <button
                className="btn btn-accent btn-lg"
                style={{ width: "100%", marginTop: 6 }}
                disabled={paying || !user}
                onClick={pay}
              >
                {paying ? (
                  <>
                    <span className="spin" />{" "}
                    {mm
                      ? "Confirmez sur votre téléphone…"
                      : "Validation en cours…"}
                  </>
                ) : method === "CASH" ? (
                  "Confirmer la réservation"
                ) : (
                  "Payer " + fcfa(trip.price * q.pax)
                )}
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => setStage("seats")}
              >
                Retour aux voyageurs
              </button>
            </div>
          </div>
        )}

        {stage === "done" && done && (
          <div className="card">
            <div className="card-h">
              <div>
                <span className="eyebrow">
                  Réservation confirmée · {done.id}
                </span>
                <h3 style={{ marginTop: 4 }}>
                  Bon voyage.{" "}
                  {done.tickets.length > 1
                    ? "Vos tickets sont prêts."
                    : "Votre ticket est prêt."}
                </h3>
              </div>
              <div className="row no-print">
                <button className="btn" onClick={() => window.print()}>
                  Imprimer
                </button>
                <button
                  className="btn"
                  onClick={() => router.push("/suivre?q=" + done.tickets[0])}
                >
                  Retrouver ce ticket
                </button>
                <button className="btn btn-accent" onClick={reset}>
                  Nouvelle réservation
                </button>
              </div>
            </div>
            {done.paid === false && (
              <p className="festive" style={{ margin: "0 0 14px" }}>
                À régler au guichet avant {done.time} : {fcfa(done.amount)}
              </p>
            )}
            <div className="stack">
              {done.tickets.map((tk, k) => (
                <Ticket key={tk} b={done} i={k} />
              ))}
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              Retrouvez ce ticket dans Mes activités. Présentez le QR code au
              contrôle à l&apos;embarquement.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
