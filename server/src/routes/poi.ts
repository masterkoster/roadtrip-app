import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { findPOIs, ALL_CATEGORIES, getCategoryLabel, getCategoryIcon, type POICategory } from '../utils/poi';

const router = Router();

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
      // Use viewport: sample a grid to cover the area
      const pts: { latitude: number; longitude: number }[] = [];
      for (let lat = Math.ceil(south * 2) / 2; lat <= north; lat += 1.5) {
        for (let lng = Math.ceil(west * 2) / 2; lng <= east; lng += 1.5) {
          pts.push({ latitude: lat, longitude: lng });
        }
      }
      if (pts.length === 0) pts.push({ latitude: (south + north) / 2, longitude: (west + east) / 2 });
      routePoints = pts;
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

    const pois = await findPOIs(routePoints, categories);

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

export default router;
