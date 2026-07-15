export interface GeoResult {
  lat: number;
  lng: number;
}

// Free OpenStreetMap geocoder — no API key. Usage policy asks for a descriptive
// User-Agent and <=1 req/sec (the backfill script paces itself; single ad-hoc
// calls are fine).
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HomeScout/1.0 (personal home-search tool)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { lat?: string; lon?: string };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
