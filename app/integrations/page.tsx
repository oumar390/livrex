"use client";
import { apiFetch } from "@/lib/client-api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/ui";
import { useStore } from "@/lib/store";
export default function Integrations() {
  const { user, demo } = useStore();
  const [keys, setKeys] = useState<
      { id: string; name: string; created: number }[]
    >([]),
    [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    apiFetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setKeys(d);
      });
  useEffect(() => {
    if (user) load();
  }, [user]);
  if (demo)
    return (
      <section className="view">
        <PageHead
          eyebrow="Démonstration"
          title="L’API sera disponible avec Supabase"
          lead="Explorez les envois dans l’application. Les clés d’accès externes seront activées après connexion de la base."
        />
        <div className="wrap">
          <Link className="btn btn-accent" href="/envoyer">
            Simuler un envoi
          </Link>
        </div>
      </section>
    );
  return (
    <section className="view">
      <PageHead
        eyebrow="Pour les entreprises"
        title="Connecter ma boutique"
        lead="Créez vos envois depuis votre site e-commerce avec une clé API personnelle."
      />
      <div className="wrap narrow stack">
        {!user ? (
          <Link className="btn btn-accent" href="/connexion?next=/integrations">
            Me connecter
          </Link>
        ) : (
          <>
            <form
              className="card stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                const r = await apiFetch("/api/keys", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                const d = await r.json();
                if (!r.ok) setError(d.error);
                else {
                  setToken(d.token);
                  setName("");
                  load();
                }
              }}
            >
              <h2>Une clé pour votre intégration</h2>
              <label className="field">
                Nom de la boutique
                <input
                  className="in"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <button className="btn btn-accent">Créer une clé API</button>
              {error && (
                <p className="errbox" role="alert">
                  {error}
                </p>
              )}
              {token && (
                <div className="note">
                  <p>
                    Copiez cette clé maintenant. Elle ne sera plus affichée
                    après votre départ de cette page. Gardez-la côté serveur.
                  </p>
                  <code
                    style={{
                      overflowWrap: "anywhere",
                      display: "block",
                      marginTop: 12,
                    }}
                  >
                    {token}
                  </code>
                </div>
              )}
            </form>
            <div className="card stack">
              <h2>Mes clés actives</h2>
              {keys.length ? (
                keys.map((k) => (
                  <div
                    className="row"
                    key={k.id}
                    style={{ justifyContent: "space-between" }}
                  >
                    <span>{k.name}</span>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        if (!confirm("Révoquer cette clé ?")) return;
                        await apiFetch("/api/keys", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: k.id }),
                        });
                        load();
                      }}
                    >
                      Révoquer
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">Aucune clé pour le moment.</p>
              )}
            </div>
          </>
        )}
        <div className="card stack">
          <h2>Créer un envoi</h2>
          <p>
            POST <code>/api/v1/shipments</code> · en-têtes{" "}
            <code>Authorization: Bearer VOTRE_CLE</code>,{" "}
            <code>Content-Type: application/json</code> et{" "}
            <code>Idempotency-Key</code> unique par commande.
          </p>
          <pre className="code">
            {JSON.stringify(
              {
                pickup: "Plateau",
                dropoff: "Almadies",
                weight_kg: 2,
                description: "Commande boutique",
                sender: { name: "Ma boutique", phone: "771234567" },
                recipient: { name: "Awa Diop", phone: "781234567" },
              },
              null,
              2,
            )}
          </pre>
          <p className="muted">
            L’envoi est enregistré et visible dans Mes activités. Le paiement
            reste à encaisser. Les webhooks et les SMS externes ne sont pas
            activés.
          </p>
        </div>
      </div>
    </section>
  );
}
