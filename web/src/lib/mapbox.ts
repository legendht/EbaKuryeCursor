export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/** Straight-line distance with 1.35x road factor — used as fallback when Mapbox fails */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
}

// Istanbul bbox [minLng, minLat, maxLng, maxLat]
export const ISTANBUL_BBOX = '28.0,40.8,29.5,41.4';
export const ISTANBUL_CENTER: [number, number] = [28.9784, 41.0082];

export interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  text: string;
}

export async function geocodeAddress(query: string): Promise<GeocodingFeature[]> {
  if (!query || query.length < 3) return [];

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('country', 'tr');
  url.searchParams.set('bbox', ISTANBUL_BBOX);
  url.searchParams.set('language', 'tr');
  url.searchParams.set('limit', '5');
  url.searchParams.set('types', 'address,place,neighborhood,locality,poi');

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return data.features || [];
}

export async function getRouteDistance(
  from: [number, number], // [lng, lat]
  to: [number, number]
): Promise<number> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Route calculation failed');
  const data = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error('No route found');

  return route.distance / 1000; // meters to km
}

