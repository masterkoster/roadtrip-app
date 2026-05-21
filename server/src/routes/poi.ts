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
