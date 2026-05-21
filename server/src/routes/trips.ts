import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { parseGpx } from '../utils/gpx';
import { matchToRoads, routeBetweenWaypoints } from '../utils/osrm';
import { findPOIs, ALL_CATEGORIES } from '../utils/poi';

// Fuel efficiency by vehicle type (km/L)
const FUEL_KM_L: Record<string, number> = {
  car: 10,
  rv: 4,
  motorcycle: 15,
  bike: 0,
};

const FUEL_PRICE_PER_L = parseFloat(process.env.FUEL_PRICE || '1.50');

function estimateFuelCost(distanceKm: number, vehicle: string): number {
  const kmPerL = FUEL_KM_L[vehicle] || FUEL_KM_L.car;
  if (kmPerL <= 0) return 0;
  return Math.round((distanceKm / kmPerL) * FUEL_PRICE_PER_L * 100) / 100;
}

function estimateAccommodationCost(nights: number): number {
  if (nights <= 0) return 0;
  const perNight = parseFloat(process.env.HOTEL_PRICE || '100');
  return Math.round(nights * perNight * 100) / 100;
}

const router = Router();

const toISO = (v: any) => v ? new Date(v).toISOString() : null;
const nowISO = () => new Date().toISOString();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userTrips = await db.select()
      .from(schema.trips)
      .where(eq(schema.trips.userId, req.userId!))
      .orderBy(desc(schema.trips.createdAt));
    return res.json(userTrips);
  } catch (err) {
    console.error('Get trips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const trackPoints = await db.select()
      .from(schema.trackPoints)
      .where(eq(schema.trackPoints.tripId, tripId))
      .orderBy(schema.trackPoints.timestamp);

    const waypointList = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    const photoList = await db.select()
      .from(schema.photos)
      .where(eq(schema.photos.tripId, tripId))
      .orderBy(desc(schema.photos.createdAt));

    const guideList = await db.select()
      .from(schema.guides)
      .where(eq(schema.guides.tripId, tripId))
      .orderBy(desc(schema.guides.createdAt));

    return res.json({ ...trip, trackPoints, waypoints: waypointList, photos: photoList, guides: guideList });
  } catch (err) {
    console.error('Get trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, startDate, endDate, vehicle } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const [trip] = await db.insert(schema.trips).values({
      userId: req.userId!,
      title,
      description,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      vehicle: vehicle ?? 'car',
    }).returning();

    return res.status(201).json(trip);
  } catch (err) {
    console.error('Create trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { title, description, startDate, endDate, isPublic, vehicle, maxDailyDrivingHours, maxDailyDistanceKm, restStopFrequencyHours } = req.body;
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const [updated] = await db.update(schema.trips)
      .set({
        title: title ?? trip.title,
        description: description ?? trip.description,
        startDate: startDate ? toISO(startDate) : trip.startDate,
        endDate: endDate ? toISO(endDate) : trip.endDate,
        isPublic: isPublic ?? trip.isPublic,
        vehicle: vehicle ?? trip.vehicle,
        maxDailyDrivingHours: maxDailyDrivingHours !== undefined ? maxDailyDrivingHours : trip.maxDailyDrivingHours,
        maxDailyDistanceKm: maxDailyDistanceKm !== undefined ? maxDailyDistanceKm : trip.maxDailyDistanceKm,
        restStopFrequencyHours: restStopFrequencyHours !== undefined ? restStopFrequencyHours : trip.restStopFrequencyHours,
        updatedAt: nowISO(),
      })
      .where(eq(schema.trips.id, tripId))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error('Update trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    await db.delete(schema.trips).where(eq(schema.trips.id, tripId));
    return res.json({ message: 'Trip deleted' });
  } catch (err) {
    console.error('Delete trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/gpx', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { gpxContent } = req.body;
    if (!gpxContent) return res.status(400).json({ error: 'GPX content is required' });

    const points = await parseGpx(gpxContent);
    if (points.length === 0) return res.status(400).json({ error: 'No track points found in GPX' });

    await db.delete(schema.trackPoints).where(eq(schema.trackPoints.tripId, tripId));

    const BATCH_SIZE = 500;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      await db.insert(schema.trackPoints).values(
        batch.map(p => ({
          tripId,
          latitude: p.latitude,
          longitude: p.longitude,
          elevation: p.elevation,
          timestamp: toISO(p.timestamp),
        }))
      );
    }

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dlat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dlon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += 6371 * c;
    }

    const firstTs = points[0]?.timestamp;
    const lastTs = points[points.length - 1]?.timestamp;
    const firstTime = firstTs ? new Date(firstTs).getTime() : null;
    const lastTime = lastTs ? new Date(lastTs).getTime() : null;
    const duration = firstTime && lastTime ? Math.round((lastTime - firstTime) / 1000) : null;

    await db.update(schema.trips)
      .set({
        distance: Math.round(totalDistance * 100) / 100,
        duration,
        startDate: toISO(firstTs) ?? trip.startDate,
        endDate: toISO(lastTs) ?? trip.endDate,
        updatedAt: nowISO(),
      })
      .where(eq(schema.trips.id, tripId));

    return res.json({ message: 'GPX imported', pointCount: points.length, distance: Math.round(totalDistance * 100) / 100 });
  } catch (err) {
    console.error('GPX import error:', err);
    return res.status(500).json({ error: 'Failed to parse GPX file' });
  }
});

router.post('/:id/track/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    return res.json({ message: 'Tracking started' });
  } catch (err) {
    console.error('Track start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/track/point', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { latitude, longitude, elevation, timestamp } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await db.insert(schema.trackPoints).values({
      tripId,
      latitude,
      longitude,
      elevation: elevation ?? null,
      timestamp: timestamp ? toISO(timestamp) : nowISO(),
    });

    return res.json({ message: 'Point recorded' });
  } catch (err) {
    console.error('Track point error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/track/stop', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const points = await db.select()
      .from(schema.trackPoints)
      .where(eq(schema.trackPoints.tripId, tripId))
      .orderBy(schema.trackPoints.timestamp);

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dlat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dlon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += 6371 * c;
    }

    const firstTs = points[0]?.timestamp;
    const lastTs = points[points.length - 1]?.timestamp;
    const firstTime = firstTs ? new Date(firstTs).getTime() : null;
    const lastTime = lastTs ? new Date(lastTs).getTime() : null;
    const duration = firstTime && lastTime ? Math.round((lastTime - firstTime) / 1000) : null;

    await db.update(schema.trips)
      .set({
        distance: Math.round(totalDistance * 100) / 100,
        duration,
        updatedAt: nowISO(),
      })
      .where(eq(schema.trips.id, tripId));

    return res.json({ message: 'Tracking stopped', pointCount: points.length, distance: Math.round(totalDistance * 100) / 100 });
  } catch (err) {
    console.error('Track stop error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Map-match existing track points to roads
router.post('/:id/match', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const points = await db.select()
      .from(schema.trackPoints)
      .where(eq(schema.trackPoints.tripId, tripId))
      .orderBy(schema.trackPoints.timestamp);

    if (points.length < 2) return res.status(400).json({ error: 'Need at least 2 track points' });

    const result = await matchToRoads(points);
    if (result.snapped.length < 2) return res.status(400).json({ error: 'Map matching failed' });

    // Replace track points with road-snapped points
    await db.delete(schema.trackPoints).where(eq(schema.trackPoints.tripId, tripId));

    const BATCH_SIZE = 500;
    for (let i = 0; i < result.snapped.length; i += BATCH_SIZE) {
      const batch = result.snapped.slice(i, i + BATCH_SIZE);
      await db.insert(schema.trackPoints).values(
        batch.map(p => ({
          tripId,
          latitude: p.latitude,
          longitude: p.longitude,
        }))
      );
    }

    // Recalculate distance
    let totalDistance = 0;
    for (let i = 1; i < result.snapped.length; i++) {
      const prev = result.snapped[i - 1];
      const curr = result.snapped[i];
      const dlat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dlon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += 6371 * c;
    }

    await db.update(schema.trips)
      .set({ distance: Math.round(totalDistance * 100) / 100, updatedAt: nowISO() })
      .where(eq(schema.trips.id, tripId));

    return res.json({
      message: 'Road snapped',
      originalPoints: result.originalCount,
      snappedPoints: result.snapped.length,
      confidence: result.confidence,
      distance: Math.round(totalDistance * 100) / 100,
    });
  } catch (err: any) {
    console.error('Match error:', err.message);
    return res.status(500).json({ error: `Map matching failed: ${err.message}` });
  }
});

// Estimate stops: calculate per-leg distance/time, suggest hotel stops based on params
router.post('/:id/estimate-stops', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const wps = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    if (wps.length < 2) return res.status(400).json({ error: 'Need at least 2 waypoints' });

    const maxDailyHours = trip.maxDailyDrivingHours || 8;
    const maxDailyKm = trip.maxDailyDistanceKm || 800;

    const coordPairs = wps.map(w => ({ latitude: w.latitude, longitude: w.longitude }));

    let routeResult: Awaited<ReturnType<typeof routeBetweenWaypoints>> = null;
    try {
      routeResult = await routeBetweenWaypoints(coordPairs);
    } catch { /* fallback below */ }

    interface LegInfo {
      fromId: number;
      fromName: string;
      toId: number;
      toName: string;
      distanceKm: number;
      durationHours: number;
      geometry: number[][];
    }

    const legs: LegInfo[] = [];

    if (routeResult?.legs) {
      for (let i = 0; i < routeResult.legs.length; i++) {
        legs.push({
          fromId: wps[i].id,
          fromName: wps[i].name,
          toId: wps[i + 1].id,
          toName: wps[i + 1].name,
          distanceKm: Math.round(routeResult.legs[i].distance / 1000 * 10) / 10,
          durationHours: Math.round(routeResult.legs[i].duration / 36) / 100,
          geometry: routeResult.legs[i].geometry?.coordinates || [],
        });
      }
    } else {
      for (let i = 1; i < wps.length; i++) {
        const dlat = (wps[i].latitude - wps[i - 1].latitude) * Math.PI / 180;
        const dlon = (wps[i].longitude - wps[i - 1].longitude) * Math.PI / 180;
        const a = Math.sin(dlat / 2) ** 2 + Math.cos(wps[i - 1].latitude * Math.PI / 180) * Math.cos(wps[i].latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        legs.push({
          fromId: wps[i - 1].id,
          fromName: wps[i - 1].name,
          toId: wps[i].id,
          toName: wps[i].name,
          distanceKm: Math.round(dist * 10) / 10,
          durationHours: Math.round(dist / 80 * 100) / 100,
          geometry: [],
        });
      }
    }

    // Build day-by-day itinerary (without hotel search — done async after)
    interface DayInfo {
      day: number;
      legs: LegInfo[];
      totalDistanceKm: number;
      totalDrivingHours: number;
      stops: { waypointId: number; name: string; durationMinutes: number }[];
      needsHotel: boolean;
      suggestedHotels: { name: string; latitude: number; longitude: number; distanceKm: number; type: string }[];
    }

    const days: DayInfo[] = [];
    let currentDay = 0;
    let dailyDrivingHours = 0;
    let dailyDistanceKm = 0;
    let dayLegs: LegInfo[] = [];
    let dayStopIds: Set<number> = new Set();

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const stopDurationHours = (wps[i].duration || 0) / 60;

      if (dailyDrivingHours + leg.durationHours > maxDailyHours || dailyDistanceKm + leg.distanceKm > maxDailyKm) {
        days.push({
          day: currentDay,
          legs: [...dayLegs],
          totalDistanceKm: Math.round(dailyDistanceKm * 10) / 10,
          totalDrivingHours: Math.round(dailyDrivingHours * 100) / 100,
          stops: wps.filter((_, idx) => dayStopIds.has(idx)).map(w => ({
            waypointId: w.id,
            name: w.name,
            durationMinutes: w.duration || 0,
          })),
          needsHotel: true,
          suggestedHotels: [],
        });

        currentDay++;
        dailyDrivingHours = 0;
        dailyDistanceKm = 0;
        dayLegs = [];
        dayStopIds = new Set();
      }

      dayLegs.push(leg);
      dayStopIds.add(i);
      dayStopIds.add(i + 1);
      dailyDrivingHours += leg.durationHours + stopDurationHours;
      dailyDistanceKm += leg.distanceKm;
    }

    // Final day
    if (dayLegs.length > 0) {
      days.push({
        day: currentDay,
        legs: [...dayLegs],
        totalDistanceKm: Math.round(dailyDistanceKm * 10) / 10,
        totalDrivingHours: Math.round(dailyDrivingHours * 100) / 100,
        stops: wps.filter((_, idx) => dayStopIds.has(idx)).map(w => ({
          waypointId: w.id,
          name: w.name,
          durationMinutes: w.duration || 0,
        })),
        needsHotel: false,
        suggestedHotels: [],
      });
    }

    // Hotel search — fire in parallel, non-blocking; if Overpass is slow, days just have empty hotels
    const hotelPromises = days
      .filter(d => d.needsHotel && d.legs.length > 0)
      .map(async (day) => {
        const lastLeg = day.legs[day.legs.length - 1];
        const lastWp = wps.find(w => w.id === lastLeg.toId);
        if (!lastWp) return;
        try {
          const poiResult = await findPOIs(
            [{ latitude: lastWp.latitude, longitude: lastWp.longitude }],
            ['lodging', 'camping']
          );
          const allAccom = [...(poiResult.lodging || []), ...(poiResult.camping || [])];
          day.suggestedHotels = allAccom.slice(0, 5).map(p => ({
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            distanceKm: Math.round(p.distanceKm * 10) / 10,
            type: p.type,
          }));
        } catch { /* no hotels */ }
      });
    await Promise.allSettled(hotelPromises);

    const totalDistance = routeResult?.totalDistance ? Math.round(routeResult.totalDistance / 1000 * 10) / 10 : legs.reduce((s, l) => s + l.distanceKm, 0);
    const totalDrivingHours = routeResult?.totalDuration ? Math.round(routeResult.totalDuration / 36) / 100 : legs.reduce((s, l) => s + l.durationHours, 0);
    const fuelCost = estimateFuelCost(totalDistance, trip.vehicle);
    const accommodationCost = estimateAccommodationCost(days.filter(d => d.needsHotel).length);

    return res.json({
      totalDistance,
      totalDrivingHours,
      legCount: legs.length,
      dayCount: days.length,
      days,
      legs,
      routeGeometry: routeResult?.geometry?.coordinates || [],
      fuelCost: { total: fuelCost, perLeg: legs.map(l => estimateFuelCost(l.distanceKm, trip.vehicle)) },
      accommodationCost: { total: accommodationCost, nights: days.filter(d => d.needsHotel).length, perNight: parseFloat(process.env.HOTEL_PRICE || '100') },
      totalEstimatedCost: Math.round((fuelCost + accommodationCost) * 100) / 100,
    });
  } catch (err) {
    console.error('Estimate stops error:', err);
    return res.status(500).json({ error: 'Failed to estimate stops' });
  }
});

// In-memory cache for day places (key: `${tripId}-${day}`)
const dayPlacesCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 3600000; // 1 hour

async function fetchWikipediaPlaces(lat: number, lng: number, radiusKm: number): Promise<any[]> {
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 10000); // Wikipedia max radius is 10km
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=${radiusMeters}&gscoord=${lat}|${lng}&gslimit=50&format=json&prop=pageimages|description|extracts&pithumbsize=300&exintro=1&exlimit=50`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data: any = await res.json();
    const pages = data?.query?.geosearch || [];
    return pages.map((p: any) => {
      const thumb = p.thumbnail?.source || null;
      return {
        title: p.title,
        description: p.description || '',
        pageId: p.pageid,
        thumbnail: thumb ? (thumb.startsWith('http') ? thumb : `https:${thumb}`) : null,
        latitude: p.lat,
        longitude: p.lon,
        distance: p.dist ? Math.round(p.dist / 1000 * 10) / 10 : 0,
        source: 'wikipedia',
      };
    });
  } catch { return []; }
}

// fetchNominatimPlaces was removed due to rate limiting; day-places now uses Wikipedia only

// Get popular places near a location (Wikipedia + Overpass combined)
router.post('/:id/day-places', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, day } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng required' });
    const radiusKm = radius || 322; // 200 miles ≈ 322 km
    const cacheKey = `${req.params.id}-${day ?? 'main'}`;
    const cached = dayPlacesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({ places: cached.data, source: 'cache' });
    }

    const wikiPlaces = await fetchWikipediaPlaces(lat, lng, radiusKm);
    const merged = wikiPlaces.slice(0, 40);
    merged.sort((a, b) => a.distance - b.distance);
    const top40 = merged.slice(0, 40);

    dayPlacesCache.set(cacheKey, { data: top40, ts: Date.now() });
    return res.json({ places: top40, source: 'fresh' });
  } catch (err) {
    console.error('Day places error:', err);
    return res.status(500).json({ error: 'Failed to fetch day places' });
  }
});

// Route preview for drag-to-insert: takes 3 waypoints, returns route geometry
router.post('/:id/route-preview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { waypoints } = req.body;
    if (!waypoints || waypoints.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 waypoints' });
    }
    const result = await routeBetweenWaypoints(waypoints);
    if (!result) return res.json({ geometry: [] });
    return res.json({ geometry: result.geometry.coordinates });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to calculate preview' });
  }
});

export default router;
