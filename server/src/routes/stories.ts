import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/stories/:tripId — returns guide + segments + waypoints for the story player
router.get('/:tripId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);

    const guides = await db.select()
      .from(schema.guides)
      .where(eq(schema.guides.tripId, tripId))
      .orderBy(schema.guides.createdAt)
      .limit(1);

    if (guides.length === 0) {
      return res.status(404).json({ error: 'No guide found for this trip' });
    }

    const guide = guides[0];

    const segments = await db.select()
      .from(schema.guideSegments)
      .where(eq(schema.guideSegments.guideId, guide.id))
      .orderBy(schema.guideSegments.orderIndex);

    // Fetch waypoints referenced by segments
    const wpIds = segments
      .map(s => s.waypointId)
      .filter((id): id is number => id != null);

    let waypoints: any[] = [];
    if (wpIds.length > 0) {
      waypoints = await db.select()
        .from(schema.waypoints)
        .where(eq(schema.waypoints.id, wpIds[0]))
        .orderBy(schema.waypoints.orderIndex);

      // If there are multiple waypoints, we need to fetch them all
      // Since drizzle doesn't have a simple IN clause, let's do it manually
      if (wpIds.length > 1) {
        const sqlite = (db as any).session?.client;
        if (sqlite) {
          const placeholders = wpIds.map(() => '?').join(',');
          waypoints = sqlite.prepare(
            `SELECT * FROM waypoints WHERE id IN (${placeholders}) ORDER BY order_index`
          ).all(...wpIds);
        }
      }
    }

    return res.json({ guide, segments, waypoints });
  } catch (err) {
    console.error('Story fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
