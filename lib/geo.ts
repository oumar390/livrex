import { AG } from "./data";
import type { AgencyCode, LatLon, Vehicle } from "./types";

/** Distance à vol d'oiseau en km */
export const hav = (a: LatLon, b: LatLon) => {
  const R = 6371,
    r = (x: number) => (x * Math.PI) / 180;
  const dLa = r(b.lat - a.lat),
    dLo = r(b.lon - a.lon);
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Distance routière estimée entre deux agences */
export const roadKm = (a: AgencyCode, b: AgencyCode) =>
  Math.round(hav(AG[a], AG[b]) * 1.22);

export const lerp = (a: LatLon, b: LatLon, t: number): LatLon => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

export const vehPos = (v: Vehicle): LatLon =>
  v.trip ? lerp(AG[v.trip.from], AG[v.trip.to], v.trip.progress) : AG[v.agency];
