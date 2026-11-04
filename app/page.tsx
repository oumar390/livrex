"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Bus,
  Package,
  Search,
  MapPin,
  Ticket,
  ShieldCheck,
  Route,
  BriefcaseBusiness,
  Check,
  ArrowUpRight,
} from "lucide-react";
export default function Home() {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <div className="landing">
      <section className="landing-hero wrap">
        <div className="hero-text">
          <span className="section-tag">
            <span />
            VOS TRAJETS. VOS COLIS. UN SEUL ENDROIT.
          </span>
          <h1>
            Plus proche.
            <br />
            Plus simple.
            <br />
            <em>Partout au Sénégal.</em>
          </h1>
          <p>
            Un voyage à préparer, un colis à envoyer ?<br />
            Lifekhalifa vous accompagne, du départ à l’arrivée.
          </p>
          <div className="hero-buttons">
            <Link className="btn btn-accent btn-lg" href="/voyager">
              <Bus size={19} />
              Réserver un voyage
              <ArrowRight size={18} />
            </Link>
            <Link className="btn btn-lg" href="/envoyer">
              <Package size={19} />
              Envoyer un colis
            </Link>
          </div>
          <div className="hero-assurance">
            <ShieldCheck size={17} />
            Un suivi à chaque étape<span>•</span>Vos informations en sécurité
          </div>
        </div>
        <div
          className="journey-art"
          aria-label="Voyages et livraisons entre Dakar et les régions"
        >
          <div className="art-grid" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-label">
            <span className="live-dot" />
            LE SÉNÉGAL NOUS RAPPROCHE
          </div>
          <svg className="route-art" viewBox="0 0 500 440" aria-hidden="true">
            <path
              d="M100 320 C80 170 300 360 310 190 S390 80 410 90"
              fill="none"
              stroke="#98c9b7"
              strokeWidth="3"
              strokeDasharray="7 8"
            />
            <path
              d="M100 320 C80 170 300 360 310 190"
              fill="none"
              stroke="#0b7157"
              strokeWidth="3"
            />
            <circle
              cx="100"
              cy="320"
              r="10"
              fill="#0b7157"
              stroke="white"
              strokeWidth="5"
            />
            <circle
              cx="310"
              cy="190"
              r="10"
              fill="#0b7157"
              stroke="white"
              strokeWidth="5"
            />
            <circle
              cx="410"
              cy="90"
              r="7"
              fill="#e99845"
              stroke="white"
              strokeWidth="4"
            />
          </svg>
          <span className="city city-dakar">Dakar</span>
          <span className="city city-touba">Touba</span>
          <span className="city city-saint">Saint-Louis</span>
          <div className="floating-ticket">
            <div className="mini-icon">
              <Ticket size={22} />
            </div>
            <div>
              <small>VOTRE PROCHAIN DÉPART</small>
              <strong>Une place vous attend.</strong>
              <span>Lifekhalifa Tours</span>
            </div>
            <Check className="ticket-check" size={18} />
          </div>
          <div className="floating-package">
            <span className="package-illustration">
              <Package size={55} strokeWidth={1.2} />
            </span>
            <div>
              <strong>Votre colis, bien accompagné.</strong>
              <span>De main en main, en toute confiance.</span>
            </div>
          </div>
          <div className="art-bottom">
            <Route size={18} />
            <span>Une équipe. Un réseau. Votre confiance.</span>
          </div>
        </div>
      </section>
      <section className="wrap tracking-section">
        <div>
          <Search size={22} />
          <div>
            <h2>Déjà en route ?</h2>
            <p>Retrouvez votre envoi ou votre billet.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim())
              router.push("/suivre?q=" + encodeURIComponent(q.trim()));
          }}
        >
          <label className="sr-only" htmlFor="quick-track">
            Numéro de suivi
          </label>
          <input
            id="quick-track"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            required
            placeholder="Votre numéro de suivi ou de billet"
          />
          <button className="btn btn-accent">
            Suivre
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
      <section className="wrap home-services">
        <div className="section-heading">
          <div>
            <span className="section-tag">COMMENT PEUT-ON VOUS AIDER ?</span>
            <h2>
              Vous choisissez la destination.
              <br />
              On s’occupe de la suite.
            </h2>
          </div>
          <p>
            Des services pensés pour votre quotidien,
            <br />
            sur votre téléphone comme en agence.
          </p>
        </div>
        <div className="service-grid">
          <Link href="/voyager" className="service-card travel-card">
            <span className="service-icon">
              <Bus />
            </span>
            <span className="section-tag">LIFEKHALIFA TOURS</span>
            <h3>Le voyage commence ici.</h3>
            <p>
              Trouvez votre départ, choisissez votre place et retrouvez votre
              billet sur votre téléphone.
            </p>
            <span className="service-link">
              Trouver un trajet
              <ArrowUpRight size={20} />
            </span>
            <span className="service-number">01</span>
          </Link>
          <Link href="/envoyer" className="service-card parcel-card">
            <span className="service-icon">
              <Package />
            </span>
            <span className="section-tag">LIVREX · FRET EXPRESS</span>
            <h3>Petit colis. Grand trajet.</h3>
            <p>
              Dans Dakar ou entre les villes, préparez votre envoi et suivez
              toutes ses étapes.
            </p>
            <span className="service-link">
              Préparer mon envoi
              <ArrowUpRight size={20} />
            </span>
            <span className="service-number">02</span>
          </Link>
        </div>
      </section>
      <section className="wrap simplicity">
        <div>
          <span className="section-tag">SIMPLEMENT, DE BOUT EN BOUT</span>
          <h2>
            Moins de démarches.
            <br />
            Plus de tranquillité.
          </h2>
        </div>
        {[
          {
            icon: MapPin,
            title: "Choisissez votre destination",
            text: "Un départ, une arrivée. Nous vous guidons.",
          },
          {
            icon: Ticket,
            title: "Confirmez en quelques étapes",
            text: "Un prix affiché avant toute confirmation.",
          },
          {
            icon: ShieldCheck,
            title: "Gardez tout à portée de main",
            text: "Billets, envois et suivi dans Mes activités.",
          },
        ].map((x, i) => (
          <article key={x.title}>
            <span className="how-icon">
              <x.icon size={22} />
            </span>
            <small>0{i + 1}</small>
            <h3>{x.title}</h3>
            <p>{x.text}</p>
          </article>
        ))}
      </section>
      <section className="wrap pro-banner">
        <BriefcaseBusiness size={30} />
        <div>
          <h2>Vous faites partie de l’équipe ?</h2>
          <p>
            Vos missions et vos outils, réunis dans votre espace professionnel.
          </p>
        </div>
        <Link className="btn" href="/pro">
          Accéder à mon espace
          <ArrowRight size={17} />
        </Link>
      </section>
      <footer className="site-footer wrap">
        <Link href="/" className="wordmark">
          LIVREX<span className="muted"> / Lifekhalifa</span>
        </Link>
        <p>Voyager. Envoyer. Se rapprocher.</p>
        <Link href="/aide">Besoin d’aide ?</Link>
      </footer>
    </div>
  );
}
