import type { LatLng } from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough urban ETA: 20 km/h average + 5 min prep. */
export function etaMinutes(km: number): number {
  return Math.round((km / 20) * 60) + 5;
}

export function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "2026-10-26T15:30" → "26 Oct, 3:30 pm" */
export function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const PRESET_LOCATIONS: LatLng[] = [
  { lat: 19.2183, lng: 72.9781, label: "Thane West" },
  { lat: 19.2967, lng: 73.0631, label: "Bhiwandi" },
  { lat: 19.2403, lng: 73.1305, label: "Kalyan" },
];
