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

function getBbox(lat: number, lng: number, radiusKm: number): string {
  const degPerKm = 1 / 111;
  const d = radiusKm * degPerKm;
  return `${lng - d},${lat - d},${lng + d},${lat + d}`;
}

async function fetchPhotonCategory(
  lat: number, lng: number, radiusKm: number,
  category: string, searchTerm: string
): Promise<POI[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchTerm)}&lat=${lat}&lon=${lng}&limit=30`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const features = data?.features || [];
    const result: POI[] = [];
    for (const f of features) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const plng = coords[0];
      const plat = coords[1];
      const dist = Math.round(haversineKm(lat, lng, plat, plng) * 100) / 100;
      if (dist > radiusKm) continue;
      const name = f.properties?.name || f.properties?.osm_value || searchTerm;
      result.push({
        id: `photon_${f.properties?.osm_id || f.properties?.osm_type + '_' + f.properties?.osm_id || `${plat}_${plng}`}`,
        name: typeof name === 'string' ? name : String(name),
        latitude: plat,
        longitude: plng,
        category,
        type: f.properties?.osm_value || f.properties?.osm_key || 'unknown',
        distanceKm: dist,
        description: f.properties?.street ? (`${f.properties.street}, ${f.properties?.city || ''}`.replace(/,\s*$/, '')) : '',
        thumbnail: null,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export async function findPOIs(
  routePoints: { latitude: number; longitude: number }[],
  categories?: POICategory[],
  searchRadiusKm?: number
): Promise<Record<string, POI[]>> {
  if (routePoints.length === 0) return {};

  const cats = categories || ['food', 'fuel', 'lodging', 'attraction'];
  const searchRadius = searchRadiusKm || 5;
  const centerLat = routePoints.reduce((s, p) => s + p.latitude, 0) / routePoints.length;
  const centerLng = routePoints.reduce((s, p) => s + p.longitude, 0) / routePoints.length;
  const result: Record<string, POI[]> = {};

  // Run categories in parallel (Photon has generous rate limits)
  const results = await Promise.all(cats.map(async (cat) => {
    const searchTerm = CATEGORY_SEARCH_TERMS[cat];
    if (!searchTerm) return { cat, items: [] as POI[] };
    const items = await fetchPhotonCategory(centerLat, centerLng, searchRadius, cat, searchTerm);
    return { cat, items };
  }));

  for (const { cat, items } of results) {
    if (items.length > 0) {
      items.sort((a, b) => a.distanceKm - b.distanceKm);
      result[cat] = items.slice(0, 20);
    }
  }

  return result;
}
