import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { parseGpx } from '../utils/gpx';
import { matchToRoads } from '../utils/osrm';

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
    const { title, description, startDate, endDate, isPublic, vehicle } = req.body;
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

export default router;
