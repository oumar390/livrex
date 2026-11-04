import Link from "next/link";
import { currentUser } from "@/lib/server/auth";
import { ROLE_LABELS, ROLE_PATH, type Role } from "@/lib/auth-types";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Package,
  Truck,
  Bike,
  ChartNoAxesCombined,
  Settings,
} from "lucide-react";
import { PageHead } from "@/components/ui";
export const dynamic = "force-dynamic";
const spaces: {
  role: Role;
  title: string;
  desc: string;
  icon: typeof Package;
}[] = [
  {
    role: "AGENT",
    title: "Agence & colis",
    desc: "Enregistrer les envois, organiser le stock et remettre les colis.",
    icon: Package,
  },
  {
    role: "CHAUFFEUR",
    title: "Mes trajets",
    desc: "Préparer le chargement, enregistrer le départ et l’arrivée.",
    icon: Truck,
  },
  {
    role: "LIVREUR",
    title: "Mes livraisons",
    desc: "Collecter, scanner et livrer avec une preuve de remise.",
    icon: Bike,
  },
  {
    role: "GESTIONNAIRE",
    title: "Pilotage des opérations",
    desc: "Superviser les envois, répartir les missions et suivre l’activité.",
    icon: ChartNoAxesCombined,
  },
  {
    role: "ADMIN",
    title: "Administration",
    desc: "Configurer les services, les tarifs et les accès de l’équipe.",
    icon: Settings,
  },
];
export default async function Pro() {
  const u = await currentUser();
  const available = spaces.filter(
    (s) => u && (u.role === "ADMIN" || u.role === s.role),
  );
  return (
    <section className="view">
      <PageHead
        eyebrow="Lifekhalifa · Espace professionnel"
        title={
          u ? "Bonjour, " + u.name.split(" ")[0] : "L’équipe, au bon endroit."
        }
        lead={
          u
            ? "Vos outils de travail, selon votre rôle."
            : "Un espace dédié aux équipes, distinct des parcours clients."
        }
      />
      <div className="wrap">
        {!u || u.role === "CLIENT" ? (
          <div className="card empty-state">
            <BriefcaseBusiness size={40} />
            <h2>
              {u
                ? "Votre compte est un compte client."
                : "Connectez-vous à votre espace."}
            </h2>
            <p>
              {u
                ? "Votre administrateur peut vous attribuer un rôle depuis la gestion des accès."
                : "Utilisez votre compte professionnel pour accéder à vos missions."}
            </p>
            <Link
              className="btn btn-accent"
              href={u ? "/compte" : "/connexion?next=/pro"}
            >
              {u ? "Mon compte" : "Me connecter"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="pro-welcome">
              <span className="pill t-g">{ROLE_LABELS[u.role]}</span>
              <p>Une vue claire. Les bonnes actions. Votre travail du jour.</p>
            </div>
            <div className="pro-grid">
              {available.map((s) => (
                <Link
                  className="card pro-card"
                  key={s.role}
                  href={ROLE_PATH[s.role]}
                >
                  <span className="service-icon">
                    <s.icon />
                  </span>
                  <h2>{s.title}</h2>
                  <p>{s.desc}</p>
                  <span className="service-link">
                    Ouvrir mon espace
                    <ArrowUpRight size={20} />
                  </span>
                </Link>
              ))}
              {u.role === "ADMIN" && (
                <Link className="card pro-card" href="/equipe">
                  <span className="service-icon">
                    <BriefcaseBusiness />
                  </span>
                  <h2>Accès de l’équipe</h2>
                  <p>
                    Attribuer les rôles et gérer les accès aux espaces
                    professionnels.
                  </p>
                  <span className="service-link">
                    Gérer l’équipe
                    <ArrowUpRight size={20} />
                  </span>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
