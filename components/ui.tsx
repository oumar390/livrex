import type { CSSProperties, ReactNode } from "react";
import { TONE } from "@/lib/data";
import type { Status } from "@/lib/types";

export function Pill({ s }: { s: Status | string }) {
  return <span className={`pill t-${TONE[s as Status] || "n"}`}>{s}</span>;
}

export function PageHead({
  eyebrow,
  title,
  lead,
  right,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="wrap page-h">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {right}
    </div>
  );
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: [K, string][];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, l]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  steps,
  current,
  prefix,
}: {
  steps: string[];
  current: number;
  prefix?: string;
}) {
  return (
    <div className="stepper" aria-label="Étapes">
      {steps.map((n, k) => (
        <div
          key={n}
          className={k < current ? "done" : k === current ? "cur" : ""}
          aria-current={k === current ? "step" : undefined}
        >
          <span>{prefix ? `${prefix} ${k + 1}` : k + 1}</span>
          {n}
        </div>
      ))}
    </div>
  );
}

/** Tuile de choix (bouton radio stylé) */
export function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  sub,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <label className="choice">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <b>{title}</b>
      {sub && <small>{sub}</small>}
    </label>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span className="muted">{label}</span>
      <b>{children}</b>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  style,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
