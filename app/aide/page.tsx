import Link from "next/link";
import { PageHead } from "@/components/ui";
export default function Help() {
  return (
    <section className="view">
      <PageHead
        eyebrow="À vos côtés"
        title="Comment pouvons-nous vous aider ?"
        lead="Les réponses utiles pour voyager et envoyer simplement."
      />
      <div className="wrap narrow stack">
        {[
          [
            "Comment réserver un voyage ?",
            "Choisissez le départ, la destination et la date dans Voyager, puis vos places. Confirmez avec vos coordonnées. Le billet se retrouve dans Mes activités.",
          ],
          [
            "Comment envoyer un colis ?",
            "Choisissez Envoyer, renseignez le trajet et la marchandise, puis confirmez le prix et les contacts. Le numéro de suivi est disponible dès l’enregistrement.",
          ],
          [
            "Comment payer ?",
            "Le paiement en agence est disponible. Wave, Orange Money et carte nécessitent encore une connexion aux prestataires ; aucun paiement en ligne n’est actuellement débité.",
          ],
          [
            "Où retrouver mes documents ?",
            "Mes activités regroupe vos billets et vos envois. Les boutons Imprimer permettent aussi de les enregistrer en PDF depuis votre navigateur.",
          ],
          [
            "Comment accéder à mon espace professionnel ?",
            "Créez un compte, puis demandez à votre administrateur de vous attribuer le rôle correspondant à votre métier.",
          ],
          [
            "Mes SMS sont-ils envoyés ?",
            "Les nouvelles de vos envois sont disponibles dans Mes activités. L’envoi de SMS et d’e-mails sera activé après configuration des prestataires.",
          ],
        ].map(([q, a]) => (
          <details className="card faq" key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
        <Link className="btn btn-accent" href="/compte">
          Accéder à mon compte
        </Link>
      </div>
    </section>
  );
}
