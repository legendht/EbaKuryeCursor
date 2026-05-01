const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

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
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`);
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

export { MAPBOX_TOKEN };
