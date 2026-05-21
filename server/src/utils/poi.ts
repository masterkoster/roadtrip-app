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

const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  food: 'restaurant',
  fuel: 'gas station',
  lodging: 'hotel',
  attraction: 'tourist attraction',
  museum: 'museum',
  park: 'park',
  historical: 'historic site',
  shopping: 'shopping mall',
  camping: 'campground',
  viewpoint: 'scenic overlook',
  entertainment: 'cinema',
  beach: 'beach',
  parking: 'parking',
  restroom: 'restroom',
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dlat = (lat2 - lat1) * Math.PI / 180;
  const dlon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getViewbox(lat: number, lng: number, radiusKm: number): string {
  const degPerKm = 1 / 111;
  const d = radiusKm * degPerKm;
  return `${lng - d},${lat + d},${lng + d},${lat - d}`;
}

async function fetchNominatimCategory(
  lat: number, lng: number, radiusKm: number,
  category: string, searchTerm: string
): Promise<POI[]> {
  const viewbox = getViewbox(lat, lng, radiusKm);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerm)}&format=json&limit=20&viewbox=${viewbox}&bounded=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'roadtrip-app/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any[];
    return data.map((el: any) => {
      const plat = parseFloat(el.lat);
      const plng = parseFloat(el.lon);
      if (isNaN(plat) || isNaN(plng)) return null;
      const dist = Math.round(haversineKm(lat, lng, plat, plng) * 100) / 100;
      return {
        id: `nom_${el.osm_id || `${el.lat}_${el.lon}`}`,
        name: el.display_name?.split(',')[0]?.trim() || searchTerm,
        latitude: plat,
        longitude: plng,
        category,
        type: el.type || 'unknown',
        distanceKm: dist,
        description: el.display_name?.split(',').slice(1, 4).join(',').trim() || '',
        thumbnail: null,
      };
    }).filter(Boolean) as POI[];
  } catch {
    return [];
  }
}

export async function findPOIs(
  routePoints: { latitude: number; longitude: number }[],
  categories?: POICategory[]
): Promise<Record<string, POI[]>> {
  if (routePoints.length === 0) return {};

  const cats = categories || ['food', 'fuel', 'lodging', 'attraction'];
  const centerLat = routePoints.reduce((s, p) => s + p.latitude, 0) / routePoints.length;
  const centerLng = routePoints.reduce((s, p) => s + p.longitude, 0) / routePoints.length;
  const result: Record<string, POI[]> = {};

  // Run all category searches in parallel with staggered starts to avoid rate limiting
  const results = await Promise.all(cats.map(async (cat, i) => {
    const searchTerm = CATEGORY_SEARCH_TERMS[cat];
    if (!searchTerm) return { cat, items: [] as POI[] };
    // Stagger starts: 400ms between each to stay under 1 req/s
    if (i > 0) await new Promise(r => setTimeout(r, 400 * i));
    const items = await fetchNominatimCategory(centerLat, centerLng, 5, cat, searchTerm);
    return { cat, items };
  }));

  for (const { cat, items } of results) {
    if (items.length > 0) {
      items.sort((a, b) => a.distanceKm - b.distanceKm);
      result[cat] = items.slice(0, 15);
    }
  }

  return result;
}
