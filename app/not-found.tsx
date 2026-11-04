import Link from "next/link";
export default function NotFound() {
  return (
    <section className="wrap empty-state">
      <h1>Cette destination n’existe pas.</h1>
      <p>Retrouvez les services LIVREX depuis l’accueil.</p>
      <Link className="btn btn-accent" href="/">
        Revenir à l’accueil
      </Link>
    </section>
  );
}
