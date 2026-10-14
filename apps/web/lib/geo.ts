export type Coordinates = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371;

export function fromE6(latE6: number, lonE6: number): Coordinates {
  return { lat: latE6 / 1e6, lon: lonE6 / 1e6 };
}

/** Great-circle distance between two points using the haversine formula. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(6)} ${lat >= 0 ? "N" : "S"}`;
}

export function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(6)} ${lon >= 0 ? "E" : "W"}`;
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
