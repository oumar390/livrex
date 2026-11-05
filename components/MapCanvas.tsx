"use client";

import { useEffect, useRef } from "react";
import { AG, DK, GM, NET, Q, SN } from "@/lib/data";
import type { MapScene } from "@/lib/types";

/** Palette fixe pour la carte du bandeau d'accueil (toujours sombre) */
const HERO: Record<string, string> = {
  "--map-bg": "#08263F",
  "--map-land": "#0F3A5C",
  "--map-foreign": "#0B2E4C",
  "--line": "#1C4767",
  "--muted": "#9DB6CB",
  "--ink": "#ECF3F8",
  "--accent": "#2CC9B6",
  "--blue": "#7FB2DA",
  "--surface": "#08263F",
  "--bad": "#F2716A",
};

function draw(c: HTMLCanvasElement, sc: MapScene) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = c.clientWidth,
    h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const x = c.getContext("2d");
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement);
  const tk = (n: string) =>
    sc.dark && HERO[n] ? HERO[n] : cs.getPropertyValue(n).trim();
  const B =
    sc.mode === "dkr"
      ? { lo0: -17.56, lo1: -17.2, la0: 14.635, la1: 14.82 }
      : { lo0: -17.75, lo1: -11.25, la0: 12.15, la1: 16.9 };
  const kx = Math.cos((((B.la0 + B.la1) / 2) * Math.PI) / 180),
    gw = (B.lo1 - B.lo0) * kx,
    gh = B.la1 - B.la0;
  const s = Math.min((w - 20) / gw, (h - 20) / gh),
    ox = (w - gw * s) / 2,
    oy = (h - gh * s) / 2;
  const pr = (lat: number, lon: number): [number, number] => [
    ox + (lon - B.lo0) * kx * s,
    oy + (B.la1 - lat) * s,
  ];

  x.fillStyle = tk("--map-bg");
  x.fillRect(0, 0, w, h);
  // Quadrillage
  x.strokeStyle = tk("--line");
  x.globalAlpha = 0.5;
  x.lineWidth = 1;
  const step = sc.mode === "dkr" ? 0.05 : 1;
  for (let lo = Math.ceil(B.lo0 / step) * step; lo < B.lo1; lo += step) {
    const [a] = pr(0, lo);
    x.beginPath();
    x.moveTo(a, 0);
    x.lineTo(a, h);
    x.stroke();
  }
  for (let la = Math.ceil(B.la0 / step) * step; la < B.la1; la += step) {
    const [, b] = pr(la, 0);
    x.beginPath();
    x.moveTo(0, b);
    x.lineTo(w, b);
    x.stroke();
  }
  x.globalAlpha = 1;

  const poly = (pts: [number, number][], fill: string, stroke: string) => {
    x.beginPath();
    pts.forEach(([lo, la], i) => {
      const [a, b] = pr(la, lo);
      if (i) x.lineTo(a, b);
      else x.moveTo(a, b);
    });
    x.closePath();
    x.fillStyle = fill;
    x.fill();
    x.strokeStyle = stroke;
    x.lineWidth = 1.2;
    x.stroke();
  };

  if (sc.mode === "dkr") {
    poly(DK, tk("--map-land"), tk("--line"));
    x.fillStyle = tk("--muted");
    x.font = '500 10px "IBM Plex Mono",monospace';
    Object.keys(Q).forEach((n) => {
      const [a, b] = pr(Q[n][0], Q[n][1]);
      x.globalAlpha = 0.55;
      x.fillRect(a - 1.5, b - 1.5, 3, 3);
      if (w > 360) x.fillText(n, a + 4, b + 3);
      x.globalAlpha = 1;
    });
  } else {
    poly(SN, tk("--map-land"), tk("--line"));
    poly(GM, tk("--map-foreign"), tk("--line"));
    const [ga, gb] = pr(13.45, -15.3);
    x.fillStyle = tk("--muted");
    x.font = 'italic 10px "IBM Plex Sans",sans-serif';
    if (w > 300) x.fillText("Gambie", ga, gb + 3);
    x.setLineDash([3, 4]);
    x.strokeStyle = tk("--muted");
    x.globalAlpha = 0.45;
    NET.forEach(([a, b]) => {
      const p1 = pr(AG[a].lat, AG[a].lon),
        p2 = pr(AG[b].lat, AG[b].lon);
      x.beginPath();
      x.moveTo(...p1);
      x.lineTo(...p2);
      x.stroke();
    });
    x.setLineDash([]);
    x.globalAlpha = 1;
  }

  (sc.routes || []).forEach(([a, b]) => {
    const p1 = pr(a.lat, a.lon),
      p2 = pr(b.lat, b.lon);
    x.strokeStyle = tk("--blue");
    x.lineWidth = 2.5;
    x.setLineDash([7, 5]);
    x.beginPath();
    x.moveTo(...p1);
    x.lineTo(...p2);
    x.stroke();
    x.setLineDash([]);
  });
  if (sc.trail && sc.trail.length > 1) {
    x.strokeStyle = tk("--accent");
    x.lineWidth = 3;
    x.beginPath();
    sc.trail.forEach((q, i) => {
      const [a, b] = pr(q.lat, q.lon);
      if (i) x.lineTo(a, b);
      else x.moveTo(a, b);
    });
    x.stroke();
  }

  x.font = '600 11px "IBM Plex Mono",monospace';
  (sc.points || []).forEach((pt) => {
    const [a, b] = pr(pt.lat, pt.lon);
    if (pt.kind === "agency") {
      x.fillStyle = tk("--ink");
      x.fillRect(a - 4, b - 4, 8, 8);
      if (pt.label && w > 280) x.fillText(pt.label, a + 7, b + 4);
    } else if (pt.kind === "veh" || pt.kind === "cour") {
      const col = pt.kind === "veh" ? tk("--accent") : tk("--blue");
      x.fillStyle = col;
      x.globalAlpha = 0.25;
      x.beginPath();
      x.arc(a, b, 13, 0, 7);
      x.fill();
      x.globalAlpha = 1;
      x.beginPath();
      x.arc(a, b, 6.5, 0, 7);
      x.fill();
      x.lineWidth = 2;
      x.strokeStyle = tk("--surface");
      x.stroke();
      if (pt.label) {
        x.fillStyle = tk("--ink");
        x.fillText(pt.label, a + 11, b - 8);
      }
    } else if (pt.kind === "pick") {
      x.strokeStyle = tk("--blue");
      x.lineWidth = 2.5;
      x.beginPath();
      x.arc(a, b, 6, 0, 7);
      x.stroke();
      if (pt.label) {
        x.fillStyle = tk("--ink");
        x.fillText(pt.label, a + 9, b + 4);
      }
    } else if (pt.kind === "drop") {
      x.fillStyle = tk("--bad");
      x.beginPath();
      x.moveTo(a, b);
      x.arc(a, b - 12, 6, Math.PI * 0.8, Math.PI * 2.2);
      x.closePath();
      x.fill();
      x.fillStyle = tk("--surface");
      x.beginPath();
      x.arc(a, b - 12, 2.4, 0, 7);
      x.fill();
      if (pt.label) {
        x.fillStyle = tk("--ink");
        x.fillText(pt.label, a + 9, b - 8);
      }
    }
  });
}

/** Carte schématique (Sénégal ou Dakar), redessinée à chaque mise à jour de la scène */
export default function MapCanvas({
  scene,
  className = "",
}: {
  scene: MapScene;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    if (ref.current)
      try {
        draw(ref.current, scene);
      } catch {
        /* canvas indisponible */
      }
  });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const redraw = () => draw(c, sceneRef.current);
    const ro = new ResizeObserver(redraw);
    ro.observe(c);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", redraw);
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      ro.disconnect();
      mq.removeEventListener?.("change", redraw);
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={`map ${className}`}
      role="img"
      aria-label="Carte schématique"
    />
  );
}
