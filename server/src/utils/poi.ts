const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

const CATEGORY_QUERIES: Record<POICategory, string> = {
  food: 'node[amenity~"^(restaurant|cafe|fast_food|pub|bar)$"]({{bbox}});',
  fuel: 'node[amenity="fuel"]({{bbox}});node[shop="convenience"]({{bbox}});',
  camping: 'node[tourism~"^(camp_site|caravan_site|picnic_site)$"]({{bbox}});',
  viewpoint: 'node[tourism="viewpoint"]({{bbox}});node[natural="peak"]({{bbox}});',
  attraction: 'node[tourism~"^(attraction|zoo|aquarium|theme_park)$"]({{bbox}});',
  museum: 'node[tourism="museum"]({{bbox}});',
  park: 'node[leisure~"^(park|nature_reserve|garden)$"]({{bbox}});node[boundary="national_park"]({{bbox}});',
  historical: 'node[historic]({{bbox}});',
  entertainment: 'node[amenity~"^(cinema|theatre|casino|nightclub)$"]({{bbox}});',
  shopping: 'node[shop~"^(mall|marketplace|department_store)$"]({{bbox}});',
  beach: 'node[natural="beach"]({{bbox}});node[leisure="beach_resort"]({{bbox}});',
  lodging: 'node[tourism~"^(hotel|motel|hostel|guest_house|chalet)$"]({{bbox}});',
  parking: 'node[amenity="parking"]({{bbox}});',
  restroom: 'node[amenity~"^(toilets|restroom)$"]({{bbox}});',
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

  for (const cat of cats) {
    const query = CATEGORY_QUERIES[cat];
    if (!query) continue;

    const overpassQuery = `[out:json][timeout:10];(${query.replace(/{{bbox}}/g, bbox)});out center 50;`;
    const encodedQuery = encodeURIComponent(overpassQuery);

    try {
      const response = await fetch(`${OVERPASS_URL}?data=${encodedQuery}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) continue;

      const data = (await response.json()) as OverpassResponse;
      const items: POI[] = [];

      for (const el of data.elements) {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (lat == null || lon == null || !el.tags) continue;

        const name = el.tags.name || el.tags['addr:street'] || `${cat}_${el.id}`;
        const tags = el.tags;

        let minDist = Infinity;
        for (const rp of routePoints) {
          const d = haversineKm(lat, lon, rp.latitude, rp.longitude);
          if (d < minDist) minDist = d;
        }

        if (minDist > 10) continue;

        const subType = tags.amenity || tags.tourism || tags.leisure || tags.shop || tags.boundary || tags.historic || 'poi';

        items.push({
          id: `${el.type}_${el.id}`,
          name,
          latitude: lat,
          longitude: lon,
          category: cat,
          type: subType,
          distanceKm: Math.round(minDist * 100) / 100,
          website: tags.website || tags.url,
          phone: tags.phone,
          openingHours: tags.opening_hours,
        });
      }

      items.sort((a, b) => a.distanceKm - b.distanceKm);

      if (items.length > 0) {
        result[cat] = items.slice(0, 30);
      }
    } catch {
      continue;
    }
  }

  return result;
}
