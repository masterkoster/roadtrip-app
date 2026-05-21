import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { findPOIs, ALL_CATEGORIES, getCategoryLabel, getCategoryIcon, type POICategory } from '../utils/poi';
import { getEnrichedLandmarks, filterLandmarksByBounds } from '../utils/landmarks';

const router = Router();

// ─── Foursquare nearby cache ───────────────────────────────────────
const nearbyCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 86_400_000; // 24 hours

function cacheKey(lat: number, lng: number, type: string, radiusKm: number): string {
  // Round to ~0.1° (~11km) grid to increase cache hits across nearby queries
  const rlat = Math.round(lat * 10) / 10;
  const rlng = Math.round(lng * 10) / 10;
  return `${rlat}_${rlng}_${type}_${radiusKm}`;
}

function getCached(key: string): any | null {
  const entry = nearbyCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  nearbyCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  nearbyCache.set(key, { data, ts: Date.now() });
}

const FOURSQUARE_KEY = process.env.FOURSQUARE_API_KEY || '';

// Category IDs per type
const FSQ_CATEGORIES: Record<string, string> = {
  hotel: '4bf58dd8d48988d1fa931735',
  restaurant: '4d4b7105d754a06374d81259',
  attraction: '4bf58dd8d48988d163941735,4bf58dd8d48988d181941735,4bf58dd8d48988d192941735',
  camping: '4bf58dd8d48988d1e8941735',
};

async function fetchFoursquareNearby(lat: number, lng: number, type: string, radiusKm: number): Promise<any[]> {
  if (!FOURSQUARE_KEY) return [];

  const cats = FSQ_CATEGORIES[type] || FSQ_CATEGORIES.hotel;
  const radiusM = Math.min(Math.round(radiusKm * 1000), 100000);

  // Pro fields are always available (free). Premium fields need billing credits.
  const proFields = ['name', 'fsq_place_id', 'distance', 'categories', 'location', 'latitude', 'longitude'];
  const premiumFields = ['tel', 'website', 'email', 'price', 'rating', 'description', 'photos'];

  // Try with Premium fields first (user may have credits)
  let fields = [...proFields, ...premiumFields].join(',');
  let url = `https://places-api.foursquare.com/places/search?ll=${lat},${lng}&radius=${radiusM}&fsq_category_ids=${cats}&limit=15&sort=DISTANCE&fields=${encodeURIComponent(fields)}`;

  let resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${FOURSQUARE_KEY}`,
      'X-Places-Api-Version': '2025-06-17',
    },
    signal: AbortSignal.timeout(7000),
  });

  // If Premium fields failed (no credits), retry with Pro-only
  if (resp.status === 429 || resp.status === 402 || resp.status === 403) {
    fields = proFields.join(',');
    url = `https://places-api.foursquare.com/places/search?ll=${lat},${lng}&radius=${radiusM}&fsq_category_ids=${cats}&limit=15&sort=DISTANCE&fields=${encodeURIComponent(fields)}`;
    resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FOURSQUARE_KEY}`,
        'X-Places-Api-Version': '2025-06-17',
      },
      signal: AbortSignal.timeout(7000),
    });
  }

  if (resp.status === 429) throw new Error('Foursquare rate limited');
  if (!resp.ok) return [];

  const data = await resp.json() as any;
  return data?.results || [];
}

function parseFoursquarePhoto(p: any): string | null {
  if (!p || !p.prefix || !p.suffix) return null;
  // Build a 300×300 photo URL
  return `${p.prefix}300x300${p.suffix}`;
}

// Public: get all landmarks (no auth needed)
router.get('/landmarks', async (_req: any, res: Response) => {
  try {
    const allLandmarks = await getEnrichedLandmarks();
    return res.json({ landmarks: allLandmarks, total: allLandmarks.length });
  } catch (err: any) {
    console.error('Public landmarks error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch landmarks' });
  }
});

// Public: get nearby POIs for a location (hotels, restaurants, attractions, camping)
router.get('/nearby', async (req: any, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });
    const radiusKm = Math.min(parseFloat(req.query.radiusKm as string) || 20, 50);
    const type = (req.query.type as string) || 'hotel';

    // Check cache first
    const ckey = cacheKey(lat, lng, type, radiusKm);
    const cached = getCached(ckey);
    if (cached) return res.json({ items: cached, type, cached: true });

    // Fetch from Foursquare
    let items: any[] = [];
    try {
      const results = await fetchFoursquareNearby(lat, lng, type, radiusKm);
      items = results.map((p: any) => ({
        name: p.name,
        fsqPlaceId: p.fsq_place_id,
        distance: Math.round((p.distance || 0) / 100) / 10, // meters → km
        lat: p.latitude ?? lat,
        lng: p.longitude ?? lng,
        type,
        address: p.location?.formatted_address || null,
        category: p.categories?.[0]?.name || null,
        categoryIcon: p.categories?.[0]?.icon
          ? `${p.categories[0].icon.prefix}32${p.categories[0].icon.suffix}`
          : null,
        // Premium fields (needs billing credits):
        price: p.price ?? null,
        rating: p.rating ?? null,
        photo: p.photos?.length ? parseFoursquarePhoto(p.photos[0]) : null,
        website: p.website || null,
        phone: p.tel || null,
      }));
    } catch (err: any) {
      console.warn('Foursquare nearby fetch failed:', err.message);
    }

    // Fallback to Photon if Foursquare returned nothing
    if (items.length === 0) {
      const typeTerms: Record<string, string[]> = {
        hotel: ['hotel', 'lodging', 'motel'],
        restaurant: ['restaurant', 'food', 'cafe'],
        attraction: ['tourist attraction', 'museum', 'landmark', 'park', 'monument'],
        camping: ['campground', 'camping', 'rv park'],
      };
      const terms = typeTerms[type] || typeTerms.hotel;
      const seen = new Map<string, any>();
      for (const term of terms) {
        try {
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&limit=8`;
          const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!resp.ok) continue;
          const data = await resp.json() as any;
          for (const f of (data?.features || [])) {
            const coords = f.geometry?.coordinates;
            if (!coords) continue;
            const plng = coords[0], plat = coords[1];
            const name = f.properties?.name;
            if (!name) continue;
            const key = `${plat.toFixed(4)}_${plng.toFixed(4)}`;
            if (seen.has(key)) continue;
            const dlat = (plat - lat) * Math.PI / 180;
            const dlng = (plng - lng) * Math.PI / 180;
            const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(plat * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
            const dist = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
            if (dist > radiusKm) continue;
            seen.set(key, { name, distance: dist, lat: plat, lng: plng, type: term });
          }
        } catch { /* skip */ }
      }
      items = Array.from(seen.values()).sort((a: any, b: any) => a.distance - b.distance).slice(0, 10);
    }

    // Cache and return
    setCache(ckey, items);
    return res.json({ items, type, cached: false });
  } catch (err: any) {
    console.error('Nearby error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch nearby places' });
  }
});

// Get POI suggestions along a trip's route
router.get('/:tripId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // If viewport bounds provided, use those instead of full route
    const south = parseFloat(req.query.south as string);
    const west = parseFloat(req.query.west as string);
    const north = parseFloat(req.query.north as string);
    const east = parseFloat(req.query.east as string);

    let routePoints: { latitude: number; longitude: number }[];

    if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
      // Use viewport center with search radius covering the diagonal
      const centerLat = (south + north) / 2;
      const centerLng = (west + east) / 2;
      // Approx degrees → km at this latitude
      const dlat = north - south;
      const dlng = east - west;
      const radiusKm = Math.ceil(Math.max(dlat, dlng) * 111 / 2);
      // Build bbox from center with generous padding
      const pad = Math.max(dlat, dlng, 0.5);
      routePoints = [
        { latitude: centerLat, longitude: centerLng },
        { latitude: centerLat - pad, longitude: centerLng - pad },
        { latitude: centerLat + pad, longitude: centerLng + pad },
        { latitude: centerLat - pad, longitude: centerLng + pad },
        { latitude: centerLat + pad, longitude: centerLng - pad },
      ];
    } else {
      const trackPts = await db.select()
        .from(schema.trackPoints)
        .where(eq(schema.trackPoints.tripId, tripId))
        .orderBy(schema.trackPoints.timestamp);

      routePoints = trackPts;
      if (routePoints.length < 2) {
        const wps = await db.select()
          .from(schema.waypoints)
          .where(eq(schema.waypoints.tripId, tripId))
          .orderBy(schema.waypoints.orderIndex);
        if (wps.length >= 2) {
          routePoints = wps;
        } else {
          return res.json({ pois: {}, categories: [] });
        }
      }
    }

    const categoriesParam = req.query.categories as string;
    const categories = categoriesParam
      ? (categoriesParam.split(',').filter(c => ALL_CATEGORIES.includes(c as POICategory)) as POICategory[])
      : undefined;

    const radiusMi = parseFloat(req.query.radius as string);
    const searchRadiusKm = !isNaN(radiusMi) && radiusMi > 0 ? Math.round(radiusMi * 1.609) : 5;

    const pois = await findPOIs(routePoints, categories, searchRadiusKm);

    const categoryMeta = Object.keys(pois).map(cat => ({
      id: cat,
      label: getCategoryLabel(cat as POICategory),
      icon: getCategoryIcon(cat as POICategory),
      count: pois[cat].length,
    }));

    return res.json({ pois, categories: categoryMeta });
  } catch (err: any) {
    console.error('POI error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch POIs' });
  }
});

// Get famous US landmarks visible in the current viewport
router.get('/:tripId/landmarks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const south = parseFloat(req.query.south as string);
    const west = parseFloat(req.query.west as string);
    const north = parseFloat(req.query.north as string);
    const east = parseFloat(req.query.east as string);

    const allLandmarks = await getEnrichedLandmarks();
    if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
      const visible = filterLandmarksByBounds(allLandmarks, south, west, north, east);
      return res.json({ landmarks: visible, total: visible.length });
    }
    return res.json({ landmarks: allLandmarks, total: allLandmarks.length });
  } catch (err: any) {
    console.error('Landmarks error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch landmarks' });
  }
});

export default router;
