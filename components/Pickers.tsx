"use client";

import {
  CONS,
  CONS_CODES,
  FRAGILE,
  kgTxt,
  MODE_CODES,
  modeRange,
  MODES,
} from "@/lib/data";
import { allowedModes, modeForWeight } from "@/lib/domain";
import type { Cons, Mode, Tarifs } from "@/lib/types";
import { Choice } from "./ui";

/** Catégorie du colis : conservation + manipulation, deux choix indépendants */
export function CategoryPicker({
  name,
  cons,
  fragile,
  onChange,
  compact,
}: {
  name: string;
  cons: Cons | "";
  fragile: boolean;
  onChange: (cons: Cons, fragile: boolean) => void;
  compact?: boolean;
}) {
  const sur = (s: number) => (s ? " · +" + Math.round(s * 100) + " %" : "");
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div>
        <div className="lab" style={{ marginBottom: 8 }}>
          Conservation
        </div>
        <div
          className="choices"
          style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}
        >
          {CONS_CODES.map((k) => (
            <Choice
              key={k}
              name={name + "-cons"}
              value={k}
              checked={cons === k}
              onChange={() => onChange(k, fragile)}
              title={CONS[k].label}
              sub={
                compact
                  ? sur(CONS[k].sur).replace(" · ", "") || "Ambiant"
                  : CONS[k].hint + sur(CONS[k].sur)
              }
            />
          ))}
        </div>
      </div>
      <div>
        <div className="lab" style={{ marginBottom: 8 }}>
          Manipulation
        </div>
        <div
          className="choices"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
        >
          <Choice
            name={name + "-frag"}
            value="non"
            checked={!fragile}
            onChange={() => onChange((cons || "SEC") as Cons, false)}
            title="Non fragile"
            sub={compact ? undefined : "Manipulation standard"}
          />
          <Choice
            name={name + "-frag"}
            value="oui"
            checked={fragile}
            onChange={() => onChange((cons || "SEC") as Cons, true)}
            title="Fragile"
            sub={
              compact
                ? sur(FRAGILE.sur).replace(" · ", "")
                : FRAGILE.hint + sur(FRAGILE.sur)
            }
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Type de transport selon le poids. Le type proposé est le plus petit qui convient ;
 * on peut en choisir un plus grand, jamais un type dont le seuil est dépassé.
 */
export function ModePicker({
  t,
  weight,
  mode,
  onChange,
}: {
  t: Tarifs;
  weight: number;
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const ok = allowedModes(t, weight);
  const best = modeForWeight(t, weight);
  return (
    <div className="modes">
      {MODE_CODES.map((m) => {
        const [lo, hi] = modeRange(t, m);
        const dis = !ok.includes(m);
        return (
          <label key={m} className={`choice mode${dis ? " off" : ""}`}>
            <input
              type="radio"
              name="mode"
              value={m}
              checked={mode === m}
              disabled={dis}
              onChange={() => onChange(m)}
            />
            <span
              className="row"
              style={{ justifyContent: "space-between", gap: 6 }}
            >
              <b>{MODES[m].label}</b>
              {m === best && !dis && (
                <span className="pill t-g">Conseillé</span>
              )}
            </span>
            <small className="mono">
              {lo ? `${kgTxt(lo)} à ${kgTxt(hi)}` : `jusqu'à ${kgTxt(hi)}`}
            </small>
            <small>
              {MODES[m].vehicles} · {MODES[m].area}
            </small>
            {dis && (
              <small style={{ color: "var(--bad)" }}>
                Trop lourd pour ce transport
              </small>
            )}
          </label>
        );
      })}
    </div>
  );
}
