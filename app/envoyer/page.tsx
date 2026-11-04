"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  MapPin,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHead, Stepper } from "@/components/ui";
import { Waybill } from "@/components/Paper";
import { AG, AG_CODES, QUARTIERS, CONS } from "@/lib/data";
import { priceExp, priceFret, priceMasse } from "@/lib/pricing";
import { fcfa, dIso } from "@/lib/format";
import type { AgencyCode, Cons, Mode, Parcel } from "@/lib/types";
interface Draft {
  type: Mode;
  from: AgencyCode;
  to: AgencyCode;
  fromQ: string;
  toQ: string;
  weight: number;
  L: number;
  W: number;
  H: number;
  cons: Cons;
  fragile: boolean;
  desc: string;
  sender: string;
  senderTel: string;
  recipient: string;
  recipientTel: string;
  service: "STANDARD" | "EXPRESS";
  pickupAddr: string;
  dropAddr: string;
  wanted: string;
  delivery: "retrait" | "livraison";
}
const initial: Draft = {
  type: "EXPRESS",
  from: "DKR",
  to: "TBA",
  fromQ: "Plateau",
  toQ: "Almadies",
  weight: 2,
  L: 30,
  W: 20,
  H: 15,
  cons: "SEC",
  fragile: false,
  desc: "",
  sender: "",
  senderTel: "",
  recipient: "",
  recipientTel: "",
  service: "STANDARD",
  pickupAddr: "",
  dropAddr: "",
  wanted: dIso(Date.now() + 86400000),
  delivery: "retrait",
};
export default function Send() {
  const { S, user, refresh } = useStore();
  const [f, setF] = useState<Draft>(() => {
      try {
        const saved =
          typeof window !== "undefined" &&
          sessionStorage.getItem("livrex-send-draft");
        return saved ? { ...initial, ...JSON.parse(saved) } : initial;
      } catch {
        return initial;
      }
    }),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState<Parcel | null>(null);
  const [requestId, setRequestId] = useState("");
  const [today] = useState(() => dIso(Date.now()));

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const next = { ...f, [k]: v };
    setF(next);
    try {
      sessionStorage.setItem("livrex-send-draft", JSON.stringify(next));
    } catch {}
    setRequestId("");
  };
  const price =
    f.type === "EXPRESS"
      ? priceExp(S.tarifs, f)
      : f.type === "FRET"
        ? priceFret(S.tarifs, { ...f, packed: "client" })
        : priceMasse(S.tarifs, f);
  function next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (
      step === 0 &&
      ((f.type === "EXPRESS" && f.fromQ === f.toQ) ||
        (f.type !== "EXPRESS" && f.from === f.to))
    ) {
      setError("Choisissez un départ et une arrivée différents.");
      return;
    }
    if (
      step === 1 &&
      f.weight >
        (f.type === "EXPRESS"
          ? S.tarifs.expressMax
          : f.type === "FRET"
            ? S.tarifs.fretMax
            : S.tarifs.masseMax)
    ) {
      setError(
        "Le poids dépasse la capacité de ce service. Choisissez un autre service à l’étape précédente.",
      );
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const id = requestId || crypto.randomUUID();
      setRequestId(id);
      const r = await fetch("/api/parcels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": id,
        },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
      setDone(d);
      sessionStorage.removeItem("livrex-send-draft");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de confirmer.");
    } finally {
      setBusy(false);
    }
  }
  const field = (
    k: keyof Draft,
    label: string,
    type = "text",
    extra: Record<string, string | number> = {},
  ) => (
    <div className="field">
      <label htmlFor={"send-" + k}>{label}</label>
      <input
        id={"send-" + k}
        className="in"
        value={f[k] as string | number}
        type={type}
        required
        onChange={(e) =>
          set(
            k,
            (type === "number"
              ? Number(e.target.value)
              : e.target.value) as never,
          )
        }
        {...extra}
      />
    </div>
  );
  const city = (k: "from" | "to", label: string) => (
    <div className="field">
      <label htmlFor={"send-" + k}>{label}</label>
      <select
        className="in"
        id={"send-" + k}
        value={f[k]}
        onChange={(e) => set(k, e.target.value as AgencyCode)}
      >
        {AG_CODES.map((c) => (
          <option value={c} key={c}>
            {AG[c].name}
          </option>
        ))}
      </select>
    </div>
  );
  if (done)
    return (
      <section className="view">
        <PageHead
          eyebrow="Votre envoi est enregistré"
          title="C’est parti, on prend le relais."
          lead="Retrouvez cet envoi et toutes ses étapes dans Mes activités."
        />
        <div className="wrap wizard-layout">
          <div className="paper label" style={{ maxWidth: "none" }}>
            <Waybill p={done} />
          </div>
          <div className="card stack">
            <span className="success-icon">
              <Check />
            </span>
            <h2>{done.id}</h2>
            <p>
              {done.type === "EXPRESS"
                ? "Votre demande de collecte est transmise à l’équipe."
                : "Déposez votre colis en agence ou attendez la confirmation de votre enlèvement."}
            </p>
            <p className="note">
              À régler : {fcfa(done.price)}. Aucun paiement en ligne n’a été
              débité.
            </p>
            <p>
              Code de remise : <strong className="mono">{done.otp}</strong>
              <br />
              <small className="muted">
                À communiquer uniquement lors de la remise au destinataire.
              </small>
            </p>
            <Link className="btn btn-accent" href={"/suivre?q=" + done.id}>
              Suivre mon colis
              <ArrowRight size={18} />
            </Link>
            <button className="btn" onClick={() => window.print()}>
              Imprimer / Enregistrer en PDF
            </button>
            <button
              className="text-button"
              onClick={() => {
                setDone(null);
                setF(initial);
                setStep(0);
                setRequestId("");
              }}
            >
              Préparer un autre envoi
            </button>
          </div>
        </div>
      </section>
    );
  return (
    <section className="view">
      <PageHead
        eyebrow="LIVREX · Fret Express"
        title="Un colis à envoyer ?"
        lead="Dites-nous où il va. Nous vous guidons pour la suite."
      />
      <div className="wrap">
        <Stepper
          steps={[
            "Le trajet",
            "La marchandise",
            "Les contacts",
            "Confirmation",
          ]}
          current={step}
        />
        <div className="wizard-layout">
          <form className="card wizard-form" onSubmit={next}>
            {step === 0 && (
              <>
                <span className="form-section-icon">
                  <MapPin />
                </span>
                <h2>Où doit-on l’emmener ?</h2>
                <p className="muted">
                  Choisissez le service qui correspond à votre trajet.
                </p>
                <div className="service-options">
                  {(
                    [
                      {
                        type: "EXPRESS",
                        title: "Dans Dakar",
                        sub: "Collecte et livraison à domicile",
                        icon: Package,
                      },
                      {
                        type: "FRET",
                        title: "Entre les villes",
                        sub: "Dépôt et retrait en agence",
                        icon: MapPin,
                      },
                      {
                        type: "MASSE",
                        title: "Un camion dédié",
                        sub: "Un transport pour vos gros volumes",
                        icon: Truck,
                      },
                    ] as const
                  ).map((x) => (
                    <label
                      key={x.type}
                      className={
                        "service-option " +
                        (f.type === x.type ? "selected" : "")
                      }
                    >
                      <input
                        type="radio"
                        name="send-mode"
                        value={x.type}
                        checked={f.type === x.type}
                        onChange={() => set("type", x.type)}
                      />
                      <x.icon size={21} />
                      <span>
                        <strong>{x.title}</strong>
                        <small>{x.sub}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="g2">
                  {f.type === "EXPRESS" ? (
                    (["fromQ", "toQ"] as const).map((k, i) => (
                      <div className="field" key={k}>
                        <label htmlFor={"send-" + k}>
                          {i ? "Quartier de livraison" : "Quartier de collecte"}
                        </label>
                        <select
                          className="in"
                          id={"send-" + k}
                          value={f[k]}
                          onChange={(e) => set(k, e.target.value)}
                        >
                          {QUARTIERS.map((q) => (
                            <option key={q}>{q}</option>
                          ))}
                        </select>
                      </div>
                    ))
                  ) : (
                    <>
                      {city("from", "Ville de départ")}
                      {city("to", "Ville d’arrivée")}
                    </>
                  )}
                </div>
                {f.type === "MASSE" && (
                  <>
                    <div className="g2">
                      {field("pickupAddr", "Adresse d’enlèvement")}
                      {field("dropAddr", "Adresse de livraison")}
                    </div>
                    {field("wanted", "Date souhaitée", "date", { min: today })}
                  </>
                )}
                {f.type === "FRET" && (
                  <p className="note">
                    Votre colis sera déposé à l’agence de {AG[f.from].name} et
                    retiré à celle de {AG[f.to].name}.
                  </p>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <span className="form-section-icon">
                  <Package />
                </span>
                <h2>Parlez-nous de votre colis.</h2>
                <p className="muted">
                  Ces informations permettent de préparer sa prise en charge.
                </p>
                {field("desc", "Que contient votre envoi ?", "text", {
                  placeholder:
                    "Ex. vêtements, documents, produits alimentaires",
                  minLength: 2,
                  maxLength: 500,
                })}
                <div className="g2">
                  {field("weight", "Poids total (kg)", "number", {
                    min: 0.1,
                    step: 0.1,
                    max: 30000,
                  })}
                  <div className="field">
                    <label htmlFor="send-cons">Conservation</label>
                    <select
                      id="send-cons"
                      className="in"
                      value={f.cons}
                      onChange={(e) => set("cons", e.target.value as Cons)}
                    >
                      {Object.entries(CONS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="check large-check">
                  <input
                    type="checkbox"
                    checked={f.fragile}
                    onChange={(e) => set("fragile", e.target.checked)}
                  />
                  <span>
                    <strong>Mon colis est fragile</strong>
                    <small>
                      Par exemple : verre, vaisselle ou matériel électronique.
                    </small>
                  </span>
                </label>
                {f.type === "EXPRESS" && (
                  <>
                    <p className="lab">Dimensions de l’emballage</p>
                    <div className="g3">
                      {field("L", "Longueur (cm)", "number", {
                        min: 1,
                        max: 300,
                      })}
                      {field("W", "Largeur (cm)", "number", {
                        min: 1,
                        max: 300,
                      })}
                      {field("H", "Hauteur (cm)", "number", {
                        min: 1,
                        max: 300,
                      })}
                    </div>
                    <div className="field">
                      <label htmlFor="send-service">Vitesse de livraison</label>
                      <select
                        className="in"
                        id="send-service"
                        value={f.service}
                        onChange={(e) =>
                          set("service", e.target.value as Draft["service"])
                        }
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="EXPRESS">Express</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <span className="form-section-icon">
                  <ShieldCheck />
                </span>
                <h2>Qui envoie ? Qui reçoit ?</h2>
                <p className="muted">
                  L’équipe utilisera ces coordonnées pour organiser la remise.
                </p>
                <fieldset className="stack">
                  <legend>Expéditeur</legend>
                  <div className="g2">
                    {field("sender", "Nom de l’expéditeur", "text", {
                      autoComplete: "name",
                      minLength: 2,
                    })}
                    {field("senderTel", "Téléphone de l’expéditeur", "tel", {
                      placeholder: "77 123 45 67",
                      pattern: "[+0-9 ()-]{9,20}",
                      autoComplete: "tel",
                    })}
                  </div>
                </fieldset>
                <fieldset className="stack">
                  <legend>Destinataire</legend>
                  <div className="g2">
                    {field("recipient", "Nom du destinataire", "text", {
                      minLength: 2,
                    })}
                    {field("recipientTel", "Téléphone du destinataire", "tel", {
                      placeholder: "77 123 45 67",
                      pattern: "[+0-9 ()-]{9,20}",
                    })}
                  </div>
                </fieldset>
              </>
            )}
            {step === 3 && (
              <>
                <span className="form-section-icon">
                  <Check />
                </span>
                <h2>Tout est bon pour vous ?</h2>
                <p className="muted">
                  Vérifiez les informations avant de confirmer.
                </p>
                <dl className="review-list">
                  <div>
                    <dt>Trajet</dt>
                    <dd>
                      {f.type === "EXPRESS" ? f.fromQ : AG[f.from].name} →{" "}
                      {f.type === "EXPRESS" ? f.toQ : AG[f.to].name}
                    </dd>
                  </div>
                  <div>
                    <dt>Marchandise</dt>
                    <dd>
                      {f.desc} · {f.weight} kg · {CONS[f.cons].label}
                      {f.fragile ? " · Fragile" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Expéditeur</dt>
                    <dd>
                      {f.sender} · {f.senderTel}
                    </dd>
                  </div>
                  <div>
                    <dt>Destinataire</dt>
                    <dd>
                      {f.recipient} · {f.recipientTel}
                    </dd>
                  </div>
                  <div>
                    <dt>Paiement</dt>
                    <dd>En agence · {fcfa(price.total)}</dd>
                  </div>
                </dl>
                <p className="note">
                  Vous réglez auprès de l’équipe. Les paiements en ligne seront
                  disponibles après activation des prestataires.
                </p>
                {!user && (
                  <div className="login-callout">
                    <h3>Une dernière étape : votre compte.</h3>
                    <p>Votre envoi vous attendra ici après la connexion.</p>
                    <Link
                      href="/connexion?next=/envoyer"
                      className="btn btn-accent"
                    >
                      Me connecter pour confirmer
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                )}
              </>
            )}
            {error && (
              <p className="errbox" role="alert">
                {error}
              </p>
            )}
            <div className="wizard-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft size={17} />
                  Retour
                </button>
              )}
              {step < 3 ? (
                <button className="btn btn-accent" type="submit">
                  Continuer
                  <ArrowRight size={18} />
                </button>
              ) : (
                user && (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-accent"
                    onClick={confirm}
                  >
                    {busy ? "Enregistrement…" : "Confirmer mon envoi"}
                    <Check size={18} />
                  </button>
                )
              )}
            </div>
          </form>
          <aside className="card quote-card">
            <span className="section-tag">VOTRE ENVOI, EN UN COUP D’ŒIL</span>
            <h3>
              {f.type === "EXPRESS"
                ? "Livraison dans Dakar"
                : f.type === "FRET"
                  ? "Fret entre agences"
                  : "Camion dédié"}
            </h3>
            <div className="quote-route">
              <span className="route-dot" />
              {f.type === "EXPRESS" ? f.fromQ : AG[f.from].name}
              <span className="route-line" />
              <span className="route-dot end" />
              {f.type === "EXPRESS" ? f.toQ : AG[f.to].name}
            </div>
            <div className="quote-total">
              <small>Prix estimé</small>
              <strong>{fcfa(price.total)}</strong>
              <span>
                {f.weight} kg · {CONS[f.cons].label}
              </span>
            </div>
            <details className="quote-details">
              <summary>Détail du prix</summary>
              {price.lines.map(([l, n]) => (
                <div key={l}>
                  <span>{l}</span>
                  <b>{fcfa(n)}</b>
                </div>
              ))}
            </details>
            <p className="quote-note">
              <ShieldCheck size={18} />
              Le prix est vérifié à la confirmation. Aucun débit en ligne.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
