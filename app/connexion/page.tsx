"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
function Form() {
  const params = useSearchParams(),
    router = useRouter();
  const { refresh } = useStore();
  const [register, setRegister] = useState(false),
    [setup, setSetup] = useState(false),
    [needsToken, setNeedsToken] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setSetup(d.needsSetup);
        setNeedsToken(d.needsSetupToken);
        if (d.needsSetup) setRegister(true);
      });
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: register ? "register" : "login",
          name: data.get("name") || undefined,
          email: data.get("email"),
          password: data.get("password"),
          setupToken: data.get("setupToken") || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh();
      const next = params.get("next");
      router.replace(
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : setup
            ? "/pro"
            : "/activites",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-layout wrap">
      <div className="auth-intro">
        <span className="section-tag">BIENVENUE CHEZ VOUS</span>
        <h1>
          Tous vos trajets.
          <br />
          Tous vos envois.
          <br />
          <em>Un seul compte.</em>
        </h1>
        <p>Retrouvez vos billets et vos colis, où que vous soyez.</p>
        <div className="hero-assurance">
          <ShieldCheck size={20} />
          Vos données restent privées.
        </div>
      </div>
      <div className="card auth-card">
        <span className="auth-icon">
          <LockKeyhole />
        </span>
        <h2>
          {setup
            ? "Configurez votre espace"
            : register
              ? "Créer mon compte"
              : "Heureux de vous retrouver"}
        </h2>
        <p className="muted">
          {setup
            ? "Premier démarrage : ce compte deviendra administrateur. Les suivants seront des comptes clients."
            : register
              ? "Quelques informations pour commencer."
              : "Connectez-vous pour retrouver vos activités."}
        </p>
        <form onSubmit={submit} className="stack">
          {register && (
            <div className="field">
              <label htmlFor="auth-name">Nom complet</label>
              <input
                id="auth-name"
                className="in"
                name="name"
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Adresse e-mail</label>
            <input
              id="auth-email"
              className="in"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Mot de passe</label>
            <input
              id="auth-password"
              className="in"
              name="password"
              type="password"
              minLength={10}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
            <small className="muted">10 caractères minimum</small>
          </div>
          {setup && needsToken && (
            <div className="field">
              <label htmlFor="auth-setup-token">
                Code d’initialisation administrateur
              </label>
              <input
                className="in"
                id="auth-setup-token"
                name="setupToken"
                type="password"
                autoComplete="off"
                required
              />
              <small className="muted">
                Le code privé défini dans les paramètres de l’hébergement.
              </small>
            </div>
          )}
          {error && (
            <p className="errbox" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn btn-accent btn-lg">
            {busy
              ? "Un instant…"
              : register
                ? "Créer mon compte"
                : "Me connecter"}
            <ArrowRight size={18} />
          </button>
        </form>
        {!setup && (
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Déjà un compte ? Me connecter"
              : "Nouveau ici ? Créer un compte"}
          </button>
        )}
        <Link className="muted" href="/aide">
          Besoin d’aide pour accéder à votre compte ?
        </Link>
      </div>
    </section>
  );
}
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
