"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AssignDrawer, ParcelDrawer } from "@/components/Drawers";
import MapCanvas from "@/components/MapCanvas";
import { PageHead, Pill, Tabs } from "@/components/ui";
import {
  assignTruck,
  autoAssign,
  setStatus,
  startRoute,
  truckIssue,
} from "@/lib/actions";
import {
  AG,
  AG_CODES,
  ALL_STATUSES,
  catLabel,
  DECISIONS,
  DRIVERS,
  kgTxt,
  LINES,
  METHODS,
  MODE_CODES,
  MODES,
  qp,
  ST,
  TONE,
  ZONES,
} from "@/lib/data";
import {
  agencyPts,
  dispatchQueue,
  occupied,
  parcelAgency,
  pickupOf,
  planRoutes,
  routeLabel,
  stats,
  nearestFree,
} from "@/lib/domain";
import { dfmt, dIso, kg, km1, nf, otp, pad, tfmt } from "@/lib/format";
import { hav, vehPos } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Cons, LatLon, MapPoint, Mode, Parcel, Tarifs } from "@/lib/types";

type Tab =
  | "overview"
  | "parcels"
  | "dispatch"
  | "routes"
  | "masse"
  | "bookings"
  | "fleet"
  | "agencies"
  | "pricing"
  | "notifs"
  | "decisions";
const ALL_TABS: [Tab, string][] = [
  ["overview", "Vue d'ensemble"],
  ["parcels", "Colis"],
  ["dispatch", "Dispatch"],
  ["routes", "Tournées"],
  ["masse", "Camions dédiés"],
  ["bookings", "Réservations"],
  ["fleet", "Flotte"],
  ["agencies", "Agences"],
  ["pricing", "Tarifs"],
  ["notifs", "Notifications"],
  ["decisions", "À valider"],
];

const TABS = ALL_TABS;

function useScenes() {
  const { S } = useStore();
  const sn = () => {
    const pts: MapPoint[] = agencyPts();
    S.vehicles.forEach((v) => {
      if (v.trip) pts.push({ ...vehPos(v), kind: "veh", label: v.id });
    });
    return {
      mode: "sn" as const,
      points: pts,
      routes: S.vehicles
        .filter((v) => v.trip)
        .map((v) => [AG[v.trip!.from], AG[v.trip!.to]] as [LatLon, LatLon]),
    };
  };
  const dk = () => {
    const pts: MapPoint[] = [];
    S.parcels
      .filter(
        (p) => (p.status === ST.ASSIGNED || p.status === ST.DELIV) && p.drop,
      )
      .forEach((p) => pts.push({ ...p.drop!, kind: "drop" }));
    S.couriers.forEach((c) =>
      pts.push({ ...c.pos, kind: "cour", label: c.name.split(" ")[0] }),
    );
    return { mode: "dkr" as const, points: pts };
  };
  return { sn, dk };
}

function Overview() {
  const { S } = useStore();
  const s = stats(S);
  const { sn, dk } = useScenes();
  const by = ALL_STATUSES.map(
    (k) => [k, S.parcels.filter((p) => p.status === k).length] as const,
  );
  const mx = Math.max(1, ...by.map((x) => x[1]));
  const rm = Math.max(1, s.rev.pax, s.rev.fret, s.rev.exp);
  const toneC = {
    n: "var(--muted)",
    b: "var(--blue)",
    w: "var(--warn)",
    g: "var(--ok)",
  };
  const kpis: [string, string | number, string][] = [
    ["Colis", s.total, "toutes activités"],
    ["En transit", s.transit, "entre agences"],
    ["En stockage", s.stock, "toutes agences"],
    ["Livrés / retirés", s.done, `${s.onTimePct} % dans les délais`],
    ["Livraisons en cours", s.deliv, "livreur affecté ou en route"],
    ["Réservations", s.res, s.pax + " voyageurs"],
    ["Véhicules en route", s.vehOn, "sur " + S.vehicles.length],
    ["Encaissé", nf(s.cash), `FCFA · ${nf(s.toCollect)} à encaisser`],
  ];
  return (
    <>
      <div className="kpis">
        {kpis.map(([a, b, c]) => (
          <div className="kpi" key={a}>
            <small>{a}</small>
            <b>{b}</b>
            <span>{c}</span>
          </div>
        ))}
      </div>
      <div className="a-grid">
        <div className="card">
          <div className="card-h">
            <h3>Flotte en route</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              {s.vehOn} véhicule{s.vehOn > 1 ? "s" : ""} en transfert
            </span>
          </div>
          <MapCanvas scene={sn()} />
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Livreurs · Dakar</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              {S.couriers.filter((c) => c.job).length}/{S.couriers.length} en
              mission
            </span>
          </div>
          <MapCanvas scene={dk()} />
        </div>
      </div>
      <div className="a-grid">
        <div className="card">
          <div className="card-h">
            <h3>Colis par statut</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              {s.total} colis
            </span>
          </div>
          <div className="bars">
            {by.map(([k, n]) => (
              <div className="br" key={k}>
                <span>{k}</span>
                <div className="tr">
                  <i
                    style={{
                      width: (n / mx) * 100 + "%",
                      background: toneC[TONE[k]],
                    }}
                  />
                </div>
                <b className="mono num">{n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Encaissements par activité</h3>
          </div>
          <div className="bars">
            {(
              [
                ["Express", s.rev.exp],
                ["Fret routier", s.rev.fret],
                ["Camions dédiés", s.rev.masse],
                ["Voyageurs", s.rev.pax],
              ] as const
            ).map(([l, n]) => (
              <div
                className="br"
                key={l}
                style={{ gridTemplateColumns: "110px minmax(0,1fr) auto" }}
              >
                <span>{l}</span>
                <div className="tr">
                  <i
                    style={{
                      width: (n / rm) * 100 + "%",
                      background: "var(--blue)",
                    }}
                  />
                </div>
                <b className="mono num">{nf(n)}</b>
              </div>
            ))}
          </div>
          <div className="lab" style={{ margin: "20px 0 6px" }}>
            Performance
          </div>
          <div className="bars">
            <div
              className="br"
              style={{ gridTemplateColumns: "150px minmax(0,1fr) auto" }}
            >
              <span>Livrés dans les délais</span>
              <div className="tr">
                <i
                  style={{
                    width: s.onTimePct + "%",
                    background: s.onTimePct >= 90 ? "var(--ok)" : "var(--warn)",
                  }}
                />
              </div>
              <b className="mono num">
                {s.onTime}/{s.done}
              </b>
            </div>
          </div>
          <div className="lab" style={{ margin: "20px 0 6px" }}>
            Dernières notifications
          </div>
          <div className="log">
            {S.notifs.slice(0, 4).map((n, i) => (
              <div key={i}>
                <span className="ch">{n.ch}</span>
                <span>
                  {n.msg}
                  <br />
                  <time>
                    {tfmt(n.t)} · {n.to}
                  </time>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Parcels() {
  const { S, openDrawer } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [mode, setMode] = useState<Mode | "all">("all");
  const [q, setQ] = useState("");
  const ps = S.parcels.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (mode === "all" || p.type === mode) &&
      (!q ||
        (p.id + p.sender + p.recipient)
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  /** Export comptable CSV (séparateur ; pour Excel en français) */
  const exportCsv = () => {
    const head = [
      "Colis",
      "Type",
      "Trajet",
      "Catégorie",
      "Poids kg",
      "Statut",
      "Montant FCFA",
      "Paiement",
      "Référence",
      "État paiement",
      "Créé le",
    ];
    const rows = ps.map((p) => [
      p.id,
      MODES[p.type].short,
      routeLabel(p),
      catLabel(p),
      String(p.weight).replace(".", ","),
      p.status,
      p.price,
      p.payment ? METHODS[p.payment.mode] : "",
      p.payment?.ref || "",
      p.payment?.status || "",
      new Date(p.created).toLocaleString("fr-FR"),
    ]);
    const csv =
      "﻿" +
      [head, ...rows]
        .map((r) =>
          r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"),
        )
        .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `colis-${dIso(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div
        className="row"
        style={{ marginBottom: 12, justifyContent: "space-between" }}
      >
        <input
          className="in"
          placeholder="Rechercher un colis, un nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <button className="btn btn-sm" onClick={exportCsv}>
          Exporter en CSV ({ps.length})
        </button>
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {(["all", ...MODE_CODES] as const).map((k) => (
          <button
            key={k}
            className="chip"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
          >
            {k === "all" ? "Tous transports" : MODES[k].label} (
            {S.parcels.filter((p) => k === "all" || p.type === k).length})
          </button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {["all", ...ALL_STATUSES].map((k) => (
          <button
            key={k}
            className="chip"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {k === "all" ? "Tous" : k}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Colis</th>
              <th>Type</th>
              <th>Trajet</th>
              <th>Catégorie</th>
              <th className="num">Poids</th>
              <th>Statut</th>
              <th className="num">Montant</th>
              <th>Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {ps.length ? (
              ps.map((p) => (
                <tr
                  key={p.id}
                  className="click"
                  onClick={() => openDrawer(<ParcelDrawer id={p.id} />)}
                >
                  <td className="mono">{p.id}</td>
                  <td>{MODES[p.type].short}</td>
                  <td>{routeLabel(p)}</td>
                  <td>{catLabel(p)}</td>
                  <td className="num mono">{kg(p.weight)}</td>
                  <td>
                    <Pill s={p.status} />
                  </td>
                  <td className="num mono">{p.price ? nf(p.price) : "—"}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>
                    {tfmt(p.updated)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="muted">
                  Aucun colis ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dispatch() {
  const { S, act, openDrawer } = useStore();
  const { dk } = useScenes();
  const q = dispatchQueue(S);
  const live = S.parcels.filter(
    (p) => p.status === ST.ASSIGNED || p.status === ST.DELIV,
  );
  return (
    <div className="a-grid" style={{ marginTop: 0 }}>
      <div className="stack">
        <div className="card">
          <div className="card-h">
            <h3>File d&apos;attente</h3>
            <button
              className="btn btn-sm btn-accent"
              disabled={!q.length}
              onClick={() => act((c) => q.forEach((p) => autoAssign(c, p)))}
            >
              Tout attribuer au plus proche
            </button>
          </div>
          {q.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {q.map((p) => {
                const t = pickupOf(p);
                const best = nearestFree(S, t);
                return (
                  <div className="mission" key={p.id}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <b className="mono">{p.id}</b>
                      <Pill s={p.status} />
                    </div>
                    <div className="leg">
                      <i />
                      <span>
                        {p.pickup ? p.pickup.label : "Agence " + AG[p.to!].name}
                      </span>
                    </div>
                    <div className="leg">
                      <i className="to" />
                      <span>{p.drop?.label}</span>
                    </div>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <span className="muted" style={{ fontSize: 13 }}>
                        {best
                          ? `Suggéré : ${best.name} · ${km1(hav(best.pos, t))} km`
                          : "Aucun livreur libre"}
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => openDrawer(<AssignDrawer id={p.id} />)}
                        >
                          Choisir
                        </button>
                        <button
                          className="btn btn-sm btn-blue"
                          disabled={!best}
                          onClick={() => act((c) => autoAssign(c, p))}
                        >
                          Attribuer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">Aucune commande en attente.</p>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Courses en cours</h3>
          {live.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {live.map((p) => {
                const c = S.couriers.find((c) => c.id === p.courier);
                return (
                  <button
                    key={p.id}
                    className="row chip"
                    style={{
                      justifyContent: "space-between",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                    onClick={() => openDrawer(<ParcelDrawer id={p.id} />)}
                  >
                    <span>
                      {p.id} · {c?.name}
                    </span>
                    <Pill s={p.status} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="muted">Aucune course en cours.</p>
          )}
        </div>
      </div>
      <div className="card">
        <MapCanvas scene={dk()} className="sq" />
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Points bleus : livreurs. Repères rouges : adresses de livraison en
          cours.
        </p>
      </div>
    </div>
  );
}

/** Optimisation des itinéraires : regroupement par zone et ordre de passage */
function Routes() {
  const { S, act } = useStore();
  const plans = planRoutes(S);
  const assignPlan = (order: Parcel[], cid: string) =>
    act((c) => startRoute(c, order, cid));
  const running = S.couriers.filter((c) => c.job && c.route && c.route.length);
  return (
    <div className="a-grid" style={{ marginTop: 0 }}>
      <div className="stack">
        <p className="note">
          Les courses en attente sont regroupées par secteur de Dakar, puis
          ordonnées en allant chaque fois vers la course la plus proche, pour
          réduire les temps de trajet. Lancer une tournée confie toutes ses
          courses au livreur : il reçoit la suivante dès qu&apos;il a livré la
          précédente. Un outil de routage type Routific ou Onfleet pourra
          remplacer cet algorithme simple.
        </p>
        {running.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Tournées en cours</h3>
            <div className="stack" style={{ gap: 6, fontSize: 14 }}>
              {running.map((c) => (
                <div
                  key={c.id}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>
                    <b>{c.name}</b>{" "}
                    <span className="muted">
                      · en cours {c.job} · puis {c.route!.join(", ")}
                    </span>
                  </span>
                  <span className="pill t-w">
                    {c.route!.length + 1} course(s)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {plans.length ? (
          plans.map((pl) => (
            <div className="card" key={pl.name}>
              <div className="card-h">
                <h3>{pl.name}</h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  {pl.order.length} course(s) · ≈ {km1(pl.km)} km
                </span>
              </div>
              <div className="route-plan">
                <ol>
                  {pl.order.map((p) => (
                    <li key={p.id}>
                      <b className="mono">{p.id}</b>{" "}
                      <span className="muted">
                        ·{" "}
                        {p.pickup ? p.pickup.label : "Agence " + AG[p.to!].name}{" "}
                        → {p.drop?.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div
                className="row"
                style={{ justifyContent: "space-between", marginTop: 12 }}
              >
                <span className="muted" style={{ fontSize: 13 }}>
                  {pl.courier
                    ? `Livreur suggéré : ${pl.courier.name} (${pl.courier.mode})`
                    : "Aucun livreur libre"}
                </span>
                <button
                  className="btn btn-sm btn-blue"
                  disabled={!pl.courier}
                  onClick={() =>
                    pl.courier && assignPlan(pl.order, pl.courier.id)
                  }
                >
                  Lancer la tournée
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Aucune course en attente à regrouper.</div>
        )}
      </div>
      <div className="card">
        <MapCanvas
          className="sq"
          scene={{
            mode: "dkr",
            points: [
              ...plans.flatMap((pl) =>
                pl.order.map((p) => ({
                  ...p.drop!,
                  kind: "drop" as const,
                  label: p.id.slice(-3),
                })),
              ),
              ...S.couriers
                .filter((c) => !c.job)
                .map((c) => ({
                  ...c.pos,
                  kind: "cour" as const,
                  label: c.name.split(" ")[0],
                })),
            ],
            routes: plans.flatMap((pl) =>
              pl.order.map(
                (p) => [pickupOf(p), p.drop || pickupOf(p)] as [LatLon, LatLon],
              ),
            ),
          }}
        />
      </div>
    </div>
  );
}

/** Camions dédiés : réserver un camion adapté (charge utile, froid) pour chaque commande */
function Masse() {
  const { S, act, openDrawer } = useStore();
  const orders = S.parcels.filter((p) => p.type === "MASSE");
  const waiting = orders.filter((p) => p.status === ST.CREATED);
  const trucks = S.vehicles.filter(
    (v) => v.kind === "masse" || v.kind === "fret",
  );
  const [pick, setPick] = useState<Record<string, string>>({});
  return (
    <div className="a-grid" style={{ marginTop: 0 }}>
      <div className="stack">
        <div className="card">
          <div className="card-h">
            <h3>À planifier</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              {waiting.length} commande(s)
            </span>
          </div>
          {waiting.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {waiting.map((p) => {
                const fit = trucks.filter((v) => !truckIssue(S, v, p));
                const sel = pick[p.id] || fit[0]?.id || "";
                const selTruck = trucks.find((v) => v.id === sel);
                return (
                  <div className="mission" key={p.id}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <b className="mono">{p.id}</b>
                      <Pill s={p.status} />
                    </div>
                    <div className="leg">
                      <i />
                      <span>
                        {p.pickupAddr} · {AG[p.from!].name}
                      </span>
                    </div>
                    <div className="leg">
                      <i className="to" />
                      <span>
                        {p.dropAddr} · {AG[p.to!].name}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {kgTxt(p.weight)} · {catLabel(p)} · {p.desc || "—"}
                      {p.wanted
                        ? " · souhaité le " +
                          new Date(p.wanted + "T12:00").toLocaleDateString(
                            "fr-FR",
                          )
                        : ""}
                    </span>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <select
                        className="in"
                        style={{ maxWidth: 340 }}
                        value={sel}
                        onChange={(e) =>
                          setPick({ ...pick, [p.id]: e.target.value })
                        }
                        aria-label={"Camion pour " + p.id}
                      >
                        {trucks.map((v) => {
                          const why = truckIssue(S, v, p);
                          return (
                            <option key={v.id} value={v.id} disabled={!!why}>
                              {v.id} · {v.type}
                              {why ? " — " + why : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="btn btn-sm btn-blue"
                        disabled={!selTruck || !!truckIssue(S, selTruck, p)}
                        onClick={() => act((c) => assignTruck(c, p, sel))}
                      >
                        Affecter le camion
                      </button>
                    </div>
                    {!fit.length && (
                      <span style={{ fontSize: 13, color: "var(--bad)" }}>
                        Aucun camion ne convient pour l’instant : voir la raison
                        à côté de chaque camion.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">Aucune commande en attente.</p>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Trajet</th>
                <th className="num">Poids</th>
                <th>Catégorie</th>
                <th>Camion</th>
                <th>Statut</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((p) => (
                <tr
                  key={p.id}
                  className="click"
                  onClick={() => openDrawer(<ParcelDrawer id={p.id} />)}
                >
                  <td className="mono">{p.id}</td>
                  <td>{routeLabel(p)}</td>
                  <td className="num mono">{kgTxt(p.weight)}</td>
                  <td>{catLabel(p)}</td>
                  <td className="mono">{p.vehicle || "—"}</td>
                  <td>
                    <Pill s={p.status} />
                  </td>
                  <td className="num mono">{nf(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Camions</h3>
        <div className="stack" style={{ gap: 8, fontSize: 14 }}>
          {trucks.map((v) => {
            const job = orders.find(
              (p) =>
                p.vehicle === v.id &&
                (p.status === ST.PLANNED || p.status === ST.TRANSIT),
            );
            return (
              <div
                key={v.id}
                className="row"
                style={{ justifyContent: "space-between" }}
              >
                <span>
                  <b className="mono">{v.id}</b>{" "}
                  <span className="muted">
                    · {v.type}
                    {v.cold ? " · froid" : ""} · {DRIVERS[v.driver]}
                  </span>
                </span>
                {v.trip ? (
                  <span className="pill t-w">En route</span>
                ) : job ? (
                  <span className="pill t-b">{job.id}</span>
                ) : (
                  <span className="pill t-g">Libre · {AG[v.agency].name}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Le chauffeur du camion affecté voit la mission dans son espace :
          chargement chez le client, départ, puis livraison sur site.
        </p>
      </div>
    </div>
  );
}

function Bookings() {
  const { S, refresh, toast } = useStore();
  const [today] = useState(() => dIso(Date.now()));
  const ts = LINES.flatMap(([a, b, times, vid]) =>
    times.map((tm) => {
      const id = `${a}-${b}-${today}-${tm}`,
        v = S.vehicles.find((x) => x.id === vid)!,
        cap = v.cap as number;
      return { id, a, b, tm, cap, o: occupied(S, id, cap).size };
    }),
  ).sort((x, y) => x.tm.localeCompare(y.tm));
  return (
    <>
      {S.festive && (
        <div className="festive" style={{ margin: "0 0 16px" }}>
          <b>Mode forte demande actif</b>
          <span>
            Majoration de {S.tarifs.festive} % appliquée aux nouvelles
            réservations.
          </span>
        </div>
      )}
      <div className="a-grid" style={{ marginTop: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réservation</th>
                <th>Trajet</th>
                <th>Départ</th>
                <th>Voyageurs</th>
                <th>Paiement</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {S.bookings.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.id}</td>
                  <td>
                    {AG[b.from].name} → {AG[b.to].name}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>
                    {dfmt(b.date)} · {b.time}
                  </td>
                  <td>
                    {b.names.join(", ")}{" "}
                    <span className="muted">({b.seats.join(", ")})</span>
                  </td>
                  <td>
                    {METHODS[b.method]}
                    {b.paid === false ? (
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Confirmer la réception de " +
                                nf(b.amount) +
                                " FCFA en espèces ?",
                            )
                          )
                            return;
                          const r = await fetch("/api/bookings/payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: b.id }),
                          });
                          const d = await r.json();
                          if (!r.ok) toast(d.error);
                          else {
                            await refresh();
                            toast("Encaissement enregistré.");
                          }
                        }}
                      >
                        Encaisser
                      </button>
                    ) : (
                      " · réglé"
                    )}
                  </td>
                  <td className="num mono">{nf(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Remplissage du jour</h3>
          <div className="bars">
            {ts.map((t) => (
              <div
                className="br"
                key={t.id}
                style={{ gridTemplateColumns: "150px minmax(0,1fr) 52px" }}
              >
                <span className="mono" style={{ fontSize: 12 }}>
                  {t.tm} {AG[t.a].name.slice(0, 5)}→{AG[t.b].name.slice(0, 5)}
                </span>
                <div className="tr">
                  <i
                    style={{
                      width: (t.o / t.cap) * 100 + "%",
                      background:
                        t.o / t.cap > 0.85 ? "var(--warn)" : "var(--blue)",
                    }}
                  />
                </div>
                <b className="mono num" style={{ fontSize: 12 }}>
                  {t.o}/{t.cap}
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Fleet() {
  const { S } = useStore();
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Type</th>
              <th>Immatriculation</th>
              <th>Capacité</th>
              <th>Chauffeur</th>
              <th>Statut</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {S.vehicles.map((v) => {
              const pos = vehPos(v);
              return (
                <tr key={v.id}>
                  <td className="mono">{v.id}</td>
                  <td>
                    {v.type}
                    {v.cold && (
                      <>
                        {" "}
                        <span className="pill t-b">Froid</span>
                      </>
                    )}
                  </td>
                  <td className="mono">{v.plate}</td>
                  <td>
                    {v.cap}
                    {typeof v.cap === "number" ? " places" : ""}
                  </td>
                  <td>{DRIVERS[v.driver]}</td>
                  <td>
                    {v.trip ? (
                      <span className="pill t-w">
                        {AG[v.trip.from].name} → {AG[v.trip.to].name}
                      </span>
                    ) : (
                      <span className="pill t-g">
                        À quai {AG[v.agency].name}
                      </span>
                    )}
                  </td>
                  <td className="mono muted" style={{ fontSize: 12 }}>
                    {pos.lat.toFixed(3)}, {pos.lon.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 style={{ margin: "28px 0 12px" }}>Livreurs</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Livreur</th>
              <th>Véhicule</th>
              <th>Statut</th>
              <th>Livraisons aujourd&apos;hui</th>
              <th>Dernière position</th>
            </tr>
          </thead>
          <tbody>
            {S.couriers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.mode}</td>
                <td>
                  {c.job ? (
                    <span className="pill t-w">{c.job}</span>
                  ) : (
                    <span className="pill t-g">Disponible</span>
                  )}
                </td>
                <td className="mono">
                  {
                    S.parcels.filter(
                      (p) => p.courier === c.id && p.status === ST.DONE,
                    ).length
                  }
                </td>
                <td className="mono muted" style={{ fontSize: 12 }}>
                  {c.pos.lat.toFixed(4)}, {c.pos.lon.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Agencies() {
  const { S } = useStore();
  return (
    <div
      className="g4"
      style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}
    >
      {AG_CODES.map((k) => {
        const a = AG[k],
          n = S.parcels.filter((p) => parcelAgency(p) === k).length;
        return (
          <div className="card" key={k}>
            <div className="card-h" style={{ marginBottom: 8 }}>
              <h3>{a.name}</h3>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {k}
              </span>
            </div>
            <div className="stack" style={{ gap: 4, fontSize: 13 }}>
              <span className="muted">
                {a.site} · {a.hours}
              </span>
              <span className="muted mono">
                {a.lat.toFixed(3)}° N, {Math.abs(a.lon).toFixed(3)}° O
              </span>
              <span>
                {a.staff} agents · {ZONES.length} zones :{" "}
                {ZONES.map((z) => z.replace("Zone ", "")).join(", ")}
              </span>
            </div>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <span>Occupation</span>
              <b className="mono">
                {n} / {a.cap}
              </b>
            </div>
            <div className="zonebar" style={{ marginTop: 6 }}>
              <i style={{ width: Math.max(1, (n / a.cap) * 100) + "%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pricing() {
  const { S, act, resets } = useStore();
  const T = S.tarifs;
  const fld = (k: string, label: string, unit: string, sub?: "seat") => {
    const val = sub
      ? T.seat[k as keyof Tarifs["seat"]]
      : (T[k as keyof Tarifs] as number);
    return (
      <div className="field" key={k}>
        <label htmlFor={"tp-" + k}>{label}</label>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <input
            className="in mono"
            type="number"
            id={"tp-" + k}
            defaultValue={val}
            step="any"
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isNaN(v)) return;
              act((c) => {
                if (sub) c.S.tarifs.seat[k as keyof Tarifs["seat"]] = v;
                else (c.S.tarifs as unknown as Record<string, number>)[k] = v;
              });
            }}
          />
          <span
            className="muted"
            style={{ fontSize: 12, whiteSpace: "nowrap" }}
          >
            {unit}
          </span>
        </div>
      </div>
    );
  };
  return (
    <div className="a-grid" style={{ marginTop: 0 }} key={resets}>
      <div className="stack">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Seuils de poids des transports</h3>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            Le type de transport proposé au client dépend du poids. Hypothèses à
            confirmer avec la direction.
          </p>
          <div className="g3">
            {fld("expressMax", "Express jusqu’à", "kg")}
            {fld("fretMax", "Fret routier jusqu’à", "kg")}
            {fld("masseMax", "Camion dédié jusqu’à", "kg")}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Camions dédiés</h3>
          <div className="g2">
            {fld("masseBase", "Forfait camion", "FCFA")}
            {fld("masseTkm", "Prix à la tonne-kilomètre", "FCFA/t·km")}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Fret routier</h3>
          <div className="g2">
            {fld("fretBase", "Forfait de prise en charge", "FCFA")}
            {fld("fretKg", "Prix au kilo", "FCFA/kg")}
            {fld("fretKm", "Prix au kilomètre", "FCFA/km")}
            {fld("pack", "Emballage agence", "FCFA")}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Livraison express (LIVREX)</h3>
          <div className="g2">
            {fld("expBase", "Prise en charge", "FCFA")}
            {fld("expKg", "Prix au kilo facturé", "FCFA/kg")}
            {fld("expKm", "Prix au kilomètre", "FCFA/km")}
            {fld("expressMult", "Coefficient express", "×")}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>
            Voyageurs · prix par km et par siège
          </h3>
          <div className="g3">
            {fld("bus", "Autocar", "FCFA/km", "seat")}
            {fld("mini", "Minibus", "FCFA/km", "seat")}
            {fld("sept", "7 places", "FCFA/km", "seat")}
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Périodes de forte demande</h3>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            À activer pendant le Magal, la Tabaski, le Gamou ou la Korité. Les
            sièges se remplissent plus vite et une majoration s&apos;applique.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={S.festive}
              onChange={(e) => {
                const on = e.target.checked;
                act((c) => {
                  c.S.festive = on;
                  c.toast(
                    on
                      ? "Mode forte demande activé"
                      : "Mode forte demande désactivé",
                  );
                });
              }}
            />
            <span>
              <b>Mode forte demande</b>
            </span>
          </label>
          <div style={{ marginTop: 12 }}>
            {fld("festive", "Majoration", "%")}
          </div>
        </div>

        <p className="note">
          Les barèmes sont provisoires. Ils
          restent à fixer avec la direction.
        </p>
      </div>
    </div>
  );
}

function Notifs() {
  const { S } = useStore();
  return (
    <div className="card">
      <div className="card-h">
        <h3>Journal des notifications</h3>
        <span className="muted" style={{ fontSize: 13 }}>
          {S.notifs.length} notifications internes
        </span>
      </div>
      <div className="log" style={{ maxHeight: "none" }}>
        {S.notifs.map((n, i) => (
          <div key={i}>
            <span className="ch">{n.ch}</span>
            <span>
              {n.msg}
              <br />
              <time>
                {tfmt(n.t)} · {n.to}
                {n.id ? " · " + n.id : ""}
              </time>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SAMPLE = `{
  "pickup": "Plateau",
  "dropoff": "Almadies",
  "weight_kg": 2.4,
  "service": "express",
  "conservation": "sec",
  "fragile": false,
  "dimensions_cm": { "l": 30, "w": 20, "h": 15 },
  "reference": "CMD-4472",
  "description": "Commande en ligne",
  "sender": { "name": "Boutique Keur Yaay", "phone": "33 821 40 00" },
  "recipient": { "name": "Ndèye Fall", "phone": "77 503 29 66" },
  "payment": "prepaid"
}`;

function Decisions() {
  return (
    <div className="card">
      <div className="card-h">
        <h3>Points à valider avec l&apos;entrepreneur</h3>
        <span className="muted" style={{ fontSize: 13 }}>
          Règles à confirmer avec la direction
        </span>
      </div>
      {DECISIONS.map(([g, q, a]) => (
        <div className="dec" key={q}>
          <b>{q}</b>
          <span className="muted">{a}</span>
          <span className="pill t-n">{g}</span>
        </div>
      ))}
    </div>
  );
}

function Admin() {
  const { user } = useStore();
  const manager = user?.role === "GESTIONNAIRE";
  const availableTabs = manager
    ? TABS.filter(([k]) => !["pricing", "api", "decisions"].includes(k))
    : TABS;
  const params = useSearchParams();
  const router = useRouter();
  const tab = (availableTabs.find((t) => t[0] === params.get("tab"))?.[0] ||
    "overview") as Tab;
  const body = {
    overview: Overview,
    parcels: Parcels,
    dispatch: Dispatch,
    routes: Routes,
    masse: Masse,
    bookings: Bookings,
    fleet: Fleet,
    agencies: Agencies,
    pricing: Pricing,
    notifs: Notifs,
    decisions: Decisions,
  }[tab];
  const Body = body;
  return (
    <section className="view">
      <PageHead
        eyebrow="Back-office · TMS"
        title={manager ? "Les opérations, en un regard." : "Tableau de bord"}
        lead="Vue globale sur les colis, les trajets, la flotte et les encaissements, mise à jour en direct."
      />
      <div className="wrap">
        <Tabs<Tab>
          tabs={availableTabs}
          value={tab}
          onChange={(k) =>
            router.replace((manager ? "/gestion" : "/admin") + "?tab=" + k, {
              scroll: false,
            })
          }
        />
        <Body />
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  );
}
