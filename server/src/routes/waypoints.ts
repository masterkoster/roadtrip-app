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

    const { name, description, latitude, longitude } = req.body;
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

    const { name, description, latitude, longitude, orderIndex } = req.body;
    const [updated] = await db.update(schema.waypoints)
      .set({
        name: name ?? waypoint.name,
        description: description ?? waypoint.description,
        latitude: latitude ?? waypoint.latitude,
        longitude: longitude ?? waypoint.longitude,
        orderIndex: orderIndex ?? waypoint.orderIndex,
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

export default router;
