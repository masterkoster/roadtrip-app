import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const nowISO = () => new Date().toISOString();

router.get('/trip/:tripId', async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const guideList = await db.select()
      .from(schema.guides)
      .where(eq(schema.guides.tripId, tripId))
      .orderBy(desc(schema.guides.createdAt));
    return res.json(guideList);
  } catch (err) {
    console.error('Get guides error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const guideId = parseInt(req.params.id);
    const [guide] = await db.select()
      .from(schema.guides)
      .where(eq(schema.guides.id, guideId))
      .limit(1);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });

    const segments = await db.select()
      .from(schema.guideSegments)
      .where(eq(schema.guideSegments.guideId, guideId))
      .orderBy(schema.guideSegments.orderIndex);

    return res.json({ ...guide, segments });
  } catch (err) {
    console.error('Get guide error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/trip/:tripId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { title, description, difficulty, recommendedSeason, estimatedDuration } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const [guide] = await db.insert(schema.guides).values({
      tripId,
      userId: req.userId!,
      title,
      description,
      difficulty: difficulty || 'medium',
      recommendedSeason: recommendedSeason || null,
      estimatedDuration: estimatedDuration || null,
    }).returning();

    if (req.body.segments && Array.isArray(req.body.segments)) {
      await db.insert(schema.guideSegments).values(
        req.body.segments.map((seg: any, idx: number) => ({
          guideId: guide.id,
          title: seg.title || `Step ${idx + 1}`,
          content: seg.content || '',
          orderIndex: idx,
          waypointId: seg.waypointId || null,
        }))
      );
    }

    const segments = await db.select()
      .from(schema.guideSegments)
      .where(eq(schema.guideSegments.guideId, guide.id))
      .orderBy(schema.guideSegments.orderIndex);

    return res.status(201).json({ ...guide, segments });
  } catch (err) {
    console.error('Create guide error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const guideId = parseInt(req.params.id);
    const [guide] = await db.select()
      .from(schema.guides)
      .where(and(eq(schema.guides.id, guideId), eq(schema.guides.userId, req.userId!)))
      .limit(1);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });

    const { title, description, difficulty, recommendedSeason, estimatedDuration, isPublic } = req.body;
    const [updated] = await db.update(schema.guides)
      .set({
        title: title ?? guide.title,
        description: description ?? guide.description,
        difficulty: difficulty ?? guide.difficulty,
        recommendedSeason: recommendedSeason ?? guide.recommendedSeason,
        estimatedDuration: estimatedDuration ?? guide.estimatedDuration,
        isPublic: isPublic ?? guide.isPublic,
        updatedAt: nowISO(),
      })
      .where(eq(schema.guides.id, guideId))
      .returning();

    if (req.body.segments && Array.isArray(req.body.segments)) {
      await db.delete(schema.guideSegments).where(eq(schema.guideSegments.guideId, guideId));
      await db.insert(schema.guideSegments).values(
        req.body.segments.map((seg: any, idx: number) => ({
          guideId: updated.id,
          title: seg.title || `Step ${idx + 1}`,
          content: seg.content || '',
          orderIndex: idx,
          waypointId: seg.waypointId || null,
        }))
      );
    }

    const segments = await db.select()
      .from(schema.guideSegments)
      .where(eq(schema.guideSegments.guideId, updated.id))
      .orderBy(schema.guideSegments.orderIndex);

    return res.json({ ...updated, segments });
  } catch (err) {
    console.error('Update guide error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const guideId = parseInt(req.params.id);
    const [guide] = await db.select()
      .from(schema.guides)
      .where(and(eq(schema.guides.id, guideId), eq(schema.guides.userId, req.userId!)))
      .limit(1);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    await db.delete(schema.guides).where(eq(schema.guides.id, guideId));
    return res.json({ message: 'Guide deleted' });
  } catch (err) {
    console.error('Delete guide error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
