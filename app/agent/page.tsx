"use client";

import { useState, type ReactNode } from "react";
import { AssignDrawer, ParcelDrawer } from "@/components/Drawers";
import { Waybill } from "@/components/Paper";
import { Choice, PageHead, Pill, Row, Stepper, Tabs } from "@/components/ui";
import { logStep, setStatus } from "@/lib/actions";
import {
  AG,
  AG_CODES,
  catLabel,
  CONS,
  FRAGILE,
  kgTxt,
  METHODS,
  packOf,
  QUARTIERS,
  qp,
  ST,
  ZONES,
} from "@/lib/data";
import { CategoryPicker } from "@/components/Pickers";
import { findParcel, nextZone, parcelAgency } from "@/lib/domain";
import { fcfa, kg, nf, otp, pad, rnd } from "@/lib/format";
import { priceFret } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { AgencyCode, Channel, Cons, Method, Parcel } from "@/lib/types";

const STEPS = [
  "Identification",
  "Catégorie",
  "Emballage",
  "Pesage",
  "Facturation",
  "Paiement",
  "Étiquette",
  "Stockage",
];

interface Draft {
  sender: string;
  senderTel: string;
  recipient: string;
  recipientTel: string;
  to: AgencyCode;
  desc: string;
  service: "STANDARD" | "EXPRESS24";
  delivery: "retrait" | "livraison";
  dropQ: string;
  dropNote: string;
  channel: Channel;
  cons: Cons | "";
  fragile: boolean;
  packed: "agence" | "client";
  packDone: boolean;
  weight: string;
  method: Method;
}
const blank = (from: AgencyCode): Draft => ({
  sender: "",
  senderTel: "",
  recipient: "",
  recipientTel: "",
  to: from === "TBA" ? "DKR" : "TBA",
  desc: "",
  service: "STANDARD",
  delivery: "retrait",
  dropQ: "Sacré-Cœur",
  dropNote: "",
  channel: "SMS",
  cons: "",
  fragile: false,
  packed: "agence",
  packDone: false,
  weight: "",
  method: "CASH",
});

type Tab = "new" | "stock" | "remise";

export default function Agent() {
  const [agency, setAgency] = useState<AgencyCode>("DKR");
  const [tab, setTab] = useState<Tab>("new");
  const [rid, setRid] = useState("");
  return (
    <section className="view">
      <PageHead
        eyebrow="Espace agent d'agence"
        title="Guichet colis"
        lead={`Agence de ${AG[agency].name} · ${AG[agency].site} · ${AG[agency].hours}`}
        right={
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="a-ag">Mon agence</label>
            <select
              className="in"
              id="a-ag"
              value={agency}
              onChange={(e) => setAgency(e.target.value as AgencyCode)}
            >
              {AG_CODES.map((k) => (
                <option key={k} value={k}>
                  {AG[k].name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="wrap">
        <Tabs<Tab>
          tabs={[
            ["new", "Nouveau colis"],
            ["stock", "Stock et scan hub"],
            ["remise", "Remise au bénéficiaire"],
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "new" && (
          <NewParcel
            key={agency}
            agency={agency}
            onStock={() => setTab("stock")}
          />
        )}
        {tab === "stock" && (
          <Stock
            agency={agency}
            onGive={(id) => {
              setRid(id);
              setTab("remise");
            }}
          />
        )}
        {tab === "remise" && (
          <Remise agency={agency} rid={rid} setRid={setRid} />
        )}
      </div>
    </section>
  );
}

function NewParcel({
  agency,
  onStock,
}: {
  agency: AgencyCode;
  onStock: () => void;
}) {
  const { S, act } = useStore();
  const [step, setStep] = useState(0);
  const [pid, setPid] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(() => blank(agency));
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const p = pid ? findParcel(S, pid) : undefined;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const next = () => {
    setErr("");
    setStep((s) => s + 1);
  };

  const advance = () => {
    if (step === 0) {
      if (
        ["sender", "senderTel", "recipient", "recipientTel"].some(
          (k) => !String(d[k as keyof Draft]).trim(),
        )
      ) {
        setErr("Renseignez expéditeur, bénéficiaire et leurs téléphones.");
        return;
      }
      const id = act((c) => {
        const id = "COL-2026-" + pad(++c.S.seq.COL);
        const delivery =
          d.delivery === "livraison" && d.to === "DKR"
            ? "livraison"
            : "retrait";
        const np: Parcel = {
          id,
          type: "FRET",
          sender: d.sender.trim(),
          senderTel: d.senderTel.trim(),
          recipient: d.recipient.trim(),
          recipientTel: d.recipientTel.trim(),
          from: agency,
          to: d.to,
          desc: d.desc,
          service: d.service,
          delivery,
          drop:
            delivery === "livraison"
              ? {
                  ...qp(d.dropQ),
                  label: d.dropQ + (d.dropNote ? " · " + d.dropNote : ""),
                }
              : null,
          channel: d.channel,
          cons: "SEC",
          fragile: false,
          weight: 0,
          packed: "agence",
          otp: otp(),
          track: [],
          history: [],
          zone: "",
          price: 0,
          payment: null,
          status: ST.CREATED,
          created: Date.now(),
          updated: Date.now(),
        };
        c.S.parcels.unshift(np);
        setStatus(c, np, ST.CREATED, "Guichet " + AG[agency].name);
        return id;
      });
      setPid(id);
    } else if (!p) return;
    else if (step === 1)
      act((c) => {
        p.cons = d.cons as Cons;
        p.fragile = d.fragile;
        setStatus(c, p, ST.PREP, "Catégorie " + catLabel(p));
      });
    else if (step === 2)
      act(() => {
        p.packed = d.packed;
        logStep(
          p,
          "Emballage réalisé · " +
            (d.packed === "agence" ? "fourni par l'agence" : "client"),
        );
      });
    else if (step === 3)
      act(() => {
        p.weight = +d.weight;
        logStep(p, "Pesé · " + kg(+d.weight));
      });
    else if (step === 4)
      act((c) => {
        p.price = priceFret(c.S.tarifs, {
          from: p.from!,
          to: p.to!,
          cons: p.cons,
          fragile: p.fragile,
          weight: p.weight,
          service: p.service,
          packed: p.packed,
        }).total;
      });
    else if (step === 5) {
      setPaying(true);
      setTimeout(() => {
        act((c) => {
          p.payment = {
            mode: d.method,
            ref: "PAY-" + pad(++c.S.seq.PAY),
            amount: p.price,
            status: "Payé",
            t: Date.now(),
          };
          c.toast(
            `Paiement ${METHODS[d.method]} enregistré · ${fcfa(p.price)}`,
            "OK",
          );
        });
        setPaying(false);
        next();
      }, 900);
      return;
    } else if (step === 6)
      act((c) => {
        if (!p.zone) p.zone = nextZone(c.S, agency, p.cons, p.fragile);
      });
    else if (step === 7) act((c) => setStatus(c, p, ST.STORED, p.zone));
    next();
  };

  const restart = () => {
    setStep(0);
    setPid(null);
    setD(blank(agency));
  };
  const dests = AG_CODES.filter((k) => k !== agency);
  const preview =
    step === 4
      ? priceFret(S.tarifs, {
          from: agency,
          to: d.to,
          cons: d.cons,
          fragile: d.fragile,
          weight: d.weight,
          service: d.service,
          packed: d.packed,
        })
      : null;

  let body: ReactNode = null,
    label = "",
    disabled = false;
  if (step === 0) {
    label = "Créer le colis";
    body = (
      <>
        <div className="g2">
          <div className="field">
            <label htmlFor="d-s">Expéditeur</label>
            <input
              className="in"
              id="d-s"
              value={d.sender}
              onChange={(e) => set("sender", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-st">Téléphone expéditeur</label>
            <input
              className="in"
              id="d-st"
              value={d.senderTel}
              onChange={(e) => set("senderTel", e.target.value)}
              inputMode="tel"
            />
          </div>
          <div className="field">
            <label htmlFor="d-r">Bénéficiaire</label>
            <input
              className="in"
              id="d-r"
              value={d.recipient}
              onChange={(e) => set("recipient", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-rt">Téléphone bénéficiaire</label>
            <input
              className="in"
              id="d-rt"
              value={d.recipientTel}
              onChange={(e) => set("recipientTel", e.target.value)}
              inputMode="tel"
            />
          </div>
          <div className="field">
            <label>Agence de départ</label>
            <input className="in" value={AG[agency].name} disabled />
          </div>
          <div className="field">
            <label htmlFor="d-to">Agence de destination</label>
            <select
              className="in"
              id="d-to"
              value={d.to}
              onChange={(e) => set("to", e.target.value as AgencyCode)}
            >
              {dests.map((k) => (
                <option key={k} value={k}>
                  {AG[k].name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="d-desc">Description</label>
          <input
            className="in"
            id="d-desc"
            value={d.desc}
            onChange={(e) => set("desc", e.target.value)}
            placeholder="Contenu déclaré"
          />
        </div>
        <div className="g3" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="d-svc">Type de service</label>
            <select
              className="in"
              id="d-svc"
              value={d.service}
              onChange={(e) =>
                set("service", e.target.value as Draft["service"])
              }
            >
              <option value="STANDARD">Fret standard 48–72 h</option>
              <option value="EXPRESS24">Fret express 24 h</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-del">À l&apos;arrivée</label>
            <select
              className="in"
              id="d-del"
              value={d.delivery}
              onChange={(e) =>
                set("delivery", e.target.value as Draft["delivery"])
              }
            >
              <option value="retrait">Retrait en agence</option>
              <option value="livraison">Livraison à domicile</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-ch">Canal de notification</label>
            <select
              className="in"
              id="d-ch"
              value={d.channel}
              onChange={(e) => set("channel", e.target.value as Channel)}
            >
              <option value="SMS">SMS</option>
              <option value="EMAIL">E-mail</option>
              <option value="CALL">Appel</option>
            </select>
          </div>
        </div>
        {d.delivery === "livraison" &&
          (d.to === "DKR" ? (
            <div className="g2" style={{ marginTop: 14 }}>
              <div className="field">
                <label htmlFor="d-dq">Quartier de livraison</label>
                <select
                  className="in"
                  id="d-dq"
                  value={d.dropQ}
                  onChange={(e) => set("dropQ", e.target.value)}
                >
                  {QUARTIERS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="d-dn">Repère</label>
                <input
                  className="in"
                  id="d-dn"
                  value={d.dropNote}
                  onChange={(e) => set("dropNote", e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="note" style={{ marginTop: 14 }}>
              La livraison à domicile n&apos;est ouverte qu&apos;à Dakar dans ce
              service. Pour {AG[d.to].name}, le colis sera mis en retrait
              jusqu&apos;à l&apos;ouverture d&apos;une équipe de livreurs
              locale.
            </p>
          ))}
      </>
    );
  } else if (step === 1) {
    label = "Valider la catégorie";
    disabled = !d.cons;
    body = (
      <>
        <p className="muted" style={{ marginBottom: 12 }}>
          La catégorie détermine la zone de stockage, l&apos;emballage et le
          véhicule autorisé.
        </p>
        <CategoryPicker
          name="d"
          cons={d.cons}
          fragile={d.fragile}
          onChange={(cons, fragile) => setD((x) => ({ ...x, cons, fragile }))}
        />
      </>
    );
  } else if (step === 2 && d.cons) {
    label = "Passer au pesage";
    disabled = !d.packDone;
    body = (
      <>
        <div className="note" style={{ marginBottom: 14 }}>
          Emballage recommandé pour{" "}
          <b>{catLabel({ cons: d.cons, fragile: d.fragile })}</b> :{" "}
          {packOf(d.cons, d.fragile)}.
        </div>
        <div
          className="choices"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
        >
          <Choice
            name="dpk"
            value="agence"
            checked={d.packed === "agence"}
            onChange={() => set("packed", "agence")}
            title="Fourni par l'agence"
            sub={"Facturé " + fcfa(S.tarifs.pack)}
          />
          <Choice
            name="dpk"
            value="client"
            checked={d.packed === "client"}
            onChange={() => set("packed", "client")}
            title="Apporté par le client"
            sub="Contrôlé par l'agent"
          />
        </div>
        <label className="check" style={{ marginTop: 16 }}>
          <input
            type="checkbox"
            checked={d.packDone}
            onChange={(e) => set("packDone", e.target.checked)}
          />
          <span>Emballage réalisé et conforme à la catégorie</span>
        </label>
      </>
    );
  } else if (step === 3) {
    const over = +d.weight > S.tarifs.fretMax;
    label = "Calculer le prix";
    disabled = !(+d.weight > 0) || over;
    body = (
      <>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="d-w">Poids (kg)</label>
            <input
              className="in mono"
              type="number"
              step={0.1}
              min={0.1}
              id="d-w"
              value={d.weight}
              onChange={(e) => set("weight", e.target.value)}
              style={{ fontSize: 22 }}
            />
          </div>
          <button
            className="btn"
            onClick={() =>
              set("weight", (Math.round(rnd(0.8, 24) * 10) / 10).toString())
            }
          >
            Lire la balance
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Le poids sert au calcul du prix et figure sur l&apos;étiquette. Fret
          routier jusqu&apos;à {kgTxt(S.tarifs.fretMax)}.
        </p>
        {over && (
          <div className="errbox">
            Au-delà de {kgTxt(S.tarifs.fretMax)}, ce n&apos;est plus du fret
            routier : orientez le client vers le <b>transport par camion dédié</b>{" "}
            (camion dédié, page Envoyer).
          </div>
        )}
        {+d.weight > 0 &&
          +d.weight <= S.tarifs.expressMax &&
          agency === "DKR" &&
          d.to === "DKR" && (
            <p className="note">
              Colis léger dans Dakar : la livraison express serait plus rapide.
            </p>
          )}
      </>
    );
  } else if (step === 4 && preview) {
    label = "Établir la facture";
    body = (
      <>
        <div className="sum">
          {preview.lines.map((l) => (
            <div key={l[0]}>
              <span className="muted">{l[0]}</span>
              <span className="mono">{nf(l[1])}</span>
            </div>
          ))}
          <div className="tot">
            <span>Total à payer</span>
            <span>{fcfa(preview.total)}</span>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Barème indicatif, réglable dans Admin › Tarifs.
        </p>
      </>
    );
  } else if (step === 5 && p) {
    label = paying ? "Encaissement…" : "Enregistrer le paiement";
    disabled = paying;
    body = (
      <>
        <div
          className="row"
          style={{ justifyContent: "space-between", marginBottom: 14 }}
        >
          <span className="muted">Montant</span>
          <b className="mono" style={{ fontSize: 22 }}>
            {fcfa(p.price)}
          </b>
        </div>
        <div className="choices">
          {(["CASH"] as Method[]).map((m) => (
            <Choice
              key={m}
              name="dpm"
              value={m}
              checked={d.method === m}
              onChange={(v) => set("method", v as Method)}
              title={METHODS[m]}
            />
          ))}
        </div>
      </>
    );
  } else if (step === 6 && p) {
    label = "Étiquette posée";
    body = (
      <>
        <div className="paper label">
          <Waybill p={p} />
        </div>
        <div
          className="row"
          style={{ marginTop: 10, justifyContent: "space-between" }}
        >
          <p className="muted" style={{ fontSize: 13 }}>
            Collez l&apos;étiquette sur la face supérieure du colis.
          </p>
          <button
            className="btn btn-sm no-print"
            onClick={() => window.print()}
          >
            Imprimer
          </button>
        </div>
      </>
    );
  } else if (step === 7 && p) {
    label = "Confirmer le rangement";
    body = (
      <div className="g2">
        <div
          className="card"
          style={{ background: "var(--surface-2)", border: 0 }}
        >
          <span className="eyebrow">Emplacement attribué</span>
          <h3 style={{ fontSize: 28, marginTop: 6 }}>{p.zone}</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            {CONS[p.cons].hint}
            {p.fragile ? " · " + FRAGILE.hint : ""}
          </p>
        </div>
        <div className="stack" style={{ gap: 6, fontSize: 14 }}>
          <div>
            <span className="muted">Colis</span> <b className="mono">{p.id}</b>
          </div>
          <div>
            <span className="muted">Catégorie</span> <b>{catLabel(p)}</b>
          </div>
          <div>
            <span className="muted">Agence</span> <b>{AG[agency].name}</b>
          </div>
          <div>
            <span className="muted">Statut après validation</span>{" "}
            <Pill s={ST.STORED} />
          </div>
        </div>
      </div>
    );
  } else if (step >= 8 && p) {
    body = (
      <div className="stack" style={{ alignItems: "flex-start" }}>
        <Pill s={ST.STORED} />
        <h3 className="mono">{p.id}</h3>
        <p className="muted">
          Le colis est en {p.zone}. L&apos;expéditeur a été notifié. Passez-le
          en « Prêt au transfert » depuis le stock quand le véhicule est
          annoncé.
        </p>
        <div className="row">
          <button className="btn btn-accent" onClick={restart}>
            Nouveau colis
          </button>
          <button
            className="btn"
            onClick={() => {
              restart();
              onStock();
            }}
          >
            Voir le stock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="split">
      <div className="card">
        {step < 8 && <Stepper steps={STEPS} current={step} />}
        <h3 style={{ marginBottom: 16 }}>
          {step < 8 ? STEPS[step] : "Prise en charge terminée"}
        </h3>
        {body}
        {label && (
          <div
            className="row"
            style={{ marginTop: 20, justifyContent: "space-between" }}
          >
            <span
              className="muted"
              style={{ fontSize: 13, color: err ? "var(--bad)" : undefined }}
            >
              {err}
            </span>
            <button
              className="btn btn-accent"
              disabled={disabled}
              onClick={advance}
            >
              {paying && <span className="spin" />}
              {label}
            </button>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Fiche colis</h3>
          {p ? (
            <Pill s={p.status} />
          ) : (
            <span className="pill t-n">Brouillon</span>
          )}
        </div>
        <div className="stack" style={{ gap: 8, fontSize: 14 }}>
          <Row label="Identifiant">
            <span className="mono">
              {p ? p.id : "COL-2026-" + pad(S.seq.COL + 1)}
            </span>
          </Row>
          <Row label="Trajet">
            {AG[agency].name} → {AG[d.to].name}
          </Row>
          <Row label="Expéditeur">{d.sender || "—"}</Row>
          <Row label="Bénéficiaire">{d.recipient || "—"}</Row>
          <Row label="Catégorie">
            {d.cons ? catLabel({ cons: d.cons, fragile: d.fragile }) : "—"}
          </Row>
          <Row label="Poids">
            <span className="mono">{d.weight ? kg(+d.weight) : "—"}</span>
          </Row>
          <Row label="Montant">
            <span className="mono">{p && p.price ? fcfa(p.price) : "—"}</span>
          </Row>
          <Row label="Paiement">
            {p && p.payment
              ? METHODS[p.payment.mode] + " · " + p.payment.ref
              : "—"}
          </Row>
        </div>
      </div>
    </div>
  );
}

function Stock({
  agency,
  onGive,
}: {
  agency: AgencyCode;
  onGive: (id: string) => void;
}) {
  const { S, act, openDrawer, toast } = useStore();
  const [scan, setScan] = useState("");
  const list = S.parcels.filter((p) => parcelAgency(p) === agency);
  const zones = ZONES.map((z) => {
    return {
      z,
      n: list.filter((p) => p.zone && p.zone.startsWith(z)).length,
      cap: Math.round(AG[agency].cap / ZONES.length),
    };
  });
  const ready = (p: Parcel) =>
    act((c) => setStatus(c, p, ST.READY, "En attente de chargement"));
  const shelve = (p: Parcel) =>
    act((c) => {
      p.zone = "";
      p.zone = nextZone(c.S, p.to!, p.cons, p.fragile);
      setStatus(c, p, ST.DEST, p.zone);
    });

  /** Scan au hub (WMS) : l'action dépend du statut du colis */
  const doScan = () => {
    const id = scan.trim().toUpperCase();
    const p = findParcel(S, id);
    if (!p || p.type !== "FRET") {
      toast(`Code ${id || "—"} inconnu dans le fret.`, "SCAN");
      return;
    }
    if (p.status === ST.STORED && p.from === agency) {
      ready(p);
      toast(`${id} · tri départ vers ${AG[p.to!].name}`, "SCAN");
    } else if (p.status === ST.ARRIVED && p.to === agency) {
      shelve(p);
      toast(`${id} · rangé à l'arrivée`, "SCAN");
    } else if (p.status === ST.TRANSIT)
      toast(`${id} est en transit, pas encore arrivé.`, "SCAN");
    else {
      act(() => logStep(p, "Scan hub " + AG[agency].name));
      toast(`${id} · ${p.status} · scan enregistré`, "SCAN");
    }
    setScan("");
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            doScan();
          }}
        >
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="sc">Scanner un colis (douchette ou saisie)</label>
            <input
              className="in mono"
              id="sc"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="COL-2026-…"
            />
          </div>
          <button
            className="btn btn-blue"
            type="submit"
            style={{ alignSelf: "flex-end" }}
          >
            Scanner
          </button>
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Stocké → prêt au transfert (tri par destination). Arrivé → rangé en
          zone. Les autres scans sont tracés dans l&apos;historique.
        </p>
      </div>
      <div
        className="g4"
        style={{
          marginBottom: 16,
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
        }}
      >
        {zones.map((z) => (
          <div className="card" key={z.z} style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontSize: 14 }}>{z.z}</b>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {z.n}/{z.cap}
              </span>
            </div>
            <div className="zonebar" style={{ marginTop: 10 }}>
              <i style={{ width: Math.max(2, (z.n / z.cap) * 100) + "%" }} />
            </div>
          </div>
        ))}
      </div>
      {list.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colis</th>
                <th>Catégorie</th>
                <th>Trajet</th>
                <th>Emplacement</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr
                  key={p.id}
                  className="click"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    openDrawer(<ParcelDrawer id={p.id} />);
                  }}
                >
                  <td className="mono">{p.id}</td>
                  <td>{catLabel(p)}</td>
                  <td>
                    {AG[p.from!].name} → {AG[p.to!].name}
                  </td>
                  <td>{p.zone || "—"}</td>
                  <td>
                    <Pill s={p.status} />
                  </td>
                  <td className="num">
                    {p.status === ST.STORED && (
                      <button className="btn btn-sm" onClick={() => ready(p)}>
                        Prêt au transfert
                      </button>
                    )}
                    {p.status === ST.ARRIVED && (
                      <button className="btn btn-sm" onClick={() => shelve(p)}>
                        Ranger
                      </button>
                    )}
                    {p.status === ST.DEST && p.delivery === "livraison" && (
                      <button
                        className="btn btn-sm btn-blue"
                        onClick={() => openDrawer(<AssignDrawer id={p.id} />)}
                      >
                        Affecter un livreur
                      </button>
                    )}
                    {p.status === ST.DEST && p.delivery === "retrait" && (
                      <button
                        className="btn btn-sm btn-blue"
                        onClick={() => onGive(p.id)}
                      >
                        Remettre
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          Aucun colis en stock à {AG[agency].name}. Créez-en un depuis
          l&apos;onglet « Nouveau colis ».
        </div>
      )}
    </>
  );
}

function Remise({
  agency,
  rid,
  setRid,
}: {
  agency: AgencyCode;
  rid: string;
  setRid: (s: string) => void;
}) {
  const { S, act } = useStore();
  const [input, setInput] = useState(rid);
  const [cni, setCni] = useState("");
  const [code, setCode] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const waiting = S.parcels.filter(
    (p) => p.to === agency && p.status === ST.DEST && p.delivery === "retrait",
  );
  const p = rid ? findParcel(S, rid) : undefined;
  const pick = (id: string) => {
    setRid(id);
    setInput(id);
    setCni("");
    setCode("");
    setOk(false);
    setErr("");
  };

  const give = () => {
    if (!p) return;
    if (!cni.trim()) {
      setErr("Saisissez le numéro de pièce d'identité.");
      return;
    }
    if (code.trim() !== p.otp) {
      setErr("Le code ne correspond pas. Demandez le SMS au bénéficiaire.");
      return;
    }
    if (!ok) {
      setErr("Cochez la vérification du colis.");
      return;
    }
    const masked = cni.trim().slice(0, 4) + "•••";
    act((c) => {
      p.proof = { cni: masked, t: Date.now() };
      setStatus(c, p, ST.PICKED, "Pièce " + masked + " · code validé");
    });
    pick("");
  };

  return (
    <div className="split">
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Remise d&apos;un colis</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pick(input.trim().toUpperCase());
          }}
        >
          <div className="field">
            <label htmlFor="r-id">Numéro du colis</label>
            <input
              className="in mono"
              id="r-id"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onBlur={() => input.trim() && pick(input.trim().toUpperCase())}
              placeholder="COL-2026-…"
            />
          </div>
        </form>
        {p ? (
          p.status !== ST.DEST || p.to !== agency ? (
            <p className="note" style={{ marginTop: 14 }}>
              Ce colis est au statut <b>{p.status}</b> et n&apos;est pas
              disponible au retrait à {AG[agency].name}.
            </p>
          ) : (
            <>
              <div className="note" style={{ marginTop: 14 }}>
                <b>{p.recipient}</b> · {p.recipientTel} · {catLabel(p)} ·{" "}
                {kg(p.weight)} · {p.zone}
              </div>
              <div className="g2" style={{ marginTop: 14 }}>
                <div className="field">
                  <label htmlFor="r-cni">N° de pièce d&apos;identité</label>
                  <input
                    className="in mono"
                    id="r-cni"
                    value={cni}
                    onChange={(e) => setCni(e.target.value)}
                    placeholder="CNI, passeport"
                  />
                </div>
                <div className="field">
                  <label htmlFor="r-otp">Code reçu par SMS</label>
                  <input
                    className="in mono"
                    id="r-otp"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                  />
                </div>
              </div>
              <label className="check" style={{ marginTop: 14 }}>
                <input
                  type="checkbox"
                  checked={ok}
                  onChange={(e) => setOk(e.target.checked)}
                />
                <span>
                  Colis vérifié : étiquette, état et contenu conformes
                </span>
              </label>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Code de remise : <b className="mono">{p.otp}</b>
              </p>
              <div
                className="row"
                style={{ justifyContent: "space-between", marginTop: 16 }}
              >
                <span style={{ fontSize: 13, color: "var(--bad)" }}>{err}</span>
                <button className="btn btn-accent" onClick={give}>
                  Remettre le colis
                </button>
              </div>
            </>
          )
        ) : rid ? (
          <p className="note" style={{ marginTop: 14 }}>
            Aucun colis {rid}.
          </p>
        ) : null}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>En attente de retrait</h3>
        {waiting.length ? (
          <div className="stack" style={{ gap: 8 }}>
            {waiting.map((w) => (
              <button
                key={w.id}
                className="chip"
                style={{ textAlign: "left" }}
                onClick={() => pick(w.id)}
              >
                {w.id} · {w.recipient}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">Aucun colis en attente à {AG[agency].name}.</p>
        )}
      </div>
    </div>
  );
}
