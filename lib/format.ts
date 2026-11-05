export const nf = (n: number) =>
  Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
export const fcfa = (n: number) => nf(n) + " FCFA";
export const pad = (n: number, l = 6) => String(n).padStart(l, "0");
export const kg = (n: number) => (+n || 0).toLocaleString("fr-FR") + " kg";
export const km1 = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export const tfmt = (t: number) =>
  new Date(t).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const hfmt = (t: number) =>
  new Date(t).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Date locale au format AAAA-MM-JJ */
export const dIso = (d: number | Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
export const dfmt = (s: string) =>
  new Date(s + "T12:00").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
export const durTxt = (m: number) =>
  `${Math.floor(m / 60)} h ${pad(m % 60, 2)}`;

export const otp = () => String(1000 + Math.floor(Math.random() * 9000));
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const hashN = (s: string) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const plural = (n: number, w: string, p = w + "s") => (n > 1 ? p : w);
