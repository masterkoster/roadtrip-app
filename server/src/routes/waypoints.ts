import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get waypoints for a trip
router.get('/trip/:tripId', async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const waypointList = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);
    return res.json(waypointList);
  } catch (err) {
    console.error('Get waypoints error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a waypoint
router.post('/trip/:tripId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { name, description, latitude, longitude, duration, dayIndex } = req.body;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    // Get max order index
    const existing = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    const nextOrder = existing.length > 0 ? existing[existing.length - 1].orderIndex + 1 : 0;

    const [waypoint] = await db.insert(schema.waypoints).values({
      tripId,
      name,
      description,
      latitude,
      longitude,
      orderIndex: nextOrder,
      duration: duration ?? null,
      dayIndex: dayIndex ?? null,
    }).returning();

    return res.status(201).json(waypoint);
  } catch (err) {
    console.error('Create waypoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a waypoint
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const waypointId = parseInt(req.params.id);
    const [waypoint] = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.id, waypointId))
      .limit(1);
    if (!waypoint) return res.status(404).json({ error: 'Waypoint not found' });

    const { name, description, latitude, longitude, orderIndex, duration, dayIndex } = req.body;
    const [updated] = await db.update(schema.waypoints)
      .set({
        name: name ?? waypoint.name,
        description: description ?? waypoint.description,
        latitude: latitude ?? waypoint.latitude,
        longitude: longitude ?? waypoint.longitude,
        orderIndex: orderIndex ?? waypoint.orderIndex,
        duration: duration !== undefined ? duration : waypoint.duration,
        dayIndex: dayIndex !== undefined ? dayIndex : waypoint.dayIndex,
      })
      .where(eq(schema.waypoints.id, waypointId))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error('Update waypoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a waypoint
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const waypointId = parseInt(req.params.id);
    const [waypoint] = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.id, waypointId))
      .limit(1);
    if (!waypoint) return res.status(404).json({ error: 'Waypoint not found' });

    await db.delete(schema.waypoints).where(eq(schema.waypoints.id, waypointId));
    return res.json({ message: 'Waypoint deleted' });
  } catch (err) {
    console.error('Delete waypoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch reorder waypoints
router.put('/trip/:tripId/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { waypointIds } = req.body;
    if (!Array.isArray(waypointIds)) return res.status(400).json({ error: 'waypointIds array required' });

    for (let i = 0; i < waypointIds.length; i++) {
      await db.update(schema.waypoints)
        .set({ orderIndex: i })
        .where(eq(schema.waypoints.id, waypointIds[i]));
    }

    const updated = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    return res.json(updated);
  } catch (err) {
    console.error('Reorder waypoints error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch create waypoints
router.post('/trip/:tripId/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { waypoints: newWaypoints } = req.body;
    if (!Array.isArray(newWaypoints) || newWaypoints.length === 0) {
      return res.status(400).json({ error: 'waypoints array required' });
    }

    const existing = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    let nextOrder = existing.length > 0 ? existing[existing.length - 1].orderIndex + 1 : 0;

    const created = [];
    for (const wp of newWaypoints) {
      const [waypoint] = await db.insert(schema.waypoints).values({
        tripId,
        name: wp.name || 'Stop',
        description: wp.description || null,
        latitude: wp.latitude,
        longitude: wp.longitude,
        orderIndex: nextOrder++,
      }).returning();
      created.push(waypoint);
    }

    return res.status(201).json(created);
  } catch (err) {
    console.error('Batch create waypoints error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch update waypoint timing (duration + day index)
router.put('/trip/:tripId/timing', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { waypoints: waypointUpdates } = req.body;
    if (!Array.isArray(waypointUpdates)) {
      return res.status(400).json({ error: 'waypoints array required' });
    }

    for (const wu of waypointUpdates) {
      await db.update(schema.waypoints)
        .set({
          duration: wu.duration !== undefined ? wu.duration : undefined,
          dayIndex: wu.dayIndex !== undefined ? wu.dayIndex : undefined,
        })
        .where(eq(schema.waypoints.id, wu.id));
    }

    const updated = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    return res.json(updated);
  } catch (err) {
    console.error('Batch update timing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-assign days based on cumulative driving time vs trip's maxDailyDrivingHours
router.post('/trip/:tripId/auto-assign-days', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const wps = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    if (wps.length < 2) {
      return res.json({ message: 'Need at least 2 waypoints', waypoints: wps });
    }

    const maxDailyHours = trip.maxDailyDrivingHours || 8;
    const coordPairs = wps.map(w => ({ latitude: w.latitude, longitude: w.longitude }));

    let routeResult: { legs: { duration: number }[] } | null = null;
    try {
      const { routeBetweenWaypoints } = await import('../utils/osrm');
      routeResult = await routeBetweenWaypoints(coordPairs);
    } catch { /* fall back to haversine estimation */ }

    const legDurations: number[] = [];
    if (routeResult?.legs) {
      for (const leg of routeResult.legs) {
        legDurations.push(leg.duration / 3600);
      }
    } else {
      for (let i = 1; i < wps.length; i++) {
        const dlat = (wps[i].latitude - wps[i - 1].latitude) * Math.PI / 180;
        const dlon = (wps[i].longitude - wps[i - 1].longitude) * Math.PI / 180;
        const a = Math.sin(dlat / 2) ** 2 + Math.cos(wps[i - 1].latitude * Math.PI / 180) * Math.cos(wps[i].latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const avgSpeed = 80;
        legDurations.push(dist / avgSpeed);
      }
    }

    let currentDay = 0;
    let dailyDrivingHours = 0;
    const dayAssignments: { id: number; dayIndex: number }[] = [{ id: wps[0].id, dayIndex: 0 }];

    for (let i = 1; i < wps.length; i++) {
      const legHours = legDurations[i - 1] || 0;
      const stopDurationHours = (wps[i - 1].duration || 0) / 60;

      if (dailyDrivingHours + legHours > maxDailyHours) {
        currentDay++;
        dailyDrivingHours = 0;
      }

      dailyDrivingHours += legHours + stopDurationHours;
      dayAssignments.push({ id: wps[i].id, dayIndex: currentDay });
    }

    for (const da of dayAssignments) {
      await db.update(schema.waypoints)
        .set({ dayIndex: da.dayIndex })
        .where(eq(schema.waypoints.id, da.id));
    }

    const updated = await db.select()
      .from(schema.waypoints)
      .where(eq(schema.waypoints.tripId, tripId))
      .orderBy(schema.waypoints.orderIndex);

    return res.json({ message: `Assigned to ${currentDay + 1} day(s)`, dayCount: currentDay + 1, waypoints: updated });
  } catch (err) {
    console.error('Auto-assign days error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
