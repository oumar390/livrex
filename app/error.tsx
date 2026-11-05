"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="wrap empty-state">
      <h1>Un imprévu sur le trajet.</h1>
      <p>Vos données enregistrées sont conservées. Réessayez pour reprendre.</p>
      <button className="btn btn-accent" onClick={reset}>
        Réessayer
      </button>
      <Link className="btn" href="/">
        Revenir à l’accueil
      </Link>
    </section>
  );
}
