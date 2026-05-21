const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export interface POI {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  type: string;
  distanceKm: number;
  website?: string;
  phone?: string;
  openingHours?: string;
  rating?: number;
}

export type POICategory = 'food' | 'fuel' | 'camping' | 'viewpoint' | 'attraction' | 'museum' | 'park' | 'historical' | 'entertainment' | 'shopping' | 'beach' | 'lodging' | 'parking' | 'restroom';

// Map each category to one or more Nominatim search terms
const CATEGORY_SEARCH_TERMS: Record<POICategory, string[]> = {
  food: ['restaurant', 'cafe', 'fast food', 'pub'],
  fuel: ['gas station', 'convenience store'],
  camping: ['camp site', 'picnic site'],
  viewpoint: ['scenic viewpoint', 'lookout'],
  attraction: ['tourist attraction', 'zoo', 'aquarium', 'theme park'],
  museum: ['museum'],
  park: ['park', 'national park', 'botanical garden'],
  historical: ['historic site', 'historic building', 'monument'],
  entertainment: ['cinema', 'theatre', 'casino', 'night club'],
  shopping: ['shopping mall', 'market'],
  beach: ['beach'],
  lodging: ['hotel', 'motel', 'hostel', 'guest house'],
  parking: ['parking'],
  restroom: ['public toilet', 'restroom'],
};

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

  const fetchCategory = async (cat: POICategory): Promise<void> => {
    const searchTerms = CATEGORY_SEARCH_TERMS[cat];
    if (!searchTerms || searchTerms.length === 0) return;

    const centerLat = routePoints.reduce((s, p) => s + p.latitude, 0) / routePoints.length;
    const centerLng = routePoints.reduce((s, p) => s + p.longitude, 0) / routePoints.length;
    // Use first search term that returns results
    for (const term of searchTerms) {
      try {
        const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(term)}&format=json&limit=20&bounded=1&viewbox=${bbox.split(',')[1]},${bbox.split(',')[0]},${bbox.split(',')[3]},${bbox.split(',')[2]}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'roadtrip-app/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) continue;
        const data = await response.json() as any[];
        if (!data || data.length === 0) continue;

        const items: POI[] = [];
        for (const el of data) {
          const lat = parseFloat(el.lat);
          const lon = parseFloat(el.lon);
          if (isNaN(lat) || isNaN(lon)) continue;

          let minDist = Infinity;
          for (const rp of routePoints) {
            const d = haversineKm(lat, lon, rp.latitude, rp.longitude);
            if (d < minDist) minDist = d;
          }
          if (minDist > 10) continue;

          const subType = el.type || el.category || 'poi';
          items.push({
            id: `nom_${el.osm_type || 'node'}_${el.osm_id || Math.random().toString(36).slice(2)}`,
            name: el.display_name?.split(',')[0]?.trim() || el.name || term,
            latitude: lat,
            longitude: lon,
            category: cat,
            type: subType,
            distanceKm: Math.round(minDist * 100) / 100,
          });
        }
        items.sort((a, b) => a.distanceKm - b.distanceKm);
        if (items.length > 0) {
          result[cat] = items.slice(0, 20);
        }
        break; // Found results for this category
      } catch {
        continue; // Try next search term
      }
    }
  };

  await Promise.allSettled(cats.map(fetchCategory));

  return result;
}
