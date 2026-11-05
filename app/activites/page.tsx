"use client";
import Link from "next/link";
import { useState } from "react";
import { Bus, Package, ArrowRight, Bell, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHead, Pill } from "@/components/ui";
import { Ticket } from "@/components/Paper";
import { routeLabel } from "@/lib/domain";
import { AG } from "@/lib/data";
import { dfmt, fcfa } from "@/lib/format";
export default function Activities() {
  const { S, user } = useStore();
  const [tab, setTab] = useState("all");
  return (
    <section className="view">
      <PageHead
        eyebrow="Votre quotidien, simplifié"
        title="Mes activités"
        lead="Vos voyages, vos envois et leurs dernières nouvelles."
      />
      <div className="wrap">
        {!user ? (
          <div className="card empty-state">
            <Package size={38} />
            <h2>Tout retrouver, simplement.</h2>
            <p>
              Connectez-vous pour consulter vos activités en toute sécurité.
            </p>
            <Link className="btn btn-accent" href="/connexion?next=/activites">
              Me connecter
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="activity-toolbar">
              <div className="segmented" aria-label="Filtrer les activités">
                {[
                  ["all", "Tout"],
                  ["voyages", "Voyages"],
                  ["envois", "Envois"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    aria-pressed={tab === v}
                    onClick={() => setTab(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <Link className="btn" href="/envoyer">
                <Plus size={17} />
                Nouvel envoi
              </Link>
            </div>
            {!S.parcels.length && !S.bookings.length && (
              <div className="card empty-state">
                <RouteEmpty />
                <h2>Votre prochaine aventure commence ici.</h2>
                <p>
                  Vos réservations et vos envois apparaîtront sur cette page.
                </p>
                <div className="row">
                  <Link className="btn btn-accent" href="/voyager">
                    Réserver un voyage
                  </Link>
                  <Link className="btn" href="/envoyer">
                    Envoyer un colis
                  </Link>
                </div>
              </div>
            )}
            <div className="activity-grid">
              {tab !== "voyages" &&
                S.parcels.map((p) => (
                  <Link
                    key={p.id}
                    className="card activity-card"
                    href={"/suivre?q=" + p.id}
                  >
                    <span className="activity-icon">
                      <Package />
                    </span>
                    <div>
                      <span className="eyebrow">{p.id}</span>
                      <h3>{routeLabel(p)}</h3>
                      <p className="muted">{p.desc}</p>
                      <Pill s={p.status} />
                    </div>
                    <ArrowRight size={19} />
                  </Link>
                ))}
              {tab !== "envois" &&
                S.bookings.map((b) => (
                  <details className="card booking-activity" key={b.id}>
                    <summary>
                      <Bus />
                      <span>
                        <small>{b.id}</small>
                        <strong>
                          {AG[b.from].name} → {AG[b.to].name}
                        </strong>
                        <span>
                          {dfmt(b.date)} · {b.time} · {b.seats.length} place(s)
                        </span>
                      </span>
                      <span>
                        {fcfa(b.amount)}
                        <small>{b.paid ? "Réglé" : "À régler en agence"}</small>
                      </span>
                    </summary>
                    <div className="stack" style={{ marginTop: 20 }}>
                      {b.tickets.map((_, i) => (
                        <Ticket key={i} b={b} i={i} />
                      ))}
                      <button
                        className="btn no-print"
                        onClick={() => window.print()}
                      >
                        Imprimer / Enregistrer en PDF
                      </button>
                    </div>
                  </details>
                ))}
            </div>
            {!!S.notifs.length && (
              <div className="card notifications">
                <h2>
                  <Bell size={21} />
                  Dernières nouvelles
                </h2>
                {S.notifs.slice(0, 10).map((n, i) => (
                  <div key={i}>
                    <span className="live-dot" />
                    <p>
                      {n.msg}
                      <small>{new Date(n.t).toLocaleString("fr-FR")}</small>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
function RouteEmpty() {
  return <Bus size={38} />;
}
