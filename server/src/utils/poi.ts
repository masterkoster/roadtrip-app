export interface POI {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  type: string;
  distanceKm: number;
  thumbnail?: string | null;
  description?: string;
  pageId?: number;
  website?: string;
  phone?: string;
  openingHours?: string;
  rating?: number;
}

export type POICategory = 'food' | 'fuel' | 'camping' | 'viewpoint' | 'attraction' | 'museum' | 'park' | 'historical' | 'entertainment' | 'shopping' | 'beach' | 'lodging' | 'parking' | 'restroom';

const CATEGORY_LABELS: Record<POICategory, string> = {
  food: 'Food & Drink',
  fuel: 'Fuel & Convenience',
  camping: 'Camping & Picnic',
  viewpoint: 'Scenic Lookouts',
  attraction: 'Attractions',
  museum: 'Museums',
  park: 'Parks & Gardens',
  historical: 'Historical Sites',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  beach: 'Beaches',
  lodging: 'Hotels & Lodging',
  parking: 'Parking',
  restroom: 'Restrooms',
};

const CATEGORY_ICONS: Record<POICategory, string> = {
  food: '🍽️',
  fuel: '⛽',
  camping: '🏕️',
  viewpoint: '🏔️',
  attraction: '🎯',
  museum: '🏛️',
  park: '🌳',
  historical: '🏰',
  entertainment: '🎭',
  shopping: '🛍️',
  beach: '🏖️',
  lodging: '🏨',
  parking: '🅿️',
  restroom: '🚻',
};

export function getCategoryLabel(cat: POICategory): string {
  return CATEGORY_LABELS[cat];
}

export function getCategoryIcon(cat: POICategory): string {
  return CATEGORY_ICONS[cat];
}

export const ALL_CATEGORIES: POICategory[] = [
  'food', 'fuel', 'camping', 'viewpoint', 'attraction', 'museum', 'park',
  'historical', 'entertainment', 'shopping', 'beach', 'lodging', 'parking', 'restroom',
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dlat = (lat2 - lat1) * Math.PI / 180;
  const dlon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBbox(points: { latitude: number; longitude: number }[]): string {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  const pad = 0.05;
  return `${minLat - pad},${minLng - pad},${maxLat + pad},${maxLng + pad}`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export async function findPOIs(
  routePoints: { latitude: number; longitude: number }[],
  categories?: POICategory[]
): Promise<Record<string, POI[]>> {
  if (routePoints.length === 0) return {};

  const cats = categories || ALL_CATEGORIES;
  const bbox = getBbox(routePoints);
  const result: Record<string, POI[]> = {};

  // Use Wikipedia Geosearch around the centroid (works reliably)
  const centerLat = routePoints.reduce((s, p) => s + p.latitude, 0) / routePoints.length;
  const centerLng = routePoints.reduce((s, p) => s + p.longitude, 0) / routePoints.length;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${centerLat}|${centerLng}&gsradius=10000&gslimit=30&format=json&prop=pageimages|description|extracts&pithumbsize=300&exintro=1&exlimit=30`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json() as any;
      const pages = data?.query?.geosearch || [];
      const items: POI[] = [];
      for (const p of pages) {
        let minDist = Infinity;
        for (const rp of routePoints) {
          const d = haversineKm(p.lat, p.lon, rp.latitude, rp.longitude);
          if (d < minDist) minDist = d;
        }
        if (minDist > 10) continue;
        const thumb = p.thumbnail?.source || null;
        items.push({
          id: `wiki_${p.pageid}`,
          name: p.title,
          latitude: p.lat,
          longitude: p.lon,
          category: 'attraction',
          type: 'wikipedia',
          distanceKm: Math.round(minDist * 100) / 100,
          thumbnail: thumb ? (thumb.startsWith('http') ? thumb : `https:${thumb}`) : null,
          description: p.description || p.extract?.substring(0, 200) || '',
          pageId: p.pageid,
        });
      }
      items.sort((a, b) => a.distanceKm - b.distanceKm);
      if (items.length > 0) {
        result['attraction'] = items.slice(0, 30);
      }
    }
  } catch { /* no wiki results */ }

  return result;
}
