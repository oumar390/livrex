"use client";

import { useEffect, useState } from "react";
import { AG, NET } from "@/lib/data";
import { agencyPts } from "@/lib/domain";
import { lerp, vehPos } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { MapPoint } from "@/lib/types";
import MapCanvas from "./MapCanvas";

/** Carte animée du bandeau : flux schématiques sur le réseau et véhicules réels en route */
export default function HeroMap() {
  const { S } = useStore();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setT((x) => x + 0.05), 60);
    return () => clearInterval(id);
  }, []);
  const movers: MapPoint[] = NET.map(([a, b], i) => {
    const k = (((t * (0.035 + (i % 4) * 0.008) + i * 0.13) % 1) + 1) % 1;
    const tt = i % 2 ? k : 1 - k;
    return {
      ...lerp(AG[a], AG[b], tt),
      kind: i % 3 === 0 ? "cour" : "veh",
    } as MapPoint;
  });
  const real: MapPoint[] = S.vehicles
    .filter((v) => v.trip)
    .map((v) => ({ ...vehPos(v), kind: "veh", label: v.id }));
  return (
    <MapCanvas
      scene={{
        mode: "sn",
        dark: true,
        points: [...agencyPts(), ...movers, ...real],
        routes: S.vehicles
          .filter((v) => v.trip)
          .map((v) => [AG[v.trip!.from], AG[v.trip!.to]]),
      }}
    />
  );
}
