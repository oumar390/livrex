"use client";
import { apiFetch } from "@/lib/client-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/auth-types";
import { PageHead } from "@/components/ui";
import { UserRound, ArrowRight, LogOut, BriefcaseBusiness } from "lucide-react";
export default function Account() {
  const { user, refresh, demo } = useStore();
  const router = useRouter();
  return (
    <section className="view">
      <PageHead
        eyebrow="Votre espace"
        title="Mon compte"
        lead="Vos informations et vos accès, au même endroit."
      />
      <div className="wrap narrow">
        <div className="card stack">
          <UserRound size={32} />
          <h2>{user ? user.name : "Bienvenue sur LIVREX"}</h2>
          {demo && (
            <p className="note">
              Compte fictif de démonstration. Aucun mot de passe et aucune
              donnée partagée avec les autres visiteurs.
            </p>
          )}
          {user ? (
            <>
              <p>{user.email}</p>
              <span className="pill t-b">{ROLE_LABELS[user.role]}</span>
              <Link className="btn btn-accent" href="/activites">
                Mes activités
                <ArrowRight size={18} />
              </Link>
              <Link className="btn" href="/integrations">
                Connecter ma boutique · API
              </Link>
              {user.role !== "CLIENT" && (
                <Link className="btn" href="/pro">
                  <BriefcaseBusiness size={18} />
                  Mon espace professionnel
                </Link>
              )}
              {!demo && (
                <button
                  className="btn"
                  onClick={async () => {
                    await apiFetch("/api/auth", { method: "DELETE" });
                    await refresh();
                    router.refresh();
                  }}
                >
                  <LogOut size={18} />
                  Me déconnecter
                </button>
              )}
            </>
          ) : (
            <>
              <p className="muted">
                Connectez-vous pour retrouver vos voyages, vos envois et vos
                notifications.
              </p>
              <Link className="btn btn-accent" href="/connexion">
                Me connecter ou créer un compte
                <ArrowRight size={18} />
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
